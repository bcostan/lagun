"use client";

import { useEffect, useState } from "react";
import type { Proposal } from "@/lib/operations";
import { buildChipStates, type ChipState } from "@/lib/chips";
import { OperationChip } from "@/components/OperationChip";

export function ConfirmSheet({
  open,
  rawText,
  proposal,
  candidates,
  loading,
  onCancel,
  onApply,
}: {
  open: boolean;
  rawText: string;
  proposal: Proposal | null;
  candidates: string[];
  loading?: boolean;
  onCancel: () => void;
  onApply: (operations: ChipState["operation"][], targetName: string) => void;
}) {
  const [chips, setChips] = useState<ChipState[]>([]);
  const [targetName, setTargetName] = useState("");

  useEffect(() => {
    if (!proposal) return;
    setChips(buildChipStates(proposal.operations, proposal.confidence, proposal.reasoning));
    setTargetName(proposal.target.name);
  }, [proposal]);

  useEffect(() => {
    if (!open) return;
    const nodes = document.querySelectorAll("#confirm-chips .chip");
    nodes.forEach((node, i) => {
      node.classList.remove("in");
      window.setTimeout(() => node.classList.add("in"), 90 + i * 90);
    });
  }, [open, chips]);

  const enabledCount = chips.filter((c) => c.enabled).length;
  const matchLabel =
    proposal?.target.match_hint === "existing"
      ? "matched existing contact"
      : proposal?.target.match_hint === "new"
        ? "new contact"
        : "unsure match";

  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onCancel} />
      <div className={`sheet ${open ? "show" : ""}`}>
        <div className="grab" />
        <h2>Here&apos;s what I understood</h2>
        <div className="matched">
          <span className="dot" />
          {matchLabel} · {targetName}
          {candidates.length > 1 && (
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
        <div className="chips" id="confirm-chips">
          {chips.map((chip) => (
            <OperationChip
              key={chip.id}
              chip={chip}
              onChange={(next) => setChips((prev) => prev.map((c) => (c.id === next.id ? next : c)))}
            />
          ))}
        </div>
        <div className="sheetfoot">
          <button className="btn ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className="btn apply"
            disabled={loading || !proposal || enabledCount === 0}
            onClick={() =>
              onApply(
                chips.filter((c) => c.enabled).map((c) => c.operation),
                targetName,
              )
            }
          >
            {loading ? "Applying…" : `Apply ${enabledCount} change${enabledCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </>
  );
}
