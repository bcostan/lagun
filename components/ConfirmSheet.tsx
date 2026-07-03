"use client";

import { useEffect, useState } from "react";
import type { Proposal } from "@/lib/operations";
import { buildChipStates, type ChipState } from "@/lib/chips";
import type { EntityResolution } from "@/lib/resolutions";
import { OperationChip } from "@/components/OperationChip";
import { OverlayPortal } from "@/components/OverlayPortal";

export function ConfirmSheet({
  open,
  rawText,
  proposal,
  candidates,
  entityResolutions,
  lockedContactName,
  loading,
  onCancel,
  onApply,
}: {
  open: boolean;
  rawText: string;
  proposal: Proposal | null;
  candidates: string[];
  entityResolutions: EntityResolution[];
  lockedContactName?: string;
  loading?: boolean;
  onCancel: () => void;
  onApply: (
    operations: ChipState["operation"][],
    targetName: string,
    chips: ChipState[],
  ) => void;
}) {
  const [chips, setChips] = useState<ChipState[]>([]);
  const [targetName, setTargetName] = useState("");

  useEffect(() => {
    if (!proposal) return;
    setChips(buildChipStates(
      proposal.operations,
      proposal.confidence,
      proposal.reasoning,
      entityResolutions,
    ));
    setTargetName(lockedContactName ?? proposal.target.name);
  }, [proposal, entityResolutions, lockedContactName]);

  useEffect(() => {
    if (!open) return;
    const nodes = document.querySelectorAll("#confirm-chips .chip");
    nodes.forEach((node, i) => {
      node.classList.remove("in");
      window.setTimeout(() => node.classList.add("in"), 90 + i * 90);
    });
  }, [open, chips]);

  if (!open || !proposal) return null;

  const fieldChips = chips.filter((c) => !c.isEntity);
  const entityChips = chips.filter((c) => c.isEntity);
  const enabledCount = chips.filter((c) => c.enabled).length;

  const matchLabel = lockedContactName
    ? "updating this contact"
    : proposal.target.match_hint === "existing"
      ? "matched existing contact"
      : proposal.target.match_hint === "new"
        ? "new contact"
        : "unsure match";

  return (
    <OverlayPortal>
      <div className="scrim show" onClick={onCancel} />
      <div className="sheet show">
        <div className="grab" />
        <h2>Here&apos;s what I understood</h2>
        <div className="matched">
          <span className="dot" />
          {matchLabel} · {lockedContactName ?? targetName}
          {!lockedContactName && candidates.length > 1 && (
            <select
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              style={{ marginLeft: 8, fontFamily: "var(--mono)", fontSize: 11 }}
            >
              {candidates.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="echo">{rawText}</div>

        {fieldChips.length > 0 && (
          <>
            <div className="rail">Changes</div>
            <div className="chips" id="confirm-chips">
              {fieldChips.map((chip) => (
                <OperationChip
                  key={chip.id}
                  chip={chip}
                  onChange={(next) => setChips((prev) => prev.map((c) => (c.id === next.id ? next : c)))}
                />
              ))}
            </div>
          </>
        )}

        {entityChips.length > 0 && (
          <>
            <div className="rail">Events & organizations</div>
            <div className="chips">
              {entityChips.map((chip) => (
                <OperationChip
                  key={chip.id}
                  chip={chip}
                  onChange={(next) => setChips((prev) => prev.map((c) => (c.id === next.id ? next : c)))}
                />
              ))}
            </div>
          </>
        )}

        {enabledCount === 0 && (
          <p className="empty">Nothing to apply from this note. Cancel and try rephrasing.</p>
        )}

        <div className="sheetfoot">
          <button className="btn ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className="btn apply"
            disabled={loading || enabledCount === 0}
            onClick={() =>
              onApply(
                chips.filter((c) => c.enabled).map((c) => c.operation),
                targetName,
                chips,
              )
            }
          >
            {loading ? "Applying…" : `Apply ${enabledCount} change${enabledCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
}
