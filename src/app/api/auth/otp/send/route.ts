import { NextResponse } from "next/server";
import { getCurrentSessionUser, issueEmailOtp } from "@sezsec/auth";

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    purpose?: string;
    purposeLabel?: string;
  };

  const targetEmail = (body.email || user.email || "").trim();
  if (!targetEmail) {
    return NextResponse.json(
      { error: "Please enter an email address first." },
      { status: 400 }
    );
  }

  const res = await issueEmailOtp({
    email: targetEmail,
    purpose: body.purpose || "PROFILE_SECURITY",
    purposeLabel: body.purposeLabel || "Profile Security Verification",
    userId: user.id,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  return NextResponse.json(res);
}
