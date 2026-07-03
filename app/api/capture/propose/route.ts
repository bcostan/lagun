import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { captures } from "@/db/schema";
import { extract } from "@/lib/extract";
import { todayISO } from "@/lib/dates";
import { resolveContactCandidates } from "@/lib/resolve";
import { isAuthorized } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const text = body?.text?.trim();
  const source = body?.source === "shortcut" ? "shortcut" : "web";

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const [capture] = await db
    .insert(captures)
    .values({ rawText: text, source })
    .returning();

  try {
    const candidates = await resolveContactCandidates(text);
    const today = todayISO();
    const proposal = await extract(text, today, { contacts: candidates });

    await db
      .update(captures)
      .set({
        proposal,
        confidence: proposal.confidence,
      })
      .where(eq(captures.id, capture.id));

    return NextResponse.json({
      captureId: capture.id,
      rawText: text,
      proposal,
      candidates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: message, captureId: capture.id }, { status: 422 });
  }
}
