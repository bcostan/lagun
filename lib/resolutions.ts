import type { Operation } from "@/lib/operations";
import {
  resolveEventForOperation,
  resolveOrganizationForOperation,
} from "@/lib/resolve";

export type EntityAction = "existing" | "create" | "skip";

export type EntityResolution = {
  chipId: string;
  opIndex: number;
  entityType: "event" | "organization";
  hint: "existing" | "new" | "unsure";
  defaultAction: EntityAction;
  suggestedId?: string;
  suggestedName?: string;
  options: { id: string; name: string; meta?: string }[];
};

export async function buildEntityResolutions(operations: Operation[]): Promise<EntityResolution[]> {
  const resolutions: EntityResolution[] = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const chipId = `${op.type}-${i}`;

    if (op.type === "link_event") {
      const resolved = await resolveEventForOperation(op);
      const defaultAction: EntityAction =
        resolved.hint === "new" ? "create" : "existing";

      resolutions.push({
        chipId,
        opIndex: i,
        entityType: "event",
        hint: resolved.hint,
        defaultAction,
        suggestedId: resolved.suggested?.id,
        suggestedName: resolved.suggested?.name ?? op.event.name,
        options: resolved.matches.map((e) => ({
          id: e.id,
          name: e.name,
          meta: e.series ?? undefined,
        })),
      });
      continue;
    }

    if (op.type === "link_organization") {
      const resolved = await resolveOrganizationForOperation(op);
      const defaultAction: EntityAction =
        resolved.hint === "new" ? "create" : "existing";

      resolutions.push({
        chipId,
        opIndex: i,
        entityType: "organization",
        hint: resolved.hint,
        defaultAction,
        suggestedId: resolved.suggested?.id,
        suggestedName: resolved.suggested?.name ?? op.organization.name,
        options: resolved.matches.map((o) => ({
          id: o.id,
          name: o.name,
          meta: o.kind ?? undefined,
        })),
      });
    }
  }

  return resolutions;
}

export type EntityChoice = {
  action: EntityAction;
  id?: string;
};
