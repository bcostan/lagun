import { db } from "@/db";
import { contacts, events, organizations } from "@/db/schema";
import { nameSimilarity, normalizeName } from "@/lib/normalize";
import type { Operation } from "@/lib/operations";

export async function resolveContactCandidates(text: string, limit = 5): Promise<string[]> {
  const rows = await db.select({ name: contacts.name }).from(contacts);
  const normalizedText = normalizeName(text);

  const scored = rows
    .map((row) => ({
      name: row.name,
      score: Math.max(nameSimilarity(row.name, text), normalizedText.includes(normalizeName(row.name)) ? 0.8 : 0),
    }))
    .filter((r) => r.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((r) => r.name);
}

export async function resolveEventCandidates(text: string, limit = 5): Promise<string[]> {
  const rows = await db.select().from(events);
  const normalizedText = normalizeName(text);

  const scored = rows
    .map((row) => {
      let score = nameSimilarity(row.name, text);
      if (row.series && normalizedText.includes(normalizeName(row.series))) {
        score = Math.max(score, 0.85);
      }
      if (normalizedText.includes(normalizeName(row.name))) {
        score = Math.max(score, 0.9);
      }
      return { name: row.name, score };
    })
    .filter((r) => r.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((r) => r.name);
}

export async function resolveOrganizationCandidates(text: string, limit = 5): Promise<string[]> {
  const rows = await db.select().from(organizations);
  const normalizedText = normalizeName(text);

  const scored = rows
    .map((row) => ({
      name: row.name,
      score: Math.max(nameSimilarity(row.name, text), normalizedText.includes(normalizeName(row.name)) ? 0.85 : 0),
    }))
    .filter((r) => r.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((r) => r.name);
}

export async function findContactByName(name: string) {
  const rows = await db.select().from(contacts);
  const target = normalizeName(name);
  return rows.find((c) => normalizeName(c.name) === target) ?? null;
}

function yearFromName(name: string): number {
  const match = name.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1], 10) : 0;
}

function pickCurrentEdition<T extends { name: string; date: string | null }>(editions: T[]): T {
  return [...editions].sort((a, b) => {
    const yearDiff = yearFromName(b.name) - yearFromName(a.name);
    if (yearDiff !== 0) return yearDiff;
    if (a.date && b.date) return b.date.localeCompare(a.date);
    return 0;
  })[0];
}

export async function findOrganizationByName(name: string) {
  const rows = await db.select().from(organizations);
  const target = normalizeName(name);
  return rows.find((o) => normalizeName(o.name) === target) ?? null;
}

export async function resolveEventForOperation(op: Extract<Operation, { type: "link_event" }>) {
  const allEvents = await db.select().from(events);
  const targetName = normalizeName(op.event.name);

  const exact = allEvents.find((e) => normalizeName(e.name) === targetName);
  if (exact) {
    return {
      hint: "existing" as const,
      suggested: exact,
      matches: [exact],
    };
  }

  const seriesKey = op.event.series ? normalizeName(op.event.series) : targetName;
  const inSeries = allEvents.filter((e) => {
    if (e.series && normalizeName(e.series) === seriesKey) return true;
    return normalizeName(e.name).includes(seriesKey) || seriesKey.includes(normalizeName(e.name));
  });

  if (inSeries.length === 1) {
    return { hint: "existing" as const, suggested: inSeries[0], matches: inSeries };
  }

  if (inSeries.length > 1) {
    const current = pickCurrentEdition(inSeries);
    return {
      hint: op.match_hint === "new" ? ("new" as const) : ("unsure" as const),
      suggested: current,
      matches: inSeries,
    };
  }

  return { hint: "new" as const, suggested: null, matches: [] as typeof allEvents };
}

export async function resolveOrganizationForOperation(
  op: Extract<Operation, { type: "link_organization" }>,
) {
  const allOrgs = await db.select().from(organizations);
  const target = normalizeName(op.organization.name);

  const exact = allOrgs.find((o) => normalizeName(o.name) === target);
  if (exact) {
    return { hint: "existing" as const, suggested: exact, matches: [exact] };
  }

  const close = allOrgs
    .map((o) => ({ org: o, score: nameSimilarity(o.name, op.organization.name) }))
    .filter((r) => r.score >= 0.75)
    .sort((a, b) => b.score - a.score);

  if (close.length === 1) {
    return { hint: "existing" as const, suggested: close[0].org, matches: [close[0].org] };
  }

  if (close.length > 1) {
    return {
      hint: op.match_hint === "new" ? ("new" as const) : ("unsure" as const),
      suggested: close[0].org,
      matches: close.map((r) => r.org),
    };
  }

  return { hint: "new" as const, suggested: null, matches: [] as typeof allOrgs };
}
