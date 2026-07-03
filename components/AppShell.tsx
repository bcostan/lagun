"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const captureIcon = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const peopleIcon = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

export function AppShell({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  const pathname = usePathname();
  const onCapture = pathname === "/";
  const onContacts = pathname.startsWith("/contacts");

  return (
    <div className="app">
      <aside className="sidebar">
        <span className="wordmark">Lagun</span>
        <nav className="sidebar-nav">
          <Link href="/" className={`sidebar-link ${onCapture ? "on" : ""}`}>
            {captureIcon}
            Capture
          </Link>
          <Link href="/contacts" className={`sidebar-link ${onContacts ? "on" : ""}`}>
            {peopleIcon}
            People
          </Link>
        </nav>
        {typeof count === "number" && (
          <span className="sidebar-count">
            {count} {count === 1 ? "person" : "people"}
          </span>
        )}
      </aside>

      <div className="app-main">
        <div className="top">
          <span className="wordmark">Lagun</span>
          {typeof count === "number" && (
            <span className="count">{count} {count === 1 ? "person" : "people"}</span>
          )}
        </div>

        <div className="screens">{children}</div>

        <div id="overlay-slot" aria-hidden="true" />

        <div className="tabs">
          <Link href="/" className={`tab ${onCapture ? "on" : ""}`}>
            {captureIcon}
            Capture
          </Link>
          <Link href="/contacts" className={`tab ${onContacts ? "on" : ""}`}>
            {peopleIcon}
            People
          </Link>
        </div>
      </div>
    </div>
  );
}
