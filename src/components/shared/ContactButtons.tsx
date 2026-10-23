"use client";

import { Button } from "@/components/ui";
import { copyText } from "@/lib/domain/firmware";
import { mailtoHref, smsHref, whatsappHref } from "@/lib/domain/messages";
import type { MachineProfile } from "@/lib/types";

interface Props {
  profile: MachineProfile | undefined;
  subject: string;
  message: string;
  toast: (msg: string) => void;
  showCopy?: boolean;
}

/** Email / SMS / WhatsApp / copy. Opens the operator's own apps — nothing is sent by the console itself. */
export function ContactButtons({ profile, subject, message, toast, showCopy = false }: Props) {
  const email = profile?.engineer_email ?? "";
  const phone = profile?.engineer_phone ?? "";

  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      <Button
        onClick={() => {
          window.location.href = mailtoHref(email, subject, message);
          if (!email) toast("No engineer email — mail app opened, fill recipient");
        }}
      >
        Email engineer
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          window.location.href = smsHref(phone, message);
          if (!phone) toast("No engineer phone — messaging app opened, fill recipient");
        }}
      >
        SMS
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          const href = whatsappHref(phone, message);
          if (!href) toast("Set engineer phone on the Machines page first");
          else window.open(href, "_blank", "noopener,noreferrer");
        }}
      >
        WhatsApp
      </Button>
      {showCopy && (
        <Button variant="secondary" onClick={async () => toast((await copyText(message)) ? "Report copied" : "Copy failed — select the preview text manually")}>
          Copy text
        </Button>
      )}
    </div>
  );
}
