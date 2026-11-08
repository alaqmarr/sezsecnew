import { connection } from "next/server";
import { db } from "@sezsec/db";
import { requireServerSession } from "@sezsec/rbac/rbac.server";
import { formatIST } from "@sezsec/shared";
import { PageHeader } from "@sezsec/ui";
import { ProfileClient } from "./profile-client";

export default async function MemberProfilePage() {
  await connection();
  const session = await requireServerSession();

  const fullUser = await db.user.findUnique({
    where: { id: session.id },
    include: {
      feeConfig: true,
      floorHeadOf: { select: { id: true, name: true } },
      floorSubHeadOf: { select: { id: true, name: true } },
      floorMemberOf: { select: { id: true, name: true } },
      moduleAccess: {
        include: { module: { select: { id: true, name: true } } },
      },
    },
  });

  if (!fullUser) return null;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Member Identity & Security"
        title="My Profile & Account Credentials"
        subtitle="Keep your ITS, contact information, and OTP-protected login credentials up to date."
      />

      <ProfileClient
        profile={{
          id: fullUser.id,
          username: fullUser.username,
          name: fullUser.name || "",
          email: fullUser.email || "",
          mobile: fullUser.mobile || "",
          its: fullUser.its || "",
          role: fullUser.role,
          dob: fullUser.dob ? formatIST(fullUser.dob, "yyyy-MM-dd") : "",
          quranHifz: fullUser.quranHifz || "",
          passport: fullUser.passport || "",
          kunSafar: fullUser.kunSafar || "",
          occupation: fullUser.occupation || "",
          sports: fullUser.sports || "",
          monthlyFee: fullUser.feeConfig?.amount ?? 0,
          floorsAsHead: fullUser.floorHeadOf.map((f) => f.name),
          floorsAsSubHead: fullUser.floorSubHeadOf.map((f) => f.name),
          floorsAsMember: fullUser.floorMemberOf.map((f) => f.name),
          modules: fullUser.moduleAccess.map((m) => m.module.name),
        }}
      />
    </div>
  );
}
