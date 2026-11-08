import { connection } from "next/server";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { MembersQueueClient } from "./members-queue-client";

export default async function MemberApplicationsAdminPage() {
  await connection();
  await requireServerPathAccess("/admin/members");

  const applications = await db.memberRegistration.findMany({
    orderBy: { createdAt: "desc" },
  });

  const serialized = applications.map((a) => ({
    id: a.id,
    title: a.title,
    name: a.name,
    its: a.its,
    email: a.email,
    dob: a.dob.toISOString(),
    phone: a.phone,
    quranHifz: a.quranHifz,
    passport: a.passport,
    kunSafar: a.kunSafar,
    occupation: a.occupation,
    sports: a.sports,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Membership Intake"
        title="Committee Membership Applications"
        subtitle="Review public Join SEZ submissions and approve + provision committee member accounts in one click."
      />

      <MembersQueueClient applications={serialized} />
    </div>
  );
}
