import nodemailer from "nodemailer";
import { getResolvedSmtpCredentials } from "./smtp-config.helper";

function wrapHeritageEmailFrame(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px 12px;background-color:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#231917;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;margin:0 auto;background:#FFFFFF;border:1px solid #D9C398;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="height:4px;background:linear-gradient(90deg,#6A1B1B,#B8924A,#6A1B1B);"></td>
    </tr>
    <tr>
      <td style="padding:24px 28px 18px;background:#FBF6EB;border-bottom:1px solid #EAE2D6;text-align:center;">
        <div dir="rtl" style="font-size:20px;color:#6A1B1B;margin-bottom:6px;">بسم الله الرحمن الرحيم</div>
        <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8C7B73;font-weight:700;">Shabab Ul Eidiz Zahabi • Secunderabad</div>
        <h1 style="margin:8px 0 0;font-size:20px;color:#231917;font-weight:700;">${title}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;">
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#FAF7F2;border-top:1px solid #EAE2D6;text-align:center;font-size:12px;color:#8C7B73;">
        Shabab Ul Eidiz Zahabi Committee — Secunderabad Jamaat
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendSystemEmail(params: {
  to: string | string[];
  subject: string;
  title: string;
  bodyHtml: string;
}): Promise<{ ok: boolean; error?: string; devSimulated?: boolean }> {
  const creds = await getResolvedSmtpCredentials();
  if (!creds.configured) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[DEV EMAIL] To=${Array.isArray(params.to) ? params.to.join(",") : params.to} | Subject=${params.subject}`
      );
      return { ok: true, devSimulated: true };
    }
    return {
      ok: false,
      error:
        "SMTP credentials are not configured. Configure them in Admin -> System Settings.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: creds.smtpEmail,
        pass: creds.smtpPassword,
      },
    });

    await transporter.sendMail({
      from: `"SEZ Secunderabad" <${creds.smtpEmail}>`,
      to: params.to,
      subject: params.subject,
      html: wrapHeritageEmailFrame(params.title, params.bodyHtml),
    });

    return { ok: true };
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "SMTP dispatch failed",
    };
  }
}

export async function sendVerificationOtpEmail(
  email: string,
  otpCode: string,
  purposeLabel = "Profile Security Verification"
): Promise<{ ok: boolean; error?: string; devPreviewCode?: string }> {
  const html = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#5E4F4A;">
      Use the 6-digit verification code below to authorize <strong>${purposeLabel}</strong> on your SEZ Secunderabad account.
    </p>
    <div style="margin:24px 0;padding:18px;background:#FBF6EB;border:1px solid #D9C398;border-radius:12px;text-align:center;">
      <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:#6A1B1B;">${otpCode}</span>
    </div>
    <p style="margin:0;font-size:13px;color:#8C7B73;">
      This code expires in 10 minutes. If you did not initiate this request, you can safely ignore this message.
    </p>
  `;

  const res = await sendSystemEmail({
    to: email,
    subject: `${otpCode} — SEZ Secunderabad Verification Code`,
    title: purposeLabel,
    bodyHtml: html,
  });

  return {
    ok: res.ok,
    error: res.error,
    ...(res.devSimulated ? { devPreviewCode: otpCode } : {}),
  };
}
