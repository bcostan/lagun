const CATEGORIES = new Set([
  "speaker", "client", "prospect", "partner",
  "investor", "press", "supplier", "friend",
]);

const ORG_KINDS = new Set(["startup", "company", "fund", "agency", "other"]);
const RELATIONSHIPS = new Set(["cold", "warm", "close"]);
const SETTABLE_FIELDS = new Set([
  "company", "role", "relationship", "location", "email", "phone", "linkedin",
]);

function coerceOrgKind(kind: unknown): string | undefined {
  if (typeof kind !== "string") return undefined;
  const normalized = kind.toLowerCase().trim();
  if (ORG_KINDS.has(normalized)) return normalized;
  if (/fund|vc|capital|invest/.test(normalized)) return "fund";
  if (/agency|consult/.test(normalized)) return "agency";
  if (/startup/.test(normalized)) return "startup";
  return "company";
}

function sanitizeOperation(op: unknown): unknown {
  if (!op || typeof op !== "object") return op;
  const row = { ...(op as Record<string, unknown>) };
  const type = row.type;

  if (type === "add_category" && typeof row.value === "string") {
    const value = row.value.toLowerCase().trim();
    if (!CATEGORIES.has(value)) delete row.type;
    else row.value = value;
  }

  if (type === "set_field" && typeof row.field === "string") {
    if (!SETTABLE_FIELDS.has(row.field)) delete row.type;
    if (row.field === "relationship" && typeof row.value === "string") {
      const value = row.value.toLowerCase().trim();
      row.value = RELATIONSHIPS.has(value) ? value : "warm";
    }
  }

  if (type === "link_organization" && row.organization && typeof row.organization === "object") {
    const org = { ...(row.organization as Record<string, unknown>) };
    const kind = coerceOrgKind(org.kind);
    if (kind) org.kind = kind;
    else delete org.kind;
    row.organization = org;
  }

  if (type === "link_event" && row.event && typeof row.event === "object") {
    const event = { ...(row.event as Record<string, unknown>) };
    if (typeof event.date === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
      delete event.date;
    }
    row.event = event;
  }

  if ((type === "set_followup" || type === "set_last_contact" || type === "add_interaction") && typeof row.date === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) delete row.type;
  }

  return row;
}

export function sanitizeProposalInput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const obj = { ...(input as Record<string, unknown>) };
  if (Array.isArray(obj.operations)) {
    obj.operations = obj.operations
      .map(sanitizeOperation)
      .filter((op) => op && typeof op === "object" && (op as Record<string, unknown>).type);
  }
  return obj;
}
