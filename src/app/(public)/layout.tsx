import React, { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentSessionUser } from "@sezsec/auth";
import { getISTTodayString } from "@sezsec/shared";
import { PageLoader, PublicShell } from "@sezsec/ui";

async function PublicShellWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const user = await getCurrentSessionUser();
  const todayIso = getISTTodayString();

  return (
    <PublicShell todayIso={todayIso} user={user}>
      {children}
    </PublicShell>
  );
}

export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<PageLoader label="Loading SEZ Secunderabad…" />}>
      <PublicShellWrapper>{children}</PublicShellWrapper>
    </Suspense>
  );
}
