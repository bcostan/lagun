"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CaptureBar } from "@/components/CaptureBar";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { OverlayPortal } from "@/components/OverlayPortal";
import type { Proposal, Operation } from "@/lib/operations";
import { buildEntityChoices, type ChipState } from "@/lib/chips";
import type { EntityResolution } from "@/lib/resolutions";

export function CaptureFlow({
  contactId,
  contactName,
  placeholder,
  onApplied,
  before,
  after,
}: {
  contactId?: string;
  contactName?: string;
  placeholder?: string;
  onApplied?: () => void;
  before?: ReactNode;
  after?: ReactNode;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [proposing, setProposing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [entityResolutions, setEntityResolutions] = useState<EntityResolution[]>([]);
  const [rawText, setRawText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePropose() {
    const note = text.trim();
    if (!note) return;
    setProposing(true);
    setError(null);
    try {
      const res = await fetch("/api/capture/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note, source: "web" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Propose failed");
      setCaptureId(data.captureId);
      setProposal(
        contactName
          ? { ...data.proposal, target: { name: contactName, match_hint: "existing" as const } }
          : data.proposal,
      );
      setCandidates(
        contactName
          ? [contactName, ...(data.candidates?.contacts ?? []).filter((n: string) => n !== contactName)]
          : (data.candidates?.contacts ?? []),
      );
      setEntityResolutions(data.entityResolutions ?? []);
      setRawText(data.rawText);
      setConfirmOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Propose failed");
    } finally {
      setProposing(false);
    }
  }

  function handleCancel() {
    setConfirmOpen(false);
    setProposal(null);
    setCaptureId(null);
    setRawText("");
    setCandidates([]);
    setEntityResolutions([]);
  }

  async function handleApply(operations: Operation[], targetName: string, chips: ChipState[]) {
    if (!captureId) return;
    const resolvedName = contactName ?? targetName;
    setApplying(true);
    try {
      const res = await fetch("/api/capture/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captureId,
          operations,
          targetName: resolvedName,
          contactId,
          entityChoices: buildEntityChoices(chips),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      handleCancel();
      setText("");
      setToast(`${resolvedName} updated`);
      window.setTimeout(() => setToast(null), 2600);
      if (contactId) {
        router.refresh();
        onApplied?.();
      } else if (data.contact?.id) {
        router.push(`/contacts/${data.contact.id}`);
        router.refresh();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      {before}
      <CaptureBar
        value={text}
        onChange={setText}
        onSubmit={handlePropose}
        loading={proposing}
        placeholder={placeholder}
        error={error}
      />
      {after}

      <ConfirmSheet
        open={confirmOpen}
        rawText={rawText}
        proposal={proposal}
        candidates={candidates}
        entityResolutions={entityResolutions}
        lockedContactName={contactName}
        loading={applying}
        onCancel={handleCancel}
        onApply={handleApply}
      />

      {toast && (
        <OverlayPortal>
          <div className="toast show">
            <span className="t">✓ SAVED</span>
            <span>{toast}</span>
          </div>
        </OverlayPortal>
      )}
    </>
  );
}
