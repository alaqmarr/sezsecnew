import { connection } from "next/server";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { BannersAdminClient } from "./banners-admin-client";

export default async function BannersAdminPage() {
  await connection();
  await requireServerPathAccess("/admin/banners");

  const banners = await db.banner.findMany({
    orderBy: { createdAt: "desc" },
  });

  const serialized = banners.map((b) => ({
    id: b.id,
    imageUrl: b.imageUrl,
    href: b.href || "",
    isActive: b.isActive,
    countdownTarget: b.countdownTarget
      ? b.countdownTarget.toISOString()
      : null,
    countdownLabel: b.countdownLabel || "",
    x: b.x ?? 50,
    y: b.y ?? 50,
    countdownSize: b.countdownSize || "normal",
    countdownColor: b.countdownColor || "gold",
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Public Showcase"
        title="Homepage Banners & Countdown Overlays"
        subtitle="Publish wide banners to the public homepage and click directly on the preview to position live Miqaat countdown timers."
      />

      <BannersAdminClient banners={serialized} />
    </div>
  );
}
