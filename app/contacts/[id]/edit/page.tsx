"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ContactForm, type ContactFormValues } from "@/components/ContactForm";

export default function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  const [initial, setInitial] = useState<ContactFormValues | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    params.then(async ({ id: contactId }) => {
      setId(contactId);
      const res = await fetch(`/api/contacts/${contactId}`);
      const data = await res.json();
      const c = data.contact;
      if (!c) throw new Error("Contact not found");
      setInitial({
        name: c.name ?? "",
        company: c.company ?? "",
        role: c.role ?? "",
        relationship: c.relationship ?? "cold",
        location: c.location ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        linkedin: c.linkedin ?? "",
        categories: c.categories ?? [],
        lastContact: c.lastContact ?? "",
        nextFollowup: c.nextFollowup ?? "",
      });
    });
  }, [params]);

  async function handleSubmit(values: ContactFormValues) {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        lastContact: values.lastContact || null,
        nextFollowup: values.nextFollowup || null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) throw new Error(data.error ?? "Update failed");
    router.push(`/contacts/${id}`);
    router.refresh();
  }

  return (
    <AppShell>
      <section className="screen">
        <Link href={id ? `/contacts/${id}` : "/contacts"} className="back">← Back</Link>
        <div className="idxhead">Edit person</div>
        {initial ? (
          <ContactForm initial={initial} submitLabel="Save changes" onSubmit={handleSubmit} loading={loading} />
        ) : (
          <p className="empty">Loading…</p>
        )}
      </section>
    </AppShell>
  );
}
