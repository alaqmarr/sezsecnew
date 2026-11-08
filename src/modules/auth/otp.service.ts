import crypto from "node:crypto";
import { db, withWriteLock } from "@sezsec/db";
import { sendVerificationOtpEmail } from "@sezsec/notifications";

function hashOtpCode(email: string, purpose: string, code: string): string {
  const secret =
    process.env.AUTH_SECRET || "sezsec-otp-hmac-local-secret-2026";
  return crypto
    .createHmac("sha256", secret)
    .update(`${purpose}:${email.toLowerCase().trim()}:${code.trim()}`)
    .digest("hex");
}

export async function issueEmailOtp(params: {
  email: string;
  purpose?: string;
  purposeLabel?: string;
  userId?: string;
}): Promise<{ ok: boolean; error?: string; devPreviewCode?: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const purpose = params.purpose || "PROFILE_SECURITY";
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashOtpCode(cleanEmail, purpose, code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await withWriteLock(async () => {
    await db.verificationCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { email: cleanEmail, purpose },
        ],
      },
    });
    await db.verificationCode.create({
      data: {
        email: cleanEmail,
        codeHash,
        purpose,
        userId: params.userId ?? null,
        expiresAt,
      },
    });
  });

  const emailRes = await sendVerificationOtpEmail(
    cleanEmail,
    code,
    params.purposeLabel || "Profile Security Verification"
  );

  if (!emailRes.ok) {
    return { ok: false, error: emailRes.error || "Failed to send OTP email." };
  }

  return {
    ok: true,
    ...(emailRes.devPreviewCode ? { devPreviewCode: emailRes.devPreviewCode } : {}),
  };
}

export async function verifyEmailOtp(params: {
  email: string;
  code: string;
  purpose?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanCode = params.code.trim();
  const purpose = params.purpose || "PROFILE_SECURITY";

  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: "Enter the 6-digit verification code." };
  }

  const record = await db.verificationCode.findFirst({
    where: {
      email: cleanEmail,
      purpose,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { ok: false, error: "Verification code expired or not found." };
  }

  if (record.attempts >= 5) {
    await withWriteLock(() =>
      db.verificationCode.delete({ where: { id: record.id } })
    );
    return {
      ok: false,
      error: "Too many incorrect attempts. Please request a new code.",
    };
  }

  const expectedHash = hashOtpCode(cleanEmail, purpose, cleanCode);
  // Support both hashed codes and legacy 6-digit codes from migrated DB
  const isLegacyMatch =
    record.codeHash.length === 6 && record.codeHash === cleanCode;
  let isHashedMatch = false;
  if (!isLegacyMatch && record.codeHash.length === expectedHash.length) {
    isHashedMatch = crypto.timingSafeEqual(
      Buffer.from(record.codeHash, "utf8"),
      Buffer.from(expectedHash, "utf8")
    );
  }

  if (!isLegacyMatch && !isHashedMatch) {
    await withWriteLock(() =>
      db.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      })
    );
    return { ok: false, error: "Incorrect verification code." };
  }

  await withWriteLock(() =>
    db.verificationCode.delete({ where: { id: record.id } })
  );
  return { ok: true };
}
