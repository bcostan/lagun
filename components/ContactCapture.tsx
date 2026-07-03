"use client";

import { CaptureFlow } from "@/components/CaptureFlow";

export function ContactCapture({
  contactId,
  contactName,
}: {
  contactId: string;
  contactName: string;
}) {
  const firstName = contactName.split(/\s+/)[0];
  return (
    <CaptureFlow
      contactId={contactId}
      contactName={contactName}
      placeholder={`Write an update about ${firstName}…`}
    />
  );
}
