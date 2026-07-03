"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ContactForm, type ContactFormValues } from "@/components/ContactForm";

const empty: ContactFormValues = {
  name: "",
  company: "",
  role: "",
  relationship: "cold",
  location: "",
  email: "",
  phone: "",
  linkedin: "",
  categories: [],
  lastContact: "",
  nextFollowup: "",
};

export default function NewContactPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: ContactFormValues) {
    setLoading(true);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        lastContact: values.lastContact || null,
        nextFollowup: values.nextFollowup || null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) throw new Error(data.error ?? "Create failed");
    router.push(`/contacts/${data.contact.id}`);
  }

  return (
    <AppShell>
      <section className="screen">
        <Link href="/contacts" className="back">← Index</Link>
        <div className="idxhead">Add person</div>
        <ContactForm initial={empty} submitLabel="Add person" onSubmit={handleSubmit} loading={loading} />
      </section>
    </AppShell>
  );
}
