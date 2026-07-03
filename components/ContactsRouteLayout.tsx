"use client";

import { AppShell } from "@/components/AppShell";
import { ContactListPanel } from "@/components/ContactListPanel";

export function ContactsRouteLayout({
  children,
  contactCount,
}: {
  children: React.ReactNode;
  contactCount: number;
}) {
  return (
    <AppShell count={contactCount}>
      <div className="contacts-route">
        <aside className="contacts-list-pane">
          <ContactListPanel compact />
        </aside>
        <div className="contacts-detail-pane">{children}</div>
      </div>
    </AppShell>
  );
}
