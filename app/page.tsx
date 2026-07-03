import { CaptureHome } from "@/components/CaptureHome";
import { countContacts, listRecentCaptures } from "@/lib/contacts";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [captures, contactCount] = await Promise.all([
    listRecentCaptures(10),
    countContacts(),
  ]);

  return (
    <CaptureHome
      contactCount={contactCount}
      initialCaptures={captures.map((c) => ({
        id: c.id,
        rawText: c.rawText,
        applied: c.applied,
        createdAt: c.createdAt,
      }))}
    />
  );
}
