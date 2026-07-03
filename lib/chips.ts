import type { Operation } from "@/lib/operations";
import type { EntityAction, EntityResolution } from "@/lib/resolutions";

export type ChipState = {
  id: string;
  operation: Operation;
  enabled: boolean;
  lowConfidence: boolean;
  isEntity: boolean;
  entityAction?: EntityAction;
  entityId?: string;
  entityResolution?: EntityResolution;
  label: string;
  value: string;
  note?: string;
};

const LOW_CONFIDENCE_THRESHOLD = 0.75;

export function buildChipStates(
  operations: Operation[],
  proposalConfidence: number,
  reasoning?: string,
  entityResolutions: EntityResolution[] = [],
): ChipState[] {
  const resolutionByChip = new Map(entityResolutions.map((r) => [r.chipId, r]));

  return operations.map((op, index) => {
    const id = `${op.type}-${index}`;
    const isEntity = op.type === "link_event" || op.type === "link_organization";
    const resolution = resolutionByChip.get(id);
    const inferred = isInferredOperation(op, reasoning);
    const lowConfidence = !isEntity && (proposalConfidence < LOW_CONFIDENCE_THRESHOLD || inferred);

    let note: string | undefined;
    if (isEntity && resolution) {
      if (resolution.hint === "new") {
        note = "Create new and link to this contact";
      } else if (resolution.hint === "unsure") {
        note = "Pick an existing one or create new";
      } else {
        note = `Link to existing · ${resolution.suggestedName}`;
      }
    } else if (inferred) {
      note = reasoning || "Inferred from the note, not stated directly";
    }

    return {
      id,
      operation: op,
      enabled: true,
      lowConfidence,
      isEntity,
      entityAction: resolution?.defaultAction,
      entityId: resolution?.suggestedId,
      entityResolution: resolution,
      label: chipLabel(op, resolution),
      value: chipValue(op, resolution),
      note,
    };
  });
}

function formatAttributes(attrs: Record<string, unknown>): string[] {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "birth_year") parts.push(`birth year ≈ ${v}`);
    else if (k === "birthday") parts.push(`birthday ${v}`);
    else if (Array.isArray(v)) parts.push(`${k}: ${v.join(" / ")}`);
    else if (v != null && v !== "") parts.push(`${k}: ${String(v)}`);
  }
  return parts;
}

function isInferredOperation(op: Operation, reasoning?: string): boolean {
  if (op.type === "update_relation" && op.attributes.birth_year) return true;
  if (op.type === "add_relation" && op.relation.attributes?.birth_year) return true;
  if (op.type === "update_contact_attributes" && op.attributes.birth_year) return true;
  if (!reasoning) return false;
  const lower = reasoning.toLowerCase();
  if (op.type === "add_relation" && lower.includes(op.relation.name.toLowerCase())) {
    return lower.includes("inferred") || lower.includes("approximate") || lower.includes("yo");
  }
  return false;
}

function chipLabel(op: Operation, resolution?: EntityResolution): string {
  switch (op.type) {
    case "set_field":
      return op.field.replace("_", " ");
    case "add_category":
      return "Category";
    case "add_tag":
      return "Tag";
    case "add_previous":
      return "Was at";
    case "add_relation":
      return "New relation";
    case "update_relation":
      return "Check this · inferred";
    case "update_contact_attributes":
      return "Birthday";
    case "add_interaction":
      return "Timeline";
    case "set_followup":
      return "Follow-up";
    case "set_last_contact":
      return "Last spoke";
    case "create_contact":
      return "New contact";
    case "link_event":
      return resolution?.hint === "new" ? "Create event" : "Link event";
    case "link_organization":
      return resolution?.hint === "new" ? "Create organization" : "Link organization";
    default:
      return "Change";
  }
}

function chipValue(op: Operation, resolution?: EntityResolution): string {
  switch (op.type) {
    case "set_field":
      return op.value;
    case "add_category":
    case "add_tag":
    case "add_previous":
      return op.value;
    case "add_relation": {
      const attrs = op.relation.attributes ?? {};
      const extra = formatAttributes(attrs as Record<string, unknown>);
      const base = `${op.relation.name} · ${op.relation.type}`;
      return extra.length ? `${base} · ${extra.join(", ")}` : base;
    }
    case "update_relation": {
      const parts = formatAttributes(op.attributes as Record<string, unknown>);
      return `${op.match}: ${parts.join(", ")}`;
    }
    case "update_contact_attributes": {
      const parts = formatAttributes(op.attributes as Record<string, unknown>);
      return parts.join(", ") || "details";
    }
    case "add_interaction":
      return `${op.summary} · ${op.date}`;
    case "set_followup":
    case "set_last_contact":
      return op.date;
    case "create_contact":
      return op.name;
    case "link_event":
      return `${resolution?.suggestedName ?? op.event.name} · ${op.link_type}`;
    case "link_organization":
      return `${resolution?.suggestedName ?? op.organization.name} · ${op.link_type}`;
    default:
      return "";
  }
}

export function updateOperationFromChip(chip: ChipState, value: string): Operation {
  const op = chip.operation;
  switch (op.type) {
    case "set_field":
      return { ...op, value };
    case "add_category":
      return { ...op, value: value as typeof op.value };
    case "add_tag":
    case "add_previous":
      return { ...op, value };
    case "add_relation":
      return { ...op, relation: { ...op.relation, name: value } };
    case "update_relation": {
      const birthYear = parseInt(value, 10);
      if (!Number.isNaN(birthYear)) {
        return { ...op, attributes: { ...op.attributes, birth_year: birthYear } };
      }
      return op;
    }
    case "update_contact_attributes": {
      const birthYear = parseInt(value, 10);
      if (!Number.isNaN(birthYear)) {
        return { ...op, attributes: { ...op.attributes, birth_year: birthYear } };
      }
      if (/^\d{2}-\d{2}$/.test(value.trim())) {
        return { ...op, attributes: { ...op.attributes, birthday: value.trim() } };
      }
      return op;
    }
    case "add_interaction":
      return { ...op, summary: value };
    case "set_followup":
    case "set_last_contact":
      return { ...op, date: value };
    case "create_contact":
      return { ...op, name: value };
    default:
      return op;
  }
}

export function buildEntityChoices(chips: ChipState[]): Record<string, { action: EntityAction; id?: string }> {
  const choices: Record<string, { action: EntityAction; id?: string }> = {};
  for (const chip of chips) {
    if (!chip.isEntity) continue;
    choices[chip.id] = {
      action: chip.enabled ? (chip.entityAction ?? "skip") : "skip",
      id: chip.entityAction === "existing" ? chip.entityId : undefined,
    };
  }
  return choices;
}
