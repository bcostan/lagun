import { NextResponse } from "next/server";
import { undoCapture } from "@/lib/apply";
import { isAuthorized } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const captureId = body?.captureId;

  if (!captureId) {
    return NextResponse.json({ error: "captureId is required" }, { status: 400 });
  }

  try {
    await undoCapture(captureId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Undo failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
