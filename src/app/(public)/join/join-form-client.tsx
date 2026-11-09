"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, UserPlus } from "lucide-react";
import { submitMemberRegistrationAction } from "@/app/actions/public.actions";
import { Button, Input, Select, notify } from "@sezsec/ui";

export function JoinFormClient() {
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
    <JoinFormInner
      key={`${bfcacheId}:${resetNonce}`}
      onSubmitted={() => {
        shouldResetOnHideRef.current = true;
      }}
    />
  );
}

function JoinFormInner({ onSubmitted }: { onSubmitted: () => void }) {
  const [title, setTitle] = useState("Brother");
  const [name, setName] = useState("");
  const [its, setIts] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [quranHifz, setQuranHifz] = useState("Nazera / Reading");
  const [passport, setPassport] = useState("Yes");
  const [kunSafar, setKunSafar] = useState("No");
  const [occupation, setOccupation] = useState("");
  const [sports, setSports] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await submitMemberRegistrationAction({
        title,
        name,
        its,
        email,
        dob,
        phone,
        quranHifz,
        passport,
        kunSafar,
        occupation,
        sports,
      });
      if (!res.ok) {
        notify.error("Registration failed", res.error);
        return;
      }
      onSubmitted();
      notify.success("Application submitted to SEZ Secunderabad");
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="py-12 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#166534]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="font-editorial text-3xl font-bold text-[#231917]">
          Application Received
        </h3>
        <p className="mx-auto max-w-md text-sm text-[#5E4F4A]">
          JazakAllah Khair, <strong>{name}</strong> (ITS {its}). The SEZ
          Committee Secretariat will review your registration shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select
          label="Title"
          value={title}
          onChange={setTitle}
          options={[
            { value: "Brother", label: "Brother" },
            { value: "Mulla", label: "Mulla" },
            { value: "Shaikh", label: "Shaikh" },
            { value: "Dr.", label: "Dr." },
          ]}
        />
        <Input
          label="Full Name"
          placeholder="As per ITS card"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="sm:col-span-1"
        />
        <Input
          label="8-Digit ITS Number"
          placeholder="e.g. 30405060"
          maxLength={8}
          value={its}
          onChange={(e) => setIts(e.target.value.replace(/\D/g, ""))}
          required
        />
        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="WhatsApp Mobile"
          placeholder="10-digit mobile"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <Input
          label="Date of Birth"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          required
        />
        <Select
          label="Quran-e-Majeed Hifz"
          value={quranHifz}
          onChange={setQuranHifz}
          options={[
            { value: "Hafiz-ul-Quran", label: "Hafiz-ul-Quran" },
            { value: "Currently Doing Hifz", label: "Currently Doing Hifz" },
            { value: "Juz Amma / Selected Surahs", label: "Juz Amma / Selected Surahs" },
            { value: "Nazera / Reading", label: "Nazera / Reading" },
          ]}
        />
        <Select
          label="Valid Passport"
          value={passport}
          onChange={setPassport}
          options={[
            { value: "Yes", label: "Yes" },
            { value: "No", label: "No" },
            { value: "Applied / Renewal", label: "Applied / Renewal" },
          ]}
        />
        <Select
          label="Karbala / Kun Safar Done?"
          value={kunSafar}
          onChange={setKunSafar}
          options={[
            { value: "Yes", label: "Yes" },
            { value: "No", label: "No" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Occupation / Business / Field of Study"
          placeholder="e.g. Business, Software Engineer, B.Com Student"
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          required
        />
        <Input
          label="Sports & Khidmat Interests"
          placeholder="e.g. Cricket, Badminton, Audio/Visual, Intezam"
          value={sports}
          onChange={(e) => setSports(e.target.value)}
          required
        />
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          icon={<UserPlus className="h-4 w-4" />}
        >
          Submit Membership Application
        </Button>
      </div>
    </form>
  );
}
