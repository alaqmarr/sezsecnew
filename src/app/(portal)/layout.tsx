import React, { Suspense } from "react";
import { connection } from "next/server";
import {
  getPublicJamateventsUrl,
  pingJamateventsBridge,
} from "@sezsec/bridge";
import {
  getNavModulesForUser,
  requireServerSession,
} from "@sezsec/rbac/rbac.server";
import { getISTTodayString } from "@sezsec/shared";
import { PageLoader, PortalShell } from "@sezsec/ui";

export const instant = false;

async function PortalShellWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const user = await requireServerSession();
  const [navModules, bridgeHealth] = await Promise.all([
    getNavModulesForUser(user),
    pingJamateventsBridge(),
  ]);
  const todayIso = getISTTodayString();

  return (
    <PortalShell
      user={user}
      navModules={navModules}
      todayIso={todayIso}
      bridgeReachable={bridgeHealth.reachable}
      eventsPortalPublicUrl={getPublicJamateventsUrl()}
    >
      {children}
    </PortalShell>
  );
}

export default function PortalGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<PageLoader label="Loading Member Portal…" />}>
      <PortalShellWrapper>{children}</PortalShellWrapper>
    </Suspense>
  );
}
