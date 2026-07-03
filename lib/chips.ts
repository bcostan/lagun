import type { Operation } from "@/lib/operations";

export type ChipState = {
  id: string;
  operation: Operation;
  enabled: boolean;
  lowConfidence: boolean;
  label: string;
  value: string;
  note?: string;
};

const LOW_CONFIDENCE_THRESHOLD = 0.75;

export function buildChipStates(
  operations: Operation[],
  proposalConfidence: number,
  reasoning?: string,
): ChipState[] {
  return operations.map((op, index) => {
    const id = `${op.type}-${index}`;
    const inScope = op.type !== "link_event" && op.type !== "link_organization";
    const inferred = isInferredOperation(op, reasoning);
    const lowConfidence = inScope && (proposalConfidence < LOW_CONFIDENCE_THRESHOLD || inferred);

    return {
      id,
      operation: op,
      enabled: inScope,
      lowConfidence,
      label: chipLabel(op),
      value: chipValue(op),
      note: !inScope
        ? "Events and organizations are not supported yet"
        : inferred
          ? reasoning || "Inferred from the note, not stated directly"
          : undefined,
    };
  });
}

function isInferredOperation(op: Operation, reasoning?: string): boolean {
  if (op.type === "update_relation" && op.attributes.birth_year) return true;
  if (op.type === "add_relation" && op.relation.attributes?.birth_year) return true;
  if (!reasoning) return false;
  const lower = reasoning.toLowerCase();
  if (op.type === "add_relation" && lower.includes(op.relation.name.toLowerCase())) {
    return lower.includes("inferred") || lower.includes("approximate") || lower.includes("yo");
  }
  return false;
}

function chipLabel(op: Operation): string {
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
    case "add_interaction":
      return "Timeline";
    case "set_followup":
      return "Follow-up";
    case "set_last_contact":
      return "Last spoke";
    case "create_contact":
      return "New contact";
    case "link_event":
      return "New event";
    case "link_organization":
      return "Organization";
    default:
      return "Change";
  }
}

function chipValue(op: Operation): string {
  switch (op.type) {
    case "set_field":
      return op.value;
    case "add_category":
    case "add_tag":
    case "add_previous":
      return op.value;
    case "add_relation":
      return `${op.relation.name} · ${op.relation.type}`;
    case "update_relation": {
      const parts = Object.entries(op.attributes).map(([k, v]) => {
        if (k === "birth_year") return `birth year ≈ ${v}`;
        if (Array.isArray(v)) return `${k}: ${v.join(" / ")}`;
        return `${k}: ${String(v)}`;
      });
      return `${op.match}: ${parts.join(", ")}`;
    }
    case "add_interaction":
      return `${op.summary} · ${op.date}`;
    case "set_followup":
    case "set_last_contact":
      return op.date;
    case "create_contact":
      return op.name;
    case "link_event":
      return `${op.event.name} (${op.link_type})`;
    case "link_organization":
      return `${op.organization.name} (${op.link_type})`;
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
