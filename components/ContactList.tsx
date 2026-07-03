"use client";

import Link from "next/link";
import { formatCaptureWhen } from "@/lib/dates";

type Capture = {
  id: string;
  rawText: string;
  applied: boolean | null;
  createdAt: Date | string | null;
};

export function RecentCaptures({
  captures,
  onUndo,
}: {
  captures: Capture[];
  onUndo?: (captureId: string) => Promise<void>;
}) {
  if (!captures.length) {
    return <p className="empty">No captures yet. Log your first sentence below.</p>;
  }

  return (
    <>
      <div className="rail">Recent</div>
      {captures.map((cap) => (
        <div className="cap" key={cap.id}>
          <div className="txt">{cap.rawText}</div>
          <div className="meta">
            <span className="tick">
              {cap.applied ? "✓ applied" : "· proposed"}
            </span>
            {cap.applied && onUndo && (
              <button
                type="button"
                className="edit"
                style={{ marginLeft: 0 }}
                onClick={() => onUndo(cap.id)}
              >
                Undo
              </button>
            )}
            <span className="when">{formatCaptureWhen(cap.createdAt)}</span>
          </div>
        </div>
      ))}
    </>
  );
}

export function ContactRow({
  id,
  name,
  company,
  categories,
  age,
  selected,
}: {
  id: string;
  name: string;
  company?: string | null;
  categories?: string[] | null;
  age: string;
  selected?: boolean;
}) {
  return (
    <Link href={`/contacts/${id}`} className={`row${selected ? " on" : ""}`}>
      <span className="nm">{name}</span>
      {company && <span className="co">{company}</span>}
      <span className="cats">
        {(categories ?? []).slice(0, 2).map((cat) => (
          <span className="minitag" key={cat}>{cat}</span>
        ))}
      </span>
      <span className="age">{age}</span>
    </Link>
  );
}
