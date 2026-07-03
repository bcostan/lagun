import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  contactEvents,
  contactOrganizations,
  contacts,
  events,
  organizations,
} from "@/db/schema";

export async function getEventDetail(id: string) {
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) return null;

  const links = await db
    .select({
      link: contactEvents,
      contact: contacts,
    })
    .from(contactEvents)
    .innerJoin(contacts, eq(contactEvents.contactId, contacts.id))
    .where(eq(contactEvents.eventId, id))
    .orderBy(contacts.name);

  return { event, links };
}

export async function getOrganizationDetail(id: string) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);
  if (!organization) return null;

  const links = await db
    .select({
      link: contactOrganizations,
      contact: contacts,
    })
    .from(contactOrganizations)
    .innerJoin(contacts, eq(contactOrganizations.contactId, contacts.id))
    .where(eq(contactOrganizations.organizationId, id))
    .orderBy(contacts.name);

  return { organization, links };
}

export async function listEvents() {
  return db.select().from(events).orderBy(desc(events.date), events.name);
}

export async function listOrganizations() {
  return db.select().from(organizations).orderBy(organizations.name);
}
