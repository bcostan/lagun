"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function CaptureBar({
  value,
  onChange,
  onSubmit,
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById("capture-bar-slot"));
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);

  const bar = (
    <div className="bar">
      <div className="barbox">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder="Write what happened…"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className="barrow">
          <span className="hint">
            <svg className="mic" viewBox="0 0 24 24">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
            </svg>
            dictate or type
          </span>
          <button className="go" onClick={onSubmit} disabled={loading || !value.trim()}>
            {loading ? "Parsing…" : "Log it"}
          </button>
        </div>
      </div>
    </div>
  );

  if (slot) return createPortal(bar, slot);
  return null;
}
