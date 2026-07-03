import {
  pgTable, uuid, text, jsonb, date, timestamp, real, boolean,
} from "drizzle-orm/pg-core";

// Lagun is a small graph: people, the events where you met them, and the
// organizations they are tied to. `attributes` jsonb columns hold any fact that
// does not deserve its own column.

// Contacts: the card. company and role are denormalized here for the common case
// and quick display. There is no met_at field: "met at" is a contact_events link.
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  company: text("company"),
  role: text("role"),
  previous: text("previous").array().default([]),        // past employers, as text
  categories: text("categories").array().default([]),    // controlled list
  tags: text("tags").array().default([]),                // freeform + new/review
  relationship: text("relationship").default("cold"),    // cold | warm | close
  location: text("location"),
  email: text("email"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  attributes: jsonb("attributes").default({}),
  lastContact: date("last_contact"),
  nextFollowup: date("next_followup"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Interactions: the dated timeline (renamed from the old "events" to free the
// word). relationId is set when the note is about a relation, e.g. Charlie.
export const interactions = pgTable("interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  relationId: uuid("relation_id").references(() => relations.id),
  date: date("date"),
  summary: text("summary").notNull(),
  attributes: jsonb("attributes").default({}),
  captureId: uuid("capture_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Relations: person to person (spouse, child, colleague, introduced by). May be
// promoted to a full contact later via relatedContactId. Charlie lives here, with
// his birth_year and activities in attributes.
export const relations = pgTable("relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  relatedContactId: uuid("related_contact_id").references(() => contacts.id),
  name: text("name").notNull(),
  type: text("type"),
  attributes: jsonb("attributes").default({}),           // { birth_year, activities }
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Events: real-world events, stored per edition. series groups editions, so all
// of "JEC World 2025", "JEC World 2026" share series "JEC World".
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),                          // edition, e.g. "SIAL Paris 2026"
  series: text("series"),                                // e.g. "SIAL"
  date: date("date"),
  location: text("location"),
  attributes: jsonb("attributes").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Organizations: startups and companies worth tracking relationally. Promote a
// company here only when it earns it (backed, advised, or recurring), not every
// former employer.
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind"),                                    // startup | company | fund | agency | other
  attributes: jsonb("attributes").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Link: contact to event. link_type carries the angle.
export const contactEvents = pgTable("contact_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  linkType: text("link_type").default("met"),            // met | spoke_at | attended | exhibited | organized
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Link: contact to organization. This carries the investor and founder angles.
export const contactOrganizations = pgTable("contact_organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  linkType: text("link_type").notNull(),                 // works_at | founded | invests_in | advises | supports | board | former
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Captures: one row per submitted sentence. rawText is kept verbatim forever.
// snapshot holds the pre-apply state of touched rows so any change can be undone.
export const captures = pgTable("captures", {
  id: uuid("id").primaryKey().defaultRandom(),
  rawText: text("raw_text").notNull(),
  source: text("source").default("web"),                 // web | shortcut
  proposal: jsonb("proposal"),
  confidence: real("confidence"),
  applied: boolean("applied").default(false),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  snapshot: jsonb("snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
