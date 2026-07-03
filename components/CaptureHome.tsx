"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CaptureBar } from "@/components/CaptureBar";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { RecentCaptures } from "@/components/ContactList";
import type { Proposal } from "@/lib/operations";
import type { Operation } from "@/lib/operations";

type Capture = {
  id: string;
  rawText: string;
  applied: boolean | null;
  createdAt: string | Date | null;
};

export function CaptureHome({
  initialCaptures,
  contactCount,
}: {
  initialCaptures: Capture[];
  contactCount: number;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [captures, setCaptures] = useState(initialCaptures);
  const [proposing, setProposing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [rawText, setRawText] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  async function handlePropose() {
    const note = text.trim();
    if (!note) return;
    setProposing(true);
    try {
      const res = await fetch("/api/capture/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note, source: "web" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Propose failed");
      setCaptureId(data.captureId);
      setProposal(data.proposal);
      setCandidates(data.candidates ?? []);
      setRawText(data.rawText);
      setConfirmOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Propose failed");
    } finally {
      setProposing(false);
    }
  }

  async function handleApply(operations: Operation[], targetName: string) {
    if (!captureId) return;
    setApplying(true);
    try {
      const res = await fetch("/api/capture/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captureId, operations, targetName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      setConfirmOpen(false);
      setText("");
      setToast(`${targetName} updated`);
      setCaptures((prev) => [
        {
          id: captureId,
          rawText,
          applied: true,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      window.setTimeout(() => setToast(null), 2600);
      if (data.contact?.id) {
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
    <AppShell count={contactCount} showBar>
      <section className="screen">
        <div className="lede">Write what happened. <em>Lagun sorts it out.</em></div>
        <div className="sub">
          A sentence about anyone. It finds the person, works out the change, and shows you before saving.
        </div>
        <RecentCaptures
          captures={captures}
          onUndo={async (captureId) => {
            const res = await fetch("/api/capture/undo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ captureId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Undo failed");
            setCaptures((prev) =>
              prev.map((c) => (c.id === captureId ? { ...c, applied: false } : c)),
            );
            router.refresh();
          }}
        />
      </section>

      <CaptureBar
        value={text}
        onChange={setText}
        onSubmit={handlePropose}
        loading={proposing}
      />

      <ConfirmSheet
        open={confirmOpen}
        rawText={rawText}
        proposal={proposal}
        candidates={candidates}
        loading={applying}
        onCancel={() => setConfirmOpen(false)}
        onApply={handleApply}
      />

      <div className={`toast ${toast ? "show" : ""}`}>
        <span className="t">✓ SAVED</span>
        <span>{toast}</span>
      </div>
    </AppShell>
  );
}
