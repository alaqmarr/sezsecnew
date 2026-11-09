"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { submitKhidmatRequestAction } from "@/app/actions/public.actions";
import { Button, Input, notify } from "@sezsec/ui";

export function KhidmatFormClient() {
  const { bfcacheId } = useRouter();
  const [resetNonce, setResetNonce] = useState(0);
  const shouldResetOnHideRef = useRef(false);

  useLayoutEffect(() => {
    return () => {
      if (shouldResetOnHideRef.current) {
        shouldResetOnHideRef.current = false;
        setResetNonce((n) => n + 1);
      }
    };
  }, []);

  return (
    <KhidmatFormInner
      key={`${bfcacheId}:${resetNonce}`}
      onSubmitted={() => {
        shouldResetOnHideRef.current = true;
      }}
    />
  );
}

function KhidmatFormInner({ onSubmitted }: { onSubmitted: () => void }) {
  const [miqat, setMiqat] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await submitKhidmatRequestAction({
        miqat,
        name,
        phone,
        date,
      });
      if (!res.ok) {
        notify.error("Could not submit request", res.error);
        return;
      }
      onSubmitted();
      notify.success(
        "Khidmat request submitted",
        "Our committee coordinator will review and get in touch."
      );
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-10 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#166534]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="font-editorial text-3xl font-bold text-[#231917]">
          Shukran! Request Recorded
        </h3>
        <p className="mx-auto max-w-md text-sm text-[#5E4F4A]">
          Your Khidmat invitation for <strong>{miqat}</strong> has been
          received by SEZ Secunderabad.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setMiqat("");
            setName("");
            setPhone("");
            setDate("");
            setSubmitted(false);
          }}
        >
          Submit Another Request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-editorial text-2xl font-bold text-[#231917]">
          Occasion &amp; Host Details
        </h2>
        <p className="text-xs text-[#7B6B63]">
          All fields marked with * are required.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Occasion / Miqaat Name"
          placeholder="e.g. Nikah & Walima Jaman / Misaaq"
          value={miqat}
          onChange={(e) => setMiqat(e.target.value)}
          required
        />
        <Input
          label="Occasion Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="Host / Applicant Full Name"
          placeholder="Enter full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="WhatsApp / Mobile Number"
          placeholder="10-digit mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          icon={<Send className="h-4 w-4" />}
        >
          Submit Khidmat Invitation
        </Button>
      </div>
    </form>
  );
}
