import crypto from "node:crypto";
import { db, withWriteLock } from "@sezsec/db";

const SMTP_EMAIL_KEY = "smtp_email";
const SMTP_PASSWORD_KEY = "smtp_password";
const UPI_ID_KEY = "upi_id";
const UPI_PAYEE_KEY = "upi_payee_name";
const BRIDGE_URL_KEY = "jamatevents_internal_url";

const ENC_PREFIX = "enc:v1:";

function deriveKey(): Buffer {
  const secret =
    process.env.AUTH_SECRET || "sezsec-default-local-encryption-secret-2026";
  return crypto.scryptSync(secret, "sezsec-config-salt-v1", 32);
}

export function encryptSecretValue(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecretValue(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) {
    return stored;
  }
  try {
    const rest = stored.slice(ENC_PREFIX.length);
    const [ivHex, tagHex, dataHex] = rest.split(":");
    if (!ivHex || !tagHex || !dataHex) return "";
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      deriveKey(),
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

export interface ResolvedSmtpCredentials {
  smtpEmail: string;
  smtpPassword: string;
  configured: boolean;
  source: "database" | "env" | "unconfigured";
}

export async function getResolvedSmtpCredentials(): Promise<ResolvedSmtpCredentials> {
  const rows = await db.config.findMany({
    where: { key: { in: [SMTP_EMAIL_KEY, SMTP_PASSWORD_KEY] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const dbEmail = (map.get(SMTP_EMAIL_KEY) || "").trim();
  const dbPassRaw = map.get(SMTP_PASSWORD_KEY) || "";
  const dbPass = dbPassRaw
    ? decryptSecretValue(dbPassRaw).replace(/\s+/g, "")
    : "";

  if (dbEmail && dbPass) {
    return {
      smtpEmail: dbEmail,
      smtpPassword: dbPass,
      configured: true,
      source: "database",
    };
  }

  const envEmail = (
    process.env.SMTP_EMAIL ||
    process.env.EMAIL_USER ||
    "info@sezsec.org"
  ).trim();
  const envPass = (
    process.env.SMTP_PASSWORD ||
    process.env.EMAIL_PASS ||
    ""
  ).replace(/\s+/g, "");

  if (envEmail && envPass) {
    // Auto-seed into SQLite Config so it is controllable from Admin UI
    try {
      await saveSmtpCredentials(envEmail, envPass);
    } catch {
      // Non-fatal during concurrent read
    }
    return {
      smtpEmail: envEmail,
      smtpPassword: envPass,
      configured: true,
      source: "env",
    };
  }

  return {
    smtpEmail: dbEmail || envEmail || "info@sezsec.org",
    smtpPassword: "",
    configured: false,
    source: "unconfigured",
  };
}

export async function saveSmtpCredentials(
  smtpEmail: string,
  smtpPassword?: string
): Promise<void> {
  const cleanEmail = smtpEmail.trim();
  await withWriteLock(async () => {
    await db.config.upsert({
      where: { key: SMTP_EMAIL_KEY },
      create: { key: SMTP_EMAIL_KEY, value: cleanEmail },
      update: { value: cleanEmail },
    });

    if (smtpPassword !== undefined && smtpPassword.trim() !== "") {
      const normalizedPass = smtpPassword.replace(/\s+/g, "");
      const encrypted = encryptSecretValue(normalizedPass);
      await db.config.upsert({
        where: { key: SMTP_PASSWORD_KEY },
        create: { key: SMTP_PASSWORD_KEY, value: encrypted },
        update: { value: encrypted },
      });
    }
  });
}

export interface PortalRuntimeConfig {
  upiId: string;
  upiPayeeName: string;
  jamateventsInternalUrl: string;
}

export async function getPortalRuntimeConfig(): Promise<PortalRuntimeConfig> {
  const rows = await db.config.findMany({
    where: { key: { in: [UPI_ID_KEY, UPI_PAYEE_KEY, BRIDGE_URL_KEY] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    upiId: (
      map.get(UPI_ID_KEY) ||
      process.env.UPI_ID ||
      "dbjtsez@idfcbank"
    ).trim(),
    upiPayeeName: (
      map.get(UPI_PAYEE_KEY) ||
      process.env.UPI_PAYEE_NAME ||
      "Shabab Ul Eidiz Zahabi"
    ).trim(),
    jamateventsInternalUrl: (
      map.get(BRIDGE_URL_KEY) ||
      process.env.JAMATEVENTS_INTERNAL_URL ||
      process.env.JAMATEVENTS_API_URL ||
      "http://127.0.0.1:3333"
    )
      .trim()
      .replace(/\/+$/, ""),
  };
}

export async function savePortalRuntimeConfig(input: {
  upiId?: string;
  upiPayeeName?: string;
  jamateventsInternalUrl?: string;
}): Promise<void> {
  await withWriteLock(async () => {
    if (input.upiId !== undefined && input.upiId.trim()) {
      await db.config.upsert({
        where: { key: UPI_ID_KEY },
        create: { key: UPI_ID_KEY, value: input.upiId.trim() },
        update: { value: input.upiId.trim() },
      });
    }
    if (input.upiPayeeName !== undefined && input.upiPayeeName.trim()) {
      await db.config.upsert({
        where: { key: UPI_PAYEE_KEY },
        create: { key: UPI_PAYEE_KEY, value: input.upiPayeeName.trim() },
        update: { value: input.upiPayeeName.trim() },
      });
    }
    if (
      input.jamateventsInternalUrl !== undefined &&
      input.jamateventsInternalUrl.trim()
    ) {
      const cleanUrl = input.jamateventsInternalUrl.trim().replace(/\/+$/, "");
      await db.config.upsert({
        where: { key: BRIDGE_URL_KEY },
        create: { key: BRIDGE_URL_KEY, value: cleanUrl },
        update: { value: cleanUrl },
      });
    }
  });
}
