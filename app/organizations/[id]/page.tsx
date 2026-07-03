import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getOrganizationDetail } from "@/lib/graph";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function OrganizationDetailPage({ params }: Params) {
  const { id } = await params;
  const detail = await getOrganizationDetail(id);
  if (!detail) notFound();

  const { organization, links } = detail;

  return (
    <AppShell>
      <section className="screen">
        <Link href="/contacts" className="back">← People</Link>
        <div className="plate">
          <div className="nm">{organization.name}</div>
          {organization.kind && <div className="role">{organization.kind}</div>}
        </div>

        <div className="sec">Everyone linked</div>
        {links.length === 0 ? (
          <p className="empty">No contacts linked to this organization yet.</p>
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
