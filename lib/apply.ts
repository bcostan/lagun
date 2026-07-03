import { and, eq } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { db } from "@/db";
import {
  captures,
  contactEvents,
  contactOrganizations,
  contacts,
  events,
  interactions,
  organizations,
  relations,
} from "@/db/schema";
import * as schema from "@/db/schema";
import { splitName } from "@/lib/contacts";
import { normalizeName } from "@/lib/normalize";
import { operation, type Operation } from "@/lib/operations";
import type { EntityChoice } from "@/lib/resolutions";

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
  "update_contact_attributes",
  "create_contact",
  "link_event",
  "link_organization",
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
  contactEvents: (typeof contactEvents.$inferSelect)[];
  contactOrganizations: (typeof contactOrganizations.$inferSelect)[];
  createdEventIds: string[];
  createdOrganizationIds: string[];
};

function asDate(value: unknown): Date | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return undefined;
}

function restoreContact(row: typeof contacts.$inferSelect) {
  const { id: _id, createdAt, updatedAt: _updatedAt, ...data } = row;
  return {
    ...data,
    createdAt: asDate(createdAt),
    updatedAt: new Date(),
  };
}

function restoreRelation(row: typeof relations.$inferSelect) {
  const { id: _id, createdAt, ...data } = row;
  return { ...data, createdAt: asDate(createdAt) };
}

function restoreInteraction(row: typeof interactions.$inferSelect) {
  const { id: _id, createdAt, ...data } = row;
  return { ...data, createdAt: asDate(createdAt) };
}

function restoreContactEvent(row: typeof contactEvents.$inferSelect) {
  const { id: _id, createdAt, ...data } = row;
  return { ...data, createdAt: asDate(createdAt) };
}

function restoreContactOrganization(row: typeof contactOrganizations.$inferSelect) {
  const { id: _id, createdAt, ...data } = row;
  return { ...data, createdAt: asDate(createdAt) };
}

