import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
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
import { addDaysISO, endOfWeekISO, todayISO } from "@/lib/dates";
import { normalizeName } from "@/lib/normalize";

export type ContactFilter =
  | "all"
  | "followups_due"
  | "due_this_week"
  | "gone_quiet"
  | "untriaged"
  | "to_review"
  | `category:${string}`;

export async function countContacts(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(contacts);
  return row?.count ?? 0;
}

async function searchContactIds(term: string): Promise<string[]> {
  const q = `%${term.trim()}%`;

  const matches = await db
    .selectDistinct({ id: contacts.id })
    .from(contacts)
    .leftJoin(interactions, eq(interactions.contactId, contacts.id))
    .leftJoin(relations, eq(relations.contactId, contacts.id))
    .leftJoin(contactEvents, eq(contactEvents.contactId, contacts.id))
    .leftJoin(events, eq(events.id, contactEvents.eventId))
    .leftJoin(contactOrganizations, eq(contactOrganizations.contactId, contacts.id))
    .leftJoin(organizations, eq(organizations.id, contactOrganizations.organizationId))
    .where(
      or(
        ilike(contacts.name, q),
        ilike(contacts.company, q),
        ilike(contacts.role, q),
        ilike(contacts.location, q),
        ilike(contacts.email, q),
        ilike(contacts.phone, q),
        ilike(contacts.linkedin, q),
        sql`coalesce(${contacts.previous}::text, '') ilike ${q}`,
        sql`coalesce(${contacts.tags}::text, '') ilike ${q}`,
        sql`coalesce(${contacts.categories}::text, '') ilike ${q}`,
        sql`coalesce(${contacts.attributes}::text, '') ilike ${q}`,
        ilike(interactions.summary, q),
        sql`coalesce(${interactions.attributes}::text, '') ilike ${q}`,
        ilike(relations.name, q),
        ilike(relations.type, q),
        sql`coalesce(${relations.attributes}::text, '') ilike ${q}`,
        ilike(events.name, q),
        ilike(events.series, q),
        ilike(events.location, q),
        ilike(organizations.name, q),
        sql`exists (
          select 1 from ${captures} c
          where c.applied = true
          and c.proposal->'target'->>'name' = ${contacts.name}
          and c.raw_text ilike ${q}
        )`,
      ),
    );

  return matches.map((row) => row.id);
}

export async function listContacts(options: {
  search?: string;
  filter?: ContactFilter;
}) {
  const { search, filter = "all" } = options;
  let rows = await db.select().from(contacts).orderBy(contacts.name);

  if (search?.trim()) {
    const ids = await searchContactIds(search);
    if (ids.length === 0) return [];
    rows = await db
      .select()
      .from(contacts)
      .where(inArray(contacts.id, ids))
      .orderBy(contacts.name);
  }

  const today = todayISO();
  const weekEnd = endOfWeekISO(today);
  const quietBefore = addDaysISO(today, -90);

  return rows.filter((c) => {
    switch (filter) {
      case "all":
        return true;
      case "followups_due":
        return !!c.nextFollowup && c.nextFollowup <= today;
      case "due_this_week":
        return !!c.nextFollowup && c.nextFollowup >= today && c.nextFollowup <= weekEnd;
      case "gone_quiet":
        return (
          (!c.lastContact || c.lastContact < quietBefore) &&
          !c.nextFollowup
        );
      case "untriaged":
        return (c.tags ?? []).includes("new");
      case "to_review":
        return (c.tags ?? []).includes("review");
      default:
        if (filter.startsWith("category:")) {
          const cat = filter.slice("category:".length);
          return (c.categories ?? []).includes(cat);
        }
        return true;
    }
  });
}

export async function getContactById(id: string) {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return contact ?? null;
}

export async function getContactDetail(id: string) {
  const contact = await getContactById(id);
  if (!contact) return null;

  const contactRelations = await db
    .select()
    .from(relations)
    .where(eq(relations.contactId, id))
    .orderBy(relations.name);

  const contactInteractions = await db
    .select()
    .from(interactions)
    .where(eq(interactions.contactId, id))
    .orderBy(desc(interactions.date), desc(interactions.createdAt));

  const contactCaptures = await db
    .select()
    .from(captures)
    .where(
      and(
        eq(captures.applied, true),
        sql`${captures.proposal}->'target'->>'name' = ${contact.name}`,
      ),
    )
    .orderBy(desc(captures.createdAt))
    .limit(20);

  const linkedEvents = await db
    .select({
      link: contactEvents,
      event: events,
    })
    .from(contactEvents)
    .innerJoin(events, eq(contactEvents.eventId, events.id))
    .where(eq(contactEvents.contactId, id))
    .orderBy(desc(events.date), events.name);

  const linkedOrganizations = await db
    .select({
      link: contactOrganizations,
      organization: organizations,
    })
    .from(contactOrganizations)
    .innerJoin(organizations, eq(contactOrganizations.organizationId, organizations.id))
    .where(eq(contactOrganizations.contactId, id))
    .orderBy(organizations.name);

  return {
    contact,
    relations: contactRelations,
    interactions: contactInteractions,
    captures: contactCaptures,
    events: linkedEvents,
    organizations: linkedOrganizations,
  };
}

export async function listRecentCaptures(limit = 10) {
  return db
    .select()
    .from(captures)
    .orderBy(desc(captures.createdAt))
    .limit(limit);
}

export type ContactInput = {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  role?: string | null;
  relationship?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  categories?: string[];
  tags?: string[];
  previous?: string[];
  lastContact?: string | null;
  nextFollowup?: string | null;
};

export async function createContact(input: ContactInput) {
  const parts = input.name.trim().split(/\s+/);
  const [row] = await db
    .insert(contacts)
    .values({
      name: input.name.trim(),
      firstName: input.firstName ?? parts[0] ?? null,
      lastName: input.lastName ?? (parts.length > 1 ? parts.slice(1).join(" ") : null),
      company: input.company ?? null,
      role: input.role ?? null,
      relationship: input.relationship ?? "cold",
      location: input.location ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      linkedin: input.linkedin ?? null,
      categories: input.categories ?? [],
      tags: input.tags ?? [],
      previous: input.previous ?? [],
      lastContact: input.lastContact ?? null,
      nextFollowup: input.nextFollowup ?? null,
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateContact(id: string, input: Partial<ContactInput>) {
  const [row] = await db
    .update(contacts)
    .set({
      ...input,
      name: input.name?.trim(),
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id))
    .returning();
  return row ?? null;
}

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

export function contactMatchesName(contact: { name: string }, name: string) {
  return normalizeName(contact.name) === normalizeName(name);
}
