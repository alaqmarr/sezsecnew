"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Layers,
  Mail,
  Save,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import {
  updateOwnProfileDetailsAction,
  updateOwnSecurityCredentialsAction,
} from "@/app/actions/profile.actions";
import { formatRupees, ROLE_LABELS } from "@sezsec/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  notify,
} from "@sezsec/ui";

interface MemberProfileData {
  id: string;
  username: string;
  name: string;
  email: string;
  mobile: string;
  its: string;
  role: string;
  dob: string;
  quranHifz: string;
  passport: string;
  kunSafar: string;
  occupation: string;
  sports: string;
  monthlyFee: number;
  floorsAsHead: string[];
  floorsAsSubHead: string[];
  floorsAsMember: string[];
  modules: string[];
}

export function ProfileClient({ profile }: { profile: MemberProfileData }) {
  const router = useRouter();

  // Personal profile state
  const [name, setName] = useState(profile.name);
  const [mobile, setMobile] = useState(profile.mobile);
  const [its, setIts] = useState(profile.its);
  const [dob, setDob] = useState(profile.dob);
  const [quranHifz, setQuranHifz] = useState(
    profile.quranHifz || "Nazera / Reading"
  );
  const [passport, setPassport] = useState(profile.passport || "Yes");
  const [kunSafar, setKunSafar] = useState(profile.kunSafar || "No");
  const [occupation, setOccupation] = useState(profile.occupation);
  const [sports, setSports] = useState(profile.sports);
  const [savingProfile, setSavingProfile] = useState(false);

  // Security & OTP state
  const [email, setEmail] = useState(profile.email);
  const [newPassword, setNewPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);

  async function handleSavePersonal(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await updateOwnProfileDetailsAction({
        name,
        mobile,
        its,
        dob,
        quranHifz,
        passport,
        kunSafar,
        occupation,
        sports,
      });
      if (!res.ok) {
        notify.error("Could not update profile", res.error);
        return;
      }
      notify.success("Profile details saved");
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSendOtp() {
    if (!email.trim() || !email.includes("@")) {
      notify.warning("Enter a valid email address first");
      return;
    }
    setSendingOtp(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          purpose: "PROFILE_SECURITY",
          purposeLabel: "Account Email / Password Update",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Failed to send OTP", data?.error);
        return;
      }
      setOtpSent(true);
      notify.success(
        "6-digit OTP sent",
        data.devPreviewCode
          ? `Dev preview code: ${data.devPreviewCode}`
          : `Sent to ${email}`
      );
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleSaveSecurity(e: React.FormEvent) {
    e.preventDefault();
    setSavingSecurity(true);
    try {
      const res = await updateOwnSecurityCredentialsAction({
        email,
        otpCode,
        newPassword: newPassword || undefined,
      });
      if (!res.ok) {
        notify.error("Verification failed", res.error);
        return;
      }
      notify.success("Security credentials updated & synced");
      setOtpCode("");
      setNewPassword("");
      setOtpSent(false);
      router.refresh();
    } finally {
      setSavingSecurity(false);
    }
  }

  return (
    <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left 4 Columns: Identity Card & Assignments */}
      <div className="space-y-6 xl:col-span-4">
        <Card doubleFrame>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#D9C398] bg-[#FBF6EB] font-editorial text-2xl font-bold text-[#6A1B1B]">
                {(profile.name || profile.username).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-[#231917]">
                  {profile.name || profile.username}
                </h2>
                <p className="text-xs text-[#7B6B63]">
                  {ROLE_LABELS[profile.role] || profile.role}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone="maroon">@{profile.username}</Badge>
                  {profile.its ? (
                    <Badge tone="brass">ITS {profile.its}</Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-[#EAE2D6] pt-4 text-xs">
              <div>
                <p className="text-[#8C7B73]">Monthly Contribution</p>
                <p className="mt-0.5 font-bold text-[#231917]">
                  {profile.monthlyFee > 0
                    ? formatRupees(profile.monthlyFee)
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-[#8C7B73]">Registered Email</p>
                <p className="mt-0.5 truncate font-semibold text-[#231917]">
                  {profile.email || "Not linked"}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Layers className="h-4 w-4" />}
            title="Floor & Module Assignments"
            subtitle="Active committee responsibilities"
          />
          <CardBody className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <p className="font-bold uppercase tracking-wider text-[#7B6B63]">
                Floor Hierarchy
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.floorsAsHead.map((f) => (
                  <Badge key={`h-${f}`} tone="maroon">
                    Head • {f}
                  </Badge>
                ))}
                {profile.floorsAsSubHead.map((f) => (
                  <Badge key={`sh-${f}`} tone="brass">
                    Sub-Head • {f}
                  </Badge>
                ))}
                {profile.floorsAsMember.map((f) => (
                  <Badge key={`m-${f}`} tone="neutral">
                    Member • {f}
                  </Badge>
                ))}
                {profile.floorsAsHead.length === 0 &&
                profile.floorsAsSubHead.length === 0 &&
                profile.floorsAsMember.length === 0 ? (
                  <span className="text-[#8C7B73]">No floor assigned yet</span>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5 border-t border-[#EAE2D6] pt-3">
              <p className="font-bold uppercase tracking-wider text-[#7B6B73]">
                Assigned Access Modules
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.role === "ADMIN" ? (
                  <Badge tone="success">Full Administrator Access</Badge>
                ) : profile.modules.length > 0 ? (
                  profile.modules.map((m) => (
                    <Badge key={m} tone="info">
                      {m}
                    </Badge>
                  ))
                ) : (
                  <span className="text-[#8C7B73]">Standard Member Access</span>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Right 8 Columns: Personal Details + OTP Security */}
      <div className="space-y-6 xl:col-span-8">
        <Card>
          <CardHeader
            icon={<UserCircle className="h-4 w-4" />}
            title="Personal & Jamaat Profile"
            subtitle="Changes automatically sync with Jamaat Events (:3333)"
          />
          <CardBody>
            <form onSubmit={handleSavePersonal} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="8-Digit ITS Number"
                  maxLength={8}
                  value={its}
                  onChange={(e) => setIts(e.target.value.replace(/\D/g, ""))}
                />
                <Input
                  label="WhatsApp / Mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
                <Select
                  label="Quran Hifz Status"
                  value={quranHifz}
                  onChange={setQuranHifz}
                  options={[
                    { value: "Hafiz-ul-Quran", label: "Hafiz-ul-Quran" },
                    {
                      value: "Currently Doing Hifz",
                      label: "Currently Doing Hifz",
                    },
                    {
                      value: "Juz Amma / Selected Surahs",
                      label: "Juz Amma / Selected Surahs",
                    },
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
                  label="Karbala / Kun Safar"
                  value={kunSafar}
                  onChange={setKunSafar}
                  options={[
                    { value: "Yes", label: "Yes" },
                    { value: "No", label: "No" },
                  ]}
                />
                <Input
                  label="Occupation / Study"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                />
                <Input
                  label="Sports & Khidmat Skills"
                  value={sports}
                  onChange={(e) => setSports(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={savingProfile}
                  icon={<Save className="h-4 w-4" />}
                >
                  Save Profile Details
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Email & Password Security (OTP Protected)"
            subtitle="Verify via 6-digit email OTP before updating login email or password"
          />
          <CardBody>
            <form onSubmit={handleSaveSecurity} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftAdornment={<Mail className="h-4 w-4" />}
                  required
                />
                <Input
                  label="New Password (Optional)"
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  leftAdornment={<KeyRound className="h-4 w-4" />}
                />
              </div>

              <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-4">
                <div className="w-full sm:w-64">
                  <Input
                    label="6-Digit Verification OTP"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, ""))
                    }
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="brass"
                  loading={sendingOtp}
                  onClick={handleSendOtp}
                >
                  {otpSent ? "Resend OTP Code" : "Send 6-Digit OTP"}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={savingSecurity}
                  disabled={otpCode.length !== 6}
                >
                  Verify &amp; Update Credentials
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
