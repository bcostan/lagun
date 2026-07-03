"use client";

import type { ChipState } from "@/lib/chips";
import { updateOperationFromChip } from "@/lib/chips";

export function OperationChip({
  chip,
  onChange,
}: {
  chip: ChipState;
  onChange: (chip: ChipState) => void;
}) {
  return (
    <div
      className={`chip in ${chip.lowConfidence ? "review" : ""} ${!chip.enabled ? "unsupported skipped" : ""}`}
    >
      <div className="bar-l" />
      <div className="body">
        <div className="k">{chip.label}</div>
        {chip.operation.type === "set_field" ? (
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
        ) : chip.operation.type === "update_relation" ? (
          <>
            <div className="v">
              {chip.operation.match}&apos;s birth year <b>≈ {String(chip.operation.attributes.birth_year)}</b>
            </div>
            {chip.note && <div className="note">{chip.note}</div>}
            <input
              inputMode="numeric"
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
