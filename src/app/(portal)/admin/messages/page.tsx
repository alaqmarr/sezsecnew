import { connection } from "next/server";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { MessagesAdminClient } from "./messages-admin-client";

export default async function CommunityMessagesAdminPage() {
  await connection();
  await requireServerPathAccess("/admin/messages");

  const messages = await db.communityMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  const serialized = messages.map((m) => ({
    id: m.id,
    title: m.title,
    body: m.body,
    audience: m.audience,
    isPinned: m.isPinned,
    sentByEmail: m.sentByEmail,
    sentCount: m.sentCount,
    authorName: m.authorName,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Communications"
        title="Announcements & Email Broadcasts"
        subtitle="Publish pinned community notices to the landing page or member workspace, and optionally dispatch email broadcasts."
      />

      <MessagesAdminClient messages={serialized} />
    </div>
  );
}
