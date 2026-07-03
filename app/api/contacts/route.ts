import { NextResponse } from "next/server";
import { createContact, listContacts, type ContactFilter } from "@/lib/contacts";
import { isAuthorized } from "@/lib/auth";

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const filter = (searchParams.get("filter") ?? "all") as ContactFilter;

  const rows = await listContacts({ search, filter });
  return NextResponse.json({ contacts: rows });
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const contact = await createContact(body);
  return NextResponse.json({ contact }, { status: 201 });
}
