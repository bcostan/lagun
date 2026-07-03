import Anthropic from "@anthropic-ai/sdk";
import { proposal, type Proposal } from "./operations";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// Pinned snapshot. Sonnet handles the light reasoning this needs (age to birth
// year, relative dates, picking the right event edition). Swap to
// claude-haiku-4-5 to cut cost. Check docs.claude.com for the newest id.
const MODEL = "claude-sonnet-5";

export const SYSTEM = `You convert a short, informal note about a person into a structured CRM update for Lagun.

You will be given today's date and, sometimes, lists of existing contacts, events, and organizations whose names are close to what the note mentions.

Rules:
- Return your answer only by calling the record_update tool. Do not write prose.
- Identify the target person. If a close existing contact name is provided and clearly matches, use that exact name and set match_hint to "existing". If clearly new, set "new". If you cannot tell, set "unsure".
- Only propose operations the note actually supports. Prefer fewer, correct operations. When something is inferred rather than stated, keep it but lower the overall confidence and explain it in reasoning.
- Convert any age into an approximate birth year using today's date, stored as birth_year in the relevant attributes. Never store a bare age.
- Convert every relative date (today, yesterday, last week, Tuesday) into an absolute YYYY-MM-DD using today's date.
- Family, colleagues, and anyone linked to the person are add_relation operations, with facts about them in attributes. Notes about that person use add_interaction with subject "relation:<their name>".
- Interactions with the target person may set_last_contact to the date they happened. Only set_followup when the note implies a future action.
- Events: when the note names a real-world event where the person was met or spoke, emit link_event with the event name, its series if you can infer it (e.g. series "SIAL" for "SIAL Paris 2026"), and the link_type. If a close existing event is provided, set match_hint "existing"; otherwise "new".
- Organizations: when the note ties the person to a company or startup (works at, founded, invests in, advises, supports), emit link_organization with the name, kind if known, and the link_type. Set match_hint against any provided existing organizations.
- Propose a new event or organization only for a named, reusable thing (a real conference, a real company). Never create one for a generic noun like "a competition", "a dinner", or "coffee"; leave those as plain text in an add_interaction.
- categories are limited to: speaker, client, prospect, partner, investor, press, supplier, friend.
- confidence is your honest probability that this update is correct and complete, from 0 to 1.

Today is {{today}}.`;

const tool: Anthropic.Tool = {
  name: "record_update",
  description: "Record the structured CRM update parsed from the note.",
  input_schema: {
    type: "object",
    properties: {
      target: {
        type: "object",
        properties: {
          name: { type: "string" },
          match_hint: { type: "string", enum: ["existing", "new", "unsure"] },
        },
        required: ["name", "match_hint"],
      },
      confidence: { type: "number" },
      reasoning: { type: "string" },
      operations: {
        type: "array",
        items: {
          type: "object",
          description:
            "One operation. type is one of: set_field (field,value), add_category (value), add_tag (value), add_previous (value), add_relation (relation:{name,type,attributes}), update_relation (match,attributes), add_interaction (subject,date,summary,attributes), link_event (event:{name,series?,date?,location?}, link_type, match_hint), link_organization (organization:{name,kind?}, link_type, match_hint), set_followup (date), set_last_contact (date), create_contact (name). link_type for events: met|spoke_at|attended|exhibited|organized. link_type for organizations: works_at|founded|invests_in|advises|supports|board|former.",
          properties: {
            type: { type: "string" },
            field: { type: "string" },
            value: { type: "string" },
            relation: { type: "object" },
            match: { type: "string" },
            subject: { type: "string" },
            date: { type: "string" },
            summary: { type: "string" },
            event: { type: "object" },
            organization: { type: "object" },
            link_type: { type: "string" },
            match_hint: { type: "string", enum: ["existing", "new", "unsure"] },
            attributes: { type: "object" },
          },
          required: ["type"],
        },
      },
    },
    required: ["target", "confidence", "operations"],
  },
};

type Candidates = {
  contacts?: string[];
  events?: string[];
  organizations?: string[];
};

export async function extract(
  text: string,
  today: string,
  candidates: Candidates = {},
): Promise<Proposal> {
  const lines: string[] = [];
  if (candidates.contacts?.length) lines.push(`Existing contacts close to this note: ${candidates.contacts.join(", ")}.`);
  if (candidates.events?.length) lines.push(`Existing events close to this note: ${candidates.events.join(", ")}.`);
  if (candidates.organizations?.length) lines.push(`Existing organizations close to this note: ${candidates.organizations.join(", ")}.`);
  const context = lines.length ? `\n\n${lines.join("\n")}` : "";

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM.replace("{{today}}", today),
    tools: [tool],
    tool_choice: { type: "tool", name: "record_update" },
    messages: [{ role: "user", content: `Note: ${text}${context}` }],
  });

  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Model did not return a record_update tool call");
  }
  // Strict validation. An unknown or malformed operation throws here rather than
  // reaching the database.
  return proposal.parse(block.input);
}
