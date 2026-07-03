import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getEventDetail } from "@/lib/graph";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function EventDetailPage({ params }: Params) {
  const { id } = await params;
  const detail = await getEventDetail(id);
  if (!detail) notFound();

  const { event, links } = detail;

  return (
    <AppShell>
      <section className="screen">
        <Link href="/contacts" className="back">← People</Link>
        <div className="plate">
          <div className="nm">{event.name}</div>
          <div className="role">
            {[event.series, event.location, event.date].filter(Boolean).join(" · ")}
          </div>
        </div>

        <div className="sec">Everyone linked</div>
        {links.length === 0 ? (
          <p className="empty">No contacts linked to this event yet.</p>
        ) : (
          <div className="people">
            {links.map(({ link, contact }) => (
              <Link href={`/contacts/${contact.id}`} className="person" key={link.id}>
                <span className="who">{contact.name}</span>
                <span className="rel">{link.linkType}</span>
                {contact.company && <span className="extra">{contact.company}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
