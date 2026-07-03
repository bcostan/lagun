import { z } from "zod";

// The closed set of operations the model may propose. Anything outside this set
// is rejected by parsing, not guessed at. This is the contract between the
// extraction call and the apply step.

const CATEGORIES = [
  "speaker", "client", "prospect", "partner",
  "investor", "press", "supplier", "friend",
] as const;

const SETTABLE_FIELDS = [
  "company", "role", "relationship",
  "location", "email", "phone", "linkedin",
] as const;

const EVENT_LINKS = ["met", "spoke_at", "attended", "exhibited", "organized"] as const;
const ORG_LINKS = ["works_at", "founded", "invests_in", "advises", "supports", "board", "former"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const matchHint = z.enum(["existing", "new", "unsure"]);

export const operation = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_field"), field: z.enum(SETTABLE_FIELDS), value: z.string() }),
  z.object({ type: z.literal("add_category"), value: z.enum(CATEGORIES) }),
  z.object({ type: z.literal("add_tag"), value: z.string() }),
  z.object({ type: z.literal("add_previous"), value: z.string() }),
  z.object({
    type: z.literal("add_relation"),
    relation: z.object({
      name: z.string(),
      type: z.string(),
      attributes: z.record(z.any()).default({}),
    }),
  }),
  z.object({
    type: z.literal("update_relation"),
    match: z.string(),                       // name of the relation to update
    attributes: z.record(z.any()).default({}),
  }),
  z.object({
    type: z.literal("add_interaction"),
    subject: z.string(),                     // "contact" or "relation:<name>"
    date: isoDate,
    summary: z.string(),
    attributes: z.record(z.any()).default({}),
  }),
  // Link the contact to a real-world event. When match_hint is "new" the server
  // creates the event after you accept it, then links. Series lets editions group.
  z.object({
    type: z.literal("link_event"),
    event: z.object({
      name: z.string(),
      series: z.string().optional(),
      date: isoDate.optional(),
      location: z.string().optional(),
    }),
    link_type: z.enum(EVENT_LINKS).default("met"),
    match_hint: matchHint,
  }),
  // Link the contact to an organization. Carries the investor and founder angles.
  z.object({
    type: z.literal("link_organization"),
    organization: z.object({
      name: z.string(),
      kind: z.enum(["startup", "company", "fund", "agency", "other"]).optional(),
    }),
    link_type: z.enum(ORG_LINKS),
    match_hint: matchHint,
  }),
  z.object({ type: z.literal("set_followup"), date: isoDate }),
  z.object({ type: z.literal("set_last_contact"), date: isoDate }),
  z.object({
    type: z.literal("update_contact_attributes"),
    attributes: z.record(z.any()).default({}),
  }),
  z.object({ type: z.literal("create_contact"), name: z.string() }),
]);

export const proposal = z.object({
  target: z.object({
    name: z.string(),
    match_hint: matchHint,
  }),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  operations: z.array(operation),
});

export type Operation = z.infer<typeof operation>;
export type Proposal = z.infer<typeof proposal>;
