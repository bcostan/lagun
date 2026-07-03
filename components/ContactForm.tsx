"use client";

import React, { useState } from "react";

const CATEGORIES = [
  "speaker", "client", "prospect", "partner", "investor", "press", "supplier", "friend",
];

export type ContactFormValues = {
  name: string;
  company: string;
  role: string;
  relationship: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  categories: string[];
  lastContact: string;
  nextFollowup: string;
};

export function ContactForm({
  initial,
  submitLabel,
  onSubmit,
  loading,
}: {
  initial: ContactFormValues;
  submitLabel: string;
  onSubmit: (values: ContactFormValues) => Promise<void>;
  loading?: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");

  function setField<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCategory(cat: string) {
    setValues((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="form-field">
          <label>Name</label>
          <input required value={values.name} onChange={(e) => setField("name", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Company</label>
          <input value={values.company} onChange={(e) => setField("company", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Role</label>
          <input value={values.role} onChange={(e) => setField("role", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Relationship</label>
          <select value={values.relationship} onChange={(e) => setField("relationship", e.target.value)}>
            <option value="cold">Cold</option>
            <option value="warm">Warm</option>
            <option value="close">Close</option>
          </select>
        </div>
        <div className="form-field">
          <label>Where</label>
          <input value={values.location} onChange={(e) => setField("location", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Email</label>
          <input type="email" value={values.email} onChange={(e) => setField("email", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Phone</label>
          <input value={values.phone} onChange={(e) => setField("phone", e.target.value)} />
        </div>
        <div className="form-field">
          <label>LinkedIn</label>
          <input value={values.linkedin} onChange={(e) => setField("linkedin", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Last contact</label>
          <input type="date" value={values.lastContact} onChange={(e) => setField("lastContact", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Follow-up</label>
          <input type="date" value={values.nextFollowup} onChange={(e) => setField("nextFollowup", e.target.value)} />
        </div>
        <div className="form-field">
          <label>Categories</label>
          <div className="catrow">
            {CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                className={`cat ${values.categories.includes(cat) ? "accent" : ""}`}
                onClick={() => toggleCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="login-card err">{error}</p>}
      <div className="form-actions">
        <button className="btn apply" type="submit" disabled={loading}>
          {loading ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
