"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CaptureFlow } from "@/components/CaptureFlow";
import { RecentCaptures } from "@/components/ContactList";

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
  const [captures, setCaptures] = useState(initialCaptures);

  return (
    <AppShell count={contactCount}>
      <section className="screen">
        <CaptureFlow
          before={(
            <>
              <div className="lede">Write what happened. <em>Lagun sorts it out.</em></div>
              <div className="sub">
                A sentence about anyone. It finds the person, works out the change, and shows you before saving.
              </div>
            </>
          )}
          after={(
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
          )}
        />
      </section>
    </AppShell>
  );
}
