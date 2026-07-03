import { ContactsDesktopPlaceholder } from "@/components/ContactsDesktopPlaceholder";
import { ContactsListPage } from "@/components/ContactsListPage";

export const dynamic = "force-dynamic";

export default function ContactsPage() {
  return (
    <>
      <ContactsListPage />
      <ContactsDesktopPlaceholder />
    </>
  );
}
