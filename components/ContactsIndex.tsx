"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ContactRow } from "@/components/ContactList";
import { formatRelativeDate } from "@/lib/dates";
import type { ContactFilter } from "@/lib/contacts";

type Contact = {
  id: string;
  name: string;
  company: string | null;
  categories: string[] | null;
  lastContact: string | null;
};

const FILTERS: { id: ContactFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "followups_due", label: "Follow-ups due" },
  { id: "due_this_week", label: "Due this week" },
  { id: "gone_quiet", label: "Gone quiet" },
  { id: "category:speaker", label: "Speakers" },
  { id: "category:client", label: "Clients" },
  { id: "category:investor", label: "Investors" },
  { id: "untriaged", label: "Untriaged" },
  { id: "to_review", label: "To review" },
];

export function ContactsIndex({ initialCount }: { initialCount: number }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (filter !== "all") params.set("filter", filter);
    return params.toString();
  }, [search, filter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/contacts?${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setContacts(data.contacts ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <AppShell count={initialCount}>
      <section className="screen">
        <div className="idxhead">People</div>
        <input
          className="search-input"
          placeholder="Search names, companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`fil ${filter === f.id ? "on" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <Link href="/contacts/new" className="fil">+ Add person</Link>
        </div>
        {loading ? (
          <p className="empty">Loading…</p>
        ) : contacts.length === 0 ? (
          <p className="empty">No people match. Try another filter or add someone manually.</p>
        ) : (
          contacts.map((c) => (
            <ContactRow
              key={c.id}
              id={c.id}
              name={c.name}
              company={c.company}
              categories={c.categories}
              age={formatRelativeDate(c.lastContact)}
            />
          ))
        )}
      </section>
    </AppShell>
  );
}
