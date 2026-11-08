import { connection, NextResponse } from "next/server";
import { db } from "@sezsec/db";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import { formatIST } from "@sezsec/shared";

export async function GET() {
  await connection();
  const auth = await requireApiAuth({ roles: ["ADMIN"] });
  if (!auth.ok) return auth.response;

  const [
    users,
    modules,
    moduleLinks,
    userModuleAccess,
    userFeeConfigs,
    feeRecords,
    feeTransactions,
    eventContributions,
    feeTransactionAllocations,
    floorConfigs,
    attendanceEventClones,
    attendanceRecords,
    khidmatRequests,
    memberRegistrations,
    blogs,
    banners,
    communityMessages,
  ] = await Promise.all([
    db.user.findMany(),
    db.module.findMany(),
    db.moduleLink.findMany(),
    db.userModuleAccess.findMany(),
    db.userFeeConfig.findMany(),
    db.feeRecord.findMany(),
    db.feeTransaction.findMany(),
    db.eventContribution.findMany(),
    db.feeTransactionAllocation.findMany(),
    db.floorConfig.findMany({
      include: {
        heads: { select: { id: true } },
        subHeads: { select: { id: true } },
        members: { select: { id: true } },
      },
    }),
    db.attendanceEventClone.findMany(),
    db.attendanceRecord.findMany(),
    db.khidmatRequest.findMany(),
    db.memberRegistration.findMany(),
    db.blog.findMany(),
    db.banner.findMany(),
    db.communityMessage.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    service: "sezsecnew",
    counts: {
      users: users.length,
      modules: modules.length,
      feeRecords: feeRecords.length,
      feeTransactions: feeTransactions.length,
      eventContributions: eventContributions.length,
      floorConfigs: floorConfigs.length,
      attendanceRecords: attendanceRecords.length,
    },
    data: {
      users,
      modules,
      moduleLinks,
      userModuleAccess,
      userFeeConfigs,
      feeRecords,
      feeTransactions,
      eventContributions,
      feeTransactionAllocations,
      floorConfigs,
      attendanceEventClones,
      attendanceRecords,
      khidmatRequests,
      memberRegistrations,
      blogs,
      banners,
      communityMessages,
    },
  };

  const stamp = formatIST(new Date(), "yyyy-MM-dd_HHmm");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sezsec-backup-${stamp}.json"`,
    },
  });
}
