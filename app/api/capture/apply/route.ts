import { NextResponse } from "next/server";
import { applyCapture } from "@/lib/apply";
import { isAuthorized } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const captureId = body?.captureId;
  const operations = body?.operations;
  const targetName = body?.targetName;
  const contactId = body?.contactId;

  if (!captureId || !Array.isArray(operations) || !targetName) {
    return NextResponse.json({ error: "captureId, operations, and targetName are required" }, { status: 400 });
  }

  try {
    const contact = await applyCapture({ captureId, operations, targetName, contactId });
    return NextResponse.json({ contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apply failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
