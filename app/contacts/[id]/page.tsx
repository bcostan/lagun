import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactCapture } from "@/components/ContactCapture";
import { getContactDetail } from "@/lib/contacts";
import { formatRelativeDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function ContactDetailPage({ params }: Params) {
  const { id } = await params;
  const detail = await getContactDetail(id);
  if (!detail) notFound();

  const { contact, relations, interactions, captures, events: linkedEvents, organizations: linkedOrgs } = detail;
  const roleLine = [contact.role, contact.company].filter(Boolean).join(", ");

  return (
    <section className="screen">
      <Link href="/contacts" className="back mobile-only">← Index</Link>
        <div className="plate">
          <div className="nm">{contact.name}</div>
          {roleLine && <div className="role">{roleLine}</div>}
        </div>

        <div className="catrow">
          {(contact.categories ?? []).map((cat) => (
            <span className="cat accent" key={cat}>{cat}</span>
          ))}
          {(contact.tags ?? []).map((tag) => (
            <span className="cat" key={tag}>{tag}</span>
          ))}
        </div>

        <ContactCapture contactId={contact.id} contactName={contact.name} />

        <div style={{ marginTop: 4, marginBottom: 8 }}>
          <Link href={`/contacts/${contact.id}/edit`} className="fil">Edit</Link>
        </div>

        <div className="fields">
          {contact.location && (
            <div className="field"><div className="lab">Where</div><div className="val">{contact.location}</div></div>
          )}
          {contact.email && (
            <div className="field"><div className="lab">Email</div><div className="val"><a href={`mailto:${contact.email}`}>{contact.email}</a></div></div>
          )}
          {contact.phone && (
            <div className="field"><div className="lab">Phone</div><div className="val">{contact.phone}</div></div>
          )}
          {contact.linkedin && (
            <div className="field"><div className="lab">LinkedIn</div><div className="val"><a href={contact.linkedin} target="_blank" rel="noreferrer">{contact.linkedin}</a></div></div>
          )}
          {(contact.previous ?? []).map((item) => (
            <div className="field" key={item}><div className="lab">Was at</div><div className="val">{item}</div></div>
          ))}
          <div className="field">
            <div className="lab">Last spoke</div>
            <div className="val">{formatRelativeDate(contact.lastContact)}</div>
          </div>
          <div className="field">
            <div className="lab">Follow-up</div>
            <div className={`val ${contact.nextFollowup ? "due" : ""}`}>
              {contact.nextFollowup ?? "not set"}
            </div>
          </div>
        </div>

        {linkedEvents.length > 0 && (
          <>
            <div className="sec">Events</div>
            <div className="people">
              {linkedEvents.map(({ link, event }) => (
                <Link href={`/events/${event.id}`} className="person" key={link.id}>
                  <span className="who">{event.name}</span>
                  <span className="rel">{link.linkType}</span>
                  {event.series && <span className="extra">{event.series}</span>}
                </Link>
              ))}
            </div>
          </>
        )}

        {linkedOrgs.length > 0 && (
          <>
            <div className="sec">Organizations</div>
            <div className="people">
              {linkedOrgs.map(({ link, organization }) => (
                <Link href={`/organizations/${organization.id}`} className="person" key={link.id}>
                  <span className="who">{organization.name}</span>
                  <span className="rel">{link.linkType}</span>
                  {organization.kind && <span className="extra">{organization.kind}</span>}
                </Link>
              ))}
            </div>
          </>
        )}

        {relations.length > 0 && (
          <>
            <div className="sec">People</div>
            <div className="people">
              {relations.map((rel) => {
                const attrs = rel.attributes as { birth_year?: number; activities?: string[] };
                const extra = [
                  attrs.birth_year ? `${new Date().getFullYear() - attrs.birth_year}` : null,
                  attrs.activities?.join(" / "),
                ].filter(Boolean).join(", ");
                return (
                  <div className="person" key={rel.id}>
                    <span className="who">{rel.name}</span>
                    <span className="rel">{rel.type}</span>
                    {extra && <span className="extra">{extra}</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="sec">Timeline</div>
        {interactions.length === 0 ? (
          <p className="empty">No interactions yet.</p>
        ) : (
          <div className="tl">
            {interactions.map((item) => {
              const rel = relations.find((r) => r.id === item.relationId);
              return (
                <div className="ev" key={item.id}>
                  <div className="d">{item.date ?? "—"}</div>
                  <div className="s">
                    {item.summary}
                    {rel && <span className="tagp">{rel.name}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {captures.length > 0 && (
          <details className="raw" open>
            <summary>Raw captures ({captures.length})</summary>
            {captures.map((cap) => (
              <div className="rawitem" key={cap.id}>{cap.rawText}</div>
            ))}
          </details>
        )}
      </section>
  );
}
