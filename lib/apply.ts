import { eq } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { db } from "@/db";
import { captures, contacts, interactions, relations } from "@/db/schema";
import * as schema from "@/db/schema";
import { splitName } from "@/lib/contacts";
import { normalizeName } from "@/lib/normalize";
import { operation, type Operation } from "@/lib/operations";

const IN_SCOPE = new Set([
  "set_field",
  "add_category",
  "add_tag",
  "add_previous",
  "add_relation",
  "update_relation",
  "add_interaction",
  "set_followup",
  "set_last_contact",
  "create_contact",
]);

type Db = NeonDatabase<typeof schema>;

export function isInScopeOperation(op: Operation): boolean {
  return IN_SCOPE.has(op.type);
}

export function parseOperations(raw: unknown[]): Operation[] {
  return raw.map((item) => operation.parse(item)).filter(isInScopeOperation);
}

type Snapshot = {
  contact: typeof contacts.$inferSelect | null;
  relations: (typeof relations.$inferSelect)[];
  interactions: (typeof interactions.$inferSelect)[];
};

async function loadSnapshot(tx: Db, contactId: string): Promise<Snapshot> {
  const [contact] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  const rels = await tx.select().from(relations).where(eq(relations.contactId, contactId));
  const ints = await tx.select().from(interactions).where(eq(interactions.contactId, contactId));
  return {
    contact: contact ?? null,
    relations: rels,
    interactions: ints,
  };
}

function unionTextArray(current: string[] | null | undefined, value: string): string[] {
  const list = current ?? [];
  return list.includes(value) ? list : [...list, value];
}

function mergeAttributes(
  current: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base = { ...(current ?? {}) };
  for (const [key, val] of Object.entries(patch)) {
    if (Array.isArray(val) && Array.isArray(base[key])) {
      base[key] = [...new Set([...(base[key] as unknown[]), ...val])];
    } else {
      base[key] = val;
    }
  }
  return base;
}

async function findContactByNameTx(tx: Db, name: string) {
  const rows = await tx.select().from(contacts);
  const target = normalizeName(name);
  return rows.find((c) => normalizeName(c.name) === target) ?? null;
}

async function ensureContact(
  tx: Db,
  targetName: string,
  ops: Operation[],
  contactId?: string,
): Promise<typeof contacts.$inferSelect> {
  if (contactId) {
    const [row] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
    if (row) return row;
  }

  const existing = await findContactByNameTx(tx, targetName);
  if (existing) return existing;

  const createOp = ops.find((op) => op.type === "create_contact");
  const name = createOp?.type === "create_contact" ? createOp.name : targetName;
  const { firstName, lastName } = splitName(name);
  const [created] = await tx
    .insert(contacts)
    .values({
      name,
      firstName,
      lastName,
      updatedAt: new Date(),
    })
    .returning();
  return created;
}

