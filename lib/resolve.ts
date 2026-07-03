import { db } from "@/db";
import { contacts } from "@/db/schema";
import { nameSimilarity, normalizeName } from "@/lib/normalize";

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

export async function findContactByName(name: string) {
  const rows = await db.select().from(contacts);
  const target = normalizeName(name);
  return rows.find((c) => normalizeName(c.name) === target) ?? null;
}
