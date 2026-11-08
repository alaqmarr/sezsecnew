"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSessionUser } from "@sezsec/auth";
import { fetchBridgeEventById, updateBridgeEventThaals } from "@sezsec/bridge";
import { db, withWriteLock } from "@sezsec/db";
import { UPDATE_THAAL_COUNT_MODULE_ID } from "@sezsec/rbac/rbac.constants";
import { getHallModuleId } from "@sezsec/shared";

export async function submitKhidmatRequestAction(input: {
  miqat: string;
  name: string;
  phone: string;
  date: string;
}): Promise<{ ok: boolean; error?: string }> {
  const miqat = input.miqat.trim();
  const name = input.name.trim();
  const phone = input.phone.trim();
  const parsedDate = new Date(input.date);

  if (!miqat || !name || !phone || Number.isNaN(parsedDate.getTime())) {
    return { ok: false, error: "Please complete all required fields." };
  }

  await withWriteLock(() =>
    db.khidmatRequest.create({
      data: {
        miqat,
        name,
        phone,
        date: parsedDate,
        status: "PENDING",
      },
    })
  );

  revalidatePath("/admin/khidmat");
  return { ok: true };
}

export async function submitMemberRegistrationAction(input: {
  title: string;
  name: string;
  its: string;
  email: string;
  dob: string;
  phone: string;
  quranHifz: string;
  passport: string;
  kunSafar: string;
  occupation: string;
  sports: string;
}): Promise<{ ok: boolean; error?: string }> {
  const its = input.its.trim();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const dob = new Date(input.dob);

  if (!/^\d{8}$/.test(its)) {
    return { ok: false, error: "ITS number must be an exact 8-digit number." };
  }
  if (!name || !email || !phone || Number.isNaN(dob.getTime())) {
    return { ok: false, error: "Please fill in all required personal fields." };
  }

  const [existingReg, existingUser] = await Promise.all([
    db.memberRegistration.findUnique({ where: { its } }),
    db.user.findUnique({ where: { its } }),
  ]);

  if (existingUser) {
    return {
      ok: false,
      error: "An active SEZ member account already exists with this ITS number.",
    };
  }
  if (existingReg) {
    return {
      ok: false,
      error: "An application with this ITS number has already been submitted.",
    };
  }

  await withWriteLock(() =>
    db.memberRegistration.create({
      data: {
        title: input.title.trim() || "Brother",
        name,
        its,
        email,
        dob,
        phone,
        quranHifz: input.quranHifz.trim() || "Reading",
        passport: input.passport.trim() || "No",
        kunSafar: input.kunSafar.trim() || "No",
        occupation: input.occupation.trim() || "Student",
        sports: input.sports.trim() || "None",
        status: "PENDING",
      },
    })
  );

  revalidatePath("/admin/members");
  return { ok: true };
}

export async function updateMenuThaalCountAction(input: {
  eventId: string;
  hallCounts?: Record<string, number>;
  totalOverride?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentSessionUser();
  if (!user) {
    return { ok: false, error: "Please sign in to update thaal counts." };
  }

  const event = await fetchBridgeEventById(input.eventId);
  if (!event) {
    return { ok: false, error: "Event not found on Jamaat Events service." };
  }

  const isGlobalAllowed =
    user.role === "ADMIN" ||
    user.moduleIds.includes(UPDATE_THAAL_COUNT_MODULE_ID);

  const sanitizedHallCounts: Record<string, number> = {};
  if (input.hallCounts) {
    for (const [hallName, rawVal] of Object.entries(input.hallCounts)) {
      const hallModId = getHallModuleId(hallName);
      if (isGlobalAllowed || user.moduleIds.includes(hallModId)) {
        sanitizedHallCounts[hallName] = Math.max(
          0,
          Math.round(Number(rawVal) || 0)
        );
      }
    }
  }

  if (
    !isGlobalAllowed &&
    Object.keys(sanitizedHallCounts).length === 0
  ) {
    return {
      ok: false,
      error: "You do not have permission to update thaal counts for these halls.",
    };
  }

  const payload: {
    hallCounts?: Record<string, number>;
    totalOverride?: number;
    actorId: string;
    actorName: string;
  } = {
    actorId: user.id,
    actorName: user.name || user.username,
  };

  if (Object.keys(sanitizedHallCounts).length > 0) {
    payload.hallCounts = sanitizedHallCounts;
  }
  if (
    user.role === "ADMIN" &&
    input.totalOverride !== undefined &&
    Number.isFinite(input.totalOverride)
  ) {
    payload.totalOverride = Math.max(0, Math.round(input.totalOverride));
  }

  const res = await updateBridgeEventThaals(input.eventId, payload);
  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  revalidatePath("/menu");
  revalidatePath("/");
  return { ok: true };
}
