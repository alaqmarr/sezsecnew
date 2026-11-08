import bcrypt from "bcryptjs";
import { db, withWriteLock } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import { readSessionTokenPayload, setSessionCookie } from "./session.helper";
import type { SessionUser } from "./auth.types";

export async function authenticateMemberCredentials(
  identifier: string,
  password: string
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const trimmedId = identifier.trim();
  if (!trimmedId || !password) {
    return { ok: false, error: "Please enter your ITS / Username and password." };
  }

  const user = await db.user.findFirst({
    where: {
      OR: [{ username: trimmedId }, { its: trimmedId }],
    },
    include: {
      moduleAccess: { select: { moduleId: true } },
      floorHeadOf: { select: { id: true } },
      floorSubHeadOf: { select: { id: true } },
    },
  });

  if (!user) {
    return { ok: false, error: "Invalid ITS / Username or password." };
  }

  let valid = false;
  if (user.password.startsWith("$2")) {
    valid = await bcrypt.compare(password, user.password);
  } else {
    valid = user.password === password;
    if (valid) {
      const upgradedHash = await bcrypt.hash(password, 10);
      await withWriteLock(() =>
        db.user.update({
          where: { id: user.id },
          data: { password: upgradedHash },
        })
      );
    }
  }

  if (!valid) {
    return { ok: false, error: "Invalid ITS / Username or password." };
  }

  await setSessionCookie({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  const sessionUser: SessionUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    its: user.its,
    role: user.role,
    profileStatus: user.profileStatus,
    moduleIds: user.moduleAccess.map((m) => m.moduleId),
    isFloorLeader:
      user.floorHeadOf.length > 0 || user.floorSubHeadOf.length > 0,
  };

  await recordActivity({
    action: "MEMBER_LOGIN",
    summary: `${user.name || user.username} signed in`,
    userId: user.id,
    userName: user.name || user.username,
  });

  return { ok: true, user: sessionUser };
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const token = await readSessionTokenPayload();
  if (!token) return null;

  const user = await db.user.findUnique({
    where: { id: token.sub },
    include: {
      moduleAccess: { select: { moduleId: true } },
      floorHeadOf: { select: { id: true } },
      floorSubHeadOf: { select: { id: true } },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    its: user.its,
    role: user.role,
    profileStatus: user.profileStatus,
    moduleIds: user.moduleAccess.map((m) => m.moduleId),
    isFloorLeader:
      user.floorHeadOf.length > 0 || user.floorSubHeadOf.length > 0,
  };
}
