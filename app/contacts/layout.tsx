import { ContactsRouteLayout } from "@/components/ContactsRouteLayout";
import { countContacts } from "@/lib/contacts";

export const dynamic = "force-dynamic";

export default async function ContactsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const contactCount = await countContacts();
  return (
    <ContactsRouteLayout contactCount={contactCount}>
      {children}
    </ContactsRouteLayout>
  );
}
