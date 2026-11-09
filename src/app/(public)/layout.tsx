import React from "react";
import { connection } from "next/server";
import { getCurrentSessionUser } from "@sezsec/auth";
import { getISTTodayString } from "@sezsec/shared";
import { PublicShell } from "@sezsec/ui";

export default async function PublicGroupLayout({
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