export async function applyCapture(input: {
  captureId: string;
  targetName: string;
  contactId?: string;
  operations: unknown[];
}) {
  const ops = parseOperations(input.operations);

  return db.transaction(async (tx) => {
    const [capture] = await tx.select().from(captures).where(eq(captures.id, input.captureId)).limit(1);
    if (!capture) throw new Error("Capture not found");
    if (capture.applied) throw new Error("Capture already applied");

    let contact = await ensureContact(tx, input.targetName, ops, input.contactId);
    const snapshot = await loadSnapshot(tx, contact.id);

    for (const op of ops) {
      if (op.type === "create_contact") continue;

      if (op.type === "set_field") {
        const current = contact[op.field as keyof typeof contact] as string | null | undefined;
        if (current && current.trim() && current !== op.value) continue;
        const [updated] = await tx
          .update(contacts)
          .set({ [op.field]: op.value, updatedAt: new Date() })
          .where(eq(contacts.id, contact.id))
          .returning();
        contact = updated;
        continue;
      }

      if (op.type === "add_category") {
        const [updated] = await tx
          .update(contacts)
          .set({
            categories: unionTextArray(contact.categories, op.value),
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contact.id))
          .returning();
        contact = updated;
        continue;
      }

      if (op.type === "add_tag") {
        const [updated] = await tx
          .update(contacts)
          .set({
            tags: unionTextArray(contact.tags, op.value),
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contact.id))
          .returning();
        contact = updated;
        continue;
      }

      if (op.type === "add_previous") {
        const [updated] = await tx
          .update(contacts)
          .set({
            previous: unionTextArray(contact.previous, op.value),
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contact.id))
          .returning();
        contact = updated;
        continue;
      }

      if (op.type === "set_followup") {
        const [updated] = await tx
          .update(contacts)
          .set({ nextFollowup: op.date, updatedAt: new Date() })
          .where(eq(contacts.id, contact.id))
          .returning();
        contact = updated;
        continue;
      }

      if (op.type === "set_last_contact") {
        const [updated] = await tx
          .update(contacts)
          .set({ lastContact: op.date, updatedAt: new Date() })
          .where(eq(contacts.id, contact.id))
          .returning();
        contact = updated;
        continue;
      }

      if (op.type === "add_relation") {
        await tx.insert(relations).values({
          contactId: contact.id,
          name: op.relation.name,
          type: op.relation.type,
          attributes: op.relation.attributes ?? {},
        });
        continue;
      }

      if (op.type === "update_relation") {
        const relRows = await tx
          .select()
          .from(relations)
          .where(eq(relations.contactId, contact.id));
        const rel = relRows.find(
          (r) => r.name.toLowerCase() === op.match.toLowerCase(),
        );
        if (!rel) continue;
        await tx
          .update(relations)
          .set({ attributes: mergeAttributes(rel.attributes as Record<string, unknown>, op.attributes) })
          .where(eq(relations.id, rel.id));
        continue;
      }

      if (op.type === "add_interaction") {
        let relationId: string | null = null;
        if (op.subject.startsWith("relation:")) {
          const relName = op.subject.slice("relation:".length);
          const relRows = await tx
            .select()
            .from(relations)
            .where(eq(relations.contactId, contact.id));
          relationId = relRows.find((r) => r.name.toLowerCase() === relName.toLowerCase())?.id ?? null;
        }

        await tx.insert(interactions).values({
          contactId: contact.id,
          relationId,
          date: op.date,
          summary: op.summary,
          attributes: op.attributes ?? {},
          captureId: input.captureId,
        });
      }
    }

    await tx
      .update(captures)
      .set({
        applied: true,
        appliedAt: new Date(),
        snapshot,
      })
      .where(eq(captures.id, input.captureId));

    return contact;
  });
}

export async function undoCapture(captureId: string) {
  return db.transaction(async (tx) => {
    const [capture] = await tx.select().from(captures).where(eq(captures.id, captureId)).limit(1);
    if (!capture) throw new Error("Capture not found");
    if (!capture.applied) throw new Error("Capture is not applied");
    const snapshot = capture.snapshot as Snapshot | null;
    if (!snapshot) throw new Error("No snapshot to restore");

    if (snapshot.contact) {
      await tx
        .update(contacts)
        .set({
          ...snapshot.contact,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, snapshot.contact.id));

      await tx.delete(relations).where(eq(relations.contactId, snapshot.contact.id));
      await tx.delete(interactions).where(eq(interactions.contactId, snapshot.contact.id));

      if (snapshot.relations.length) {
        await tx.insert(relations).values(
          snapshot.relations.map(({ id: _id, ...row }) => row),
        );
      }
      if (snapshot.interactions.length) {
        await tx.insert(interactions).values(
          snapshot.interactions.map(({ id: _id, ...row }) => row),
        );
      }
    } else {
      const proposal = capture.proposal as { target?: { name?: string } } | null;
      const name = proposal?.target?.name;
      if (name) {
        const row = await findContactByNameTx(tx, name);
        if (row) {
          await tx.delete(interactions).where(eq(interactions.contactId, row.id));
          await tx.delete(relations).where(eq(relations.contactId, row.id));
          await tx.delete(contacts).where(eq(contacts.id, row.id));
        }
      }
    }

    await tx
      .update(captures)
      .set({
        applied: false,
        appliedAt: null,
        snapshot: null,
      })
      .where(eq(captures.id, captureId));

    return { ok: true };
  });
}
