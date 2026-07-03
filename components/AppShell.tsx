"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppShell({
  children,
  count,
  showBar = false,
}: {
  children: React.ReactNode;
  count?: number;
  showBar?: boolean;
}) {
  const pathname = usePathname();
  const onCapture = pathname === "/";
  const onContacts = pathname.startsWith("/contacts");

  return (
    <div className="app">
      <div className="top">
        <span className="wordmark">Lagun</span>
        {typeof count === "number" && (
          <span className="count">{count} {count === 1 ? "person" : "people"}</span>
        )}
      </div>

      <div className="screens" style={{ paddingBottom: showBar ? 130 : 80 }}>
        {children}
      </div>

      {showBar ? <div id="capture-bar-slot" /> : null}

      <div className="tabs">
        <Link href="/" className={`tab ${onCapture ? "on" : ""}`}>
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Capture
        </Link>
        <Link href="/contacts" className={`tab ${onContacts ? "on" : ""}`}>
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
          People
        </Link>
      </div>
    </div>
  );
}
