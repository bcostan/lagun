"use client";

import type { ChipState } from "@/lib/chips";
import { updateOperationFromChip } from "@/lib/chips";
import type { EntityAction } from "@/lib/resolutions";

export function OperationChip({
  chip,
  onChange,
}: {
  chip: ChipState;
  onChange: (chip: ChipState) => void;
}) {
  const entityClass = chip.isEntity ? "entity" : "";

  function setEntityAction(action: EntityAction, id?: string) {
    onChange({
      ...chip,
      enabled: action !== "skip",
      entityAction: action,
      entityId: id,
    });
  }

  return (
    <div
      className={`chip in ${chip.lowConfidence ? "review" : ""} ${entityClass} ${!chip.enabled ? "skipped" : ""}`}
    >
      <div className="bar-l" />
      <div className="body">
        <div className="k">{chip.label}</div>

        {chip.isEntity && chip.entityResolution ? (
          <>
            <div className="v" dangerouslySetInnerHTML={{ __html: formatValue(chip.value) }} />
            {chip.note && <div className="note">{chip.note}</div>}
            <div className="entity-actions">
              {chip.entityResolution.hint !== "new" && chip.entityResolution.options.length > 0 && (
                <select
                  value={chip.entityAction === "create" ? "__create__" : (chip.entityId ?? "")}
                  onChange={(e) => {
                    if (e.target.value === "__create__") {
                      setEntityAction("create");
                    } else if (e.target.value === "__skip__") {
                      setEntityAction("skip");
                    } else {
                      setEntityAction("existing", e.target.value);
                    }
                  }}
                >
                  {chip.entityResolution.options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}{opt.meta ? ` · ${opt.meta}` : ""} (existing)
                    </option>
                  ))}
                  <option value="__create__">
                    Create {chip.entityResolution.entityType === "event" ? chip.entityResolution.suggestedName : chip.entityResolution.suggestedName} (new)
                  </option>
                  <option value="__skip__">Skip</option>
                </select>
              )}
              {chip.entityResolution.hint === "new" && (
                <div className="entity-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={chip.enabled}
                      onChange={(e) => setEntityAction(e.target.checked ? "create" : "skip")}
                    />
                    {" "}Add to Lagun
                  </label>
                </div>
              )}
            </div>
          </>
        ) : chip.operation.type === "set_field" ? (
          <input
            value={chip.operation.value}
            disabled={!chip.enabled}
            onChange={(e) =>
              onChange({
                ...chip,
                operation: updateOperationFromChip(chip, e.target.value),
                value: e.target.value,
              })
            }
          />
        ) : chip.operation.type === "update_relation" || chip.operation.type === "update_contact_attributes" ? (
          <>
            <div className="v">
              {chip.operation.type === "update_relation" ? (
                <>{chip.operation.match}&apos;s birth year <b>≈ {String(chip.operation.attributes.birth_year)}</b></>
              ) : (
                <>
                  {chip.operation.attributes.birthday && (
                    <>Birthday <b>{String(chip.operation.attributes.birthday)}</b></>
                  )}
                  {chip.operation.attributes.birth_year && (
                    <> · birth year <b>≈ {String(chip.operation.attributes.birth_year)}</b></>
                  )}
                </>
              )}
            </div>
            {chip.note && <div className="note">{chip.note}</div>}
            {chip.operation.attributes.birth_year != null && (
              <input
                inputMode="numeric"
                placeholder="Birth year"
                value={String(chip.operation.attributes.birth_year ?? "")}
                disabled={!chip.enabled}
                onChange={(e) =>
                  onChange({
                    ...chip,
                    operation: updateOperationFromChip(chip, e.target.value),
                    value: e.target.value,
                  })
                }
              />
            )}
          </>
        ) : chip.operation.type === "add_relation" && chip.operation.relation.attributes?.birth_year ? (
          <>
            <div className="v" dangerouslySetInnerHTML={{ __html: formatValue(chip.value) }} />
            {chip.note && <div className="note">{chip.note}</div>}
            <input
              inputMode="numeric"
              placeholder="Birth year"
              value={String(chip.operation.relation.attributes.birth_year ?? "")}
              disabled={!chip.enabled}
              onChange={(e) => {
                const op = chip.operation;
                if (op.type !== "add_relation") return;
                const birthYear = parseInt(e.target.value, 10);
                onChange({
                  ...chip,
                  operation: {
                    ...op,
                    relation: {
                      ...op.relation,
                      attributes: {
                        ...op.relation.attributes,
                        birth_year: Number.isNaN(birthYear) ? op.relation.attributes?.birth_year : birthYear,
                      },
                    },
                  },
                  value: e.target.value,
                });
              }}
            />
          </>
        ) : (
          <>
            <div className="v" dangerouslySetInnerHTML={{ __html: formatValue(chip.value) }} />
            {chip.note && <div className="note">{chip.note}</div>}
          </>
        )}
      </div>
    </div>
  );
}

function formatValue(value: string): string {
  const parts = value.split(" · ");
  if (parts.length === 1) return `<b>${escapeHtml(value)}</b>`;
  return `<b>${escapeHtml(parts[0])}</b> · ${escapeHtml(parts.slice(1).join(" · "))}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