async function loadSnapshot(tx: Db, contactId: string): Promise<Snapshot> {
  const [contact] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  const rels = await tx.select().from(relations).where(eq(relations.contactId, contactId));
  const ints = await tx.select().from(interactions).where(eq(interactions.contactId, contactId));
  const evLinks = await tx.select().from(contactEvents).where(eq(contactEvents.contactId, contactId));
  const orgLinks = await tx
    .select()
    .from(contactOrganizations)
    .where(eq(contactOrganizations.contactId, contactId));

  return {
    contact: contact ?? null,
    relations: rels,
    interactions: ints,
    contactEvents: evLinks,
    contactOrganizations: orgLinks,
    createdEventIds: [],
    createdOrganizationIds: [],
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

function sortOperationsForApply(ops: Operation[]): Operation[] {
  const addRelations = ops.filter((op) => op.type === "add_relation");
  const updateRelations = ops.filter((op) => op.type === "update_relation");
  const addInteractions = ops.filter((op) => op.type === "add_interaction");
  const rest = ops.filter(
    (op) => op.type !== "add_relation" && op.type !== "update_relation" && op.type !== "add_interaction",
  );
  return [...rest, ...addRelations, ...updateRelations, ...addInteractions];
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

async function resolveEventId(
  tx: Db,
  op: Extract<Operation, { type: "link_event" }>,
  choice: EntityChoice | undefined,
  snapshot: Snapshot,
): Promise<string | null> {
  const action = choice?.action ?? (op.match_hint === "new" ? "create" : "existing");
  if (action === "skip") return null;

  if (action === "existing") {
    if (choice?.id) return choice.id;
    const rows = await tx.select().from(events);
    const match = rows.find((e) => normalizeName(e.name) === normalizeName(op.event.name));
    return match?.id ?? choice?.id ?? null;
  }

  const [created] = await tx
    .insert(events)
    .values({
      name: op.event.name,
      series: op.event.series ?? null,
      date: op.event.date ?? null,
      location: op.event.location ?? null,
    })
    .returning();
  snapshot.createdEventIds.push(created.id);
  return created.id;
}

async function resolveOrganizationId(
  tx: Db,
  op: Extract<Operation, { type: "link_organization" }>,
  choice: EntityChoice | undefined,
  snapshot: Snapshot,
): Promise<string | null> {
  const action = choice?.action ?? (op.match_hint === "new" ? "create" : "existing");
  if (action === "skip") return null;

  if (action === "existing") {
    if (choice?.id) return choice.id;
    const rows = await tx.select().from(organizations);
    const match = rows.find((o) => normalizeName(o.name) === normalizeName(op.organization.name));
    return match?.id ?? null;
  }

  const [created] = await tx
    .insert(organizations)
    .values({
      name: op.organization.name,
      kind: op.organization.kind ?? null,
    })
    .returning();
  snapshot.createdOrganizationIds.push(created.id);
  return created.id;
}

export async function applyCapture(input: {
  captureId: string;
  targetName: string;
  contactId?: string;
  operations: unknown[];
  entityChoices?: Record<string, EntityChoice>;
}) {
  const ops = sortOperationsForApply(parseOperations(input.operations));
  const entityChoices = input.entityChoices ?? {};

  return db.transaction(async (tx) => {
    const [capture] = await tx.select().from(captures).where(eq(captures.id, input.captureId)).limit(1);
    if (!capture) throw new Error("Capture not found");
    if (capture.applied) throw new Error("Capture already applied");

    let contact = await ensureContact(tx, input.targetName, ops, input.contactId);
    const snapshot = await loadSnapshot(tx, contact.id);

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const chipId = `${op.type}-${i}`;

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

      if (op.type === "update_contact_attributes") {
        const [updated] = await tx
          .update(contacts)
          .set({
            attributes: mergeAttributes(contact.attributes as Record<string, unknown>, op.attributes),
            updatedAt: new Date(),
          })
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
        if (!rel) {
          await tx.insert(relations).values({
            contactId: contact.id,
            name: op.match,
            type: "family",
            attributes: op.attributes ?? {},
          });
          continue;
        }
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
        continue;
      }

      if (op.type === "link_event") {
        const choice = entityChoices[chipId];
        if (choice?.action === "skip") continue;

        const eventId = await resolveEventId(tx, op, choice, snapshot);
        if (!eventId) continue;

        const existing = await tx
          .select()
          .from(contactEvents)
          .where(
            and(
              eq(contactEvents.contactId, contact.id),
              eq(contactEvents.eventId, eventId),
              eq(contactEvents.linkType, op.link_type),
            ),
          )
          .limit(1);
        if (!existing.length) {
          await tx.insert(contactEvents).values({
            contactId: contact.id,
            eventId,
            linkType: op.link_type,
          });
        }
        continue;
      }

      if (op.type === "link_organization") {
        const choice = entityChoices[chipId];
        if (choice?.action === "skip") continue;

        const organizationId = await resolveOrganizationId(tx, op, choice, snapshot);
        if (!organizationId) continue;

        const existing = await tx
          .select()
          .from(contactOrganizations)
          .where(
            and(
              eq(contactOrganizations.contactId, contact.id),
              eq(contactOrganizations.organizationId, organizationId),
              eq(contactOrganizations.linkType, op.link_type),
            ),
          )
          .limit(1);
        if (!existing.length) {
          await tx.insert(contactOrganizations).values({
            contactId: contact.id,
            organizationId,
            linkType: op.link_type,
          });
        }
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
    snapshot.createdEventIds = snapshot.createdEventIds ?? [];
    snapshot.createdOrganizationIds = snapshot.createdOrganizationIds ?? [];
    snapshot.contactEvents = snapshot.contactEvents ?? [];
    snapshot.contactOrganizations = snapshot.contactOrganizations ?? [];

    if (snapshot.contact) {
      await tx
        .update(contacts)
        .set(restoreContact(snapshot.contact))
        .where(eq(contacts.id, snapshot.contact.id));

      await tx.delete(relations).where(eq(relations.contactId, snapshot.contact.id));
      await tx.delete(interactions).where(eq(interactions.contactId, snapshot.contact.id));
      await tx.delete(contactEvents).where(eq(contactEvents.contactId, snapshot.contact.id));
      await tx.delete(contactOrganizations).where(eq(contactOrganizations.contactId, snapshot.contact.id));

      if (snapshot.relations.length) {
        await tx.insert(relations).values(snapshot.relations.map(restoreRelation));
      }
      if (snapshot.interactions.length) {
        await tx.insert(interactions).values(snapshot.interactions.map(restoreInteraction));
      }
      if (snapshot.contactEvents?.length) {
        await tx.insert(contactEvents).values(snapshot.contactEvents.map(restoreContactEvent));
      }
      if (snapshot.contactOrganizations?.length) {
        await tx.insert(contactOrganizations).values(
          snapshot.contactOrganizations.map(restoreContactOrganization),
        );
      }

      for (const eventId of snapshot.createdEventIds ?? []) {
        await tx.delete(events).where(eq(events.id, eventId));
      }
      for (const orgId of snapshot.createdOrganizationIds ?? []) {
        await tx.delete(organizations).where(eq(organizations.id, orgId));
      }
    } else {
      const proposal = capture.proposal as { target?: { name?: string } } | null;
      const name = proposal?.target?.name;
      if (name) {
        const row = await findContactByNameTx(tx, name);
        if (row) {
          await tx.delete(contactOrganizations).where(eq(contactOrganizations.contactId, row.id));
          await tx.delete(contactEvents).where(eq(contactEvents.contactId, row.id));
          await tx.delete(interactions).where(eq(interactions.contactId, row.id));
          await tx.delete(relations).where(eq(relations.contactId, row.id));
          await tx.delete(contacts).where(eq(contacts.id, row.id));
        }
      }
      for (const eventId of snapshot.createdEventIds ?? []) {
        await tx.delete(events).where(eq(events.id, eventId));
      }
      for (const orgId of snapshot.createdOrganizationIds ?? []) {
        await tx.delete(organizations).where(eq(organizations.id, orgId));
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
