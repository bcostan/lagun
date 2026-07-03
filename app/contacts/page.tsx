import { ContactsIndex } from "@/components/ContactsIndex";
import { countContacts } from "@/lib/contacts";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contactCount = await countContacts();
  return <ContactsIndex initialCount={contactCount} />;
}
