"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getCurrentSessionUser, verifyEmailOtp } from "@sezsec/auth";
import { syncUserByIdToJamatevents } from "@sezsec/bridge";
import { db, withWriteLock } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";

export async function updateOwnProfileDetailsAction(input: {
  name: string;
  mobile: string;
  its: string;
  dob?: string;
  quranHifz?: string;
  passport?: string;
  kunSafar?: string;
  occupation?: string;
  sports?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getCurrentSessionUser();
  if (!session) {
    return { ok: false, error: "Please sign in first." };
  }

  const cleanIts = input.its.trim() || null;
  if (cleanIts && !/^\d{8}$/.test(cleanIts)) {
    return { ok: false, error: "ITS number must be 8 digits." };
  }

  if (cleanIts) {
    const conflict = await db.user.findUnique({ where: { its: cleanIts } });
    if (conflict && conflict.id !== session.id) {
      return {
        ok: false,
        error: "That ITS number is already assigned to another member.",
      };
    }
  }

  const parsedDob = input.dob ? new Date(input.dob) : null;

  await withWriteLock(() =>
    db.user.update({
      where: { id: session.id },
      data: {
        name: input.name.trim() || null,
        mobile: input.mobile.trim() || null,
        its: cleanIts,
        dob:
          parsedDob && !Number.isNaN(parsedDob.getTime()) ? parsedDob : null,
        quranHifz: input.quranHifz?.trim() || null,
        passport: input.passport?.trim() || null,
        kunSafar: input.kunSafar?.trim() || null,
        occupation: input.occupation?.trim() || null,
        sports: input.sports?.trim() || null,
        profileStatus: "COMPLETED",
      },
    })
  );

  await syncUserByIdToJamatevents(session.id);
  await recordActivity({
    action: "PROFILE_UPDATED",
    summary: `${input.name || session.username} updated their member profile`,
    userId: session.id,
    userName: input.name || session.username,
  });

  revalidatePath("/profile");
  return { ok: true };
}

export async function updateOwnSecurityCredentialsAction(input: {
  email: string;
  otpCode: string;
  newPassword?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getCurrentSessionUser();
  if (!session) {
    return { ok: false, error: "Please sign in first." };
  }

  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const otpRes = await verifyEmailOtp({
    email: cleanEmail,
    code: input.otpCode,
    purpose: "PROFILE_SECURITY",
  });
  if (!otpRes.ok) {
    return { ok: false, error: otpRes.error || "Invalid verification code." };
  }

  const updateData: { email: string; password?: string } = {
    email: cleanEmail,
  };

  if (input.newPassword && input.newPassword.trim()) {
    if (input.newPassword.trim().length < 6) {
      return {
        ok: false,
        error: "New password must be at least 6 characters.",
      };
    }
    updateData.password = await bcrypt.hash(input.newPassword.trim(), 10);
  }

  await withWriteLock(() =>
    db.user.update({
      where: { id: session.id },
      data: updateData,
    })
  );

  await syncUserByIdToJamatevents(session.id);
  await recordActivity({
    action: "SECURITY_CREDENTIALS_UPDATED",
    summary: `${session.name || session.username} updated security credentials via OTP`,
    userId: session.id,
    userName: session.name || session.username,
  });

  revalidatePath("/profile");
  return { ok: true };
}
