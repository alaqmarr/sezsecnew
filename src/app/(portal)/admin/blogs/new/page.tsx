import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { Button, PageHeader } from "@sezsec/ui";
import { BlogEditorClient } from "./blog-editor-client";

export default async function BlogComposerAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await connection();
  const actor = await requireServerPathAccess("/admin/blogs/new");
  const { edit } = await searchParams;

  const existing = edit
    ? await db.blog.findUnique({ where: { id: edit } })
    : null;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Chronicle Composer"
        title={existing ? "Edit Community Chronicle" : "Write New Chronicle"}
        subtitle="Format headings, inline photographs, and reflections for the SEZ Secunderabad community archive."
        actions={
          <Link href="/admin/blogs">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Back to Chronicles
            </Button>
          </Link>
        }
      />

      <BlogEditorClient
        initialBlog={
          existing
            ? {
                id: existing.id,
                title: existing.title,
                author: existing.author,
                content: existing.content,
                publishedDate: existing.publishedAt.toISOString().slice(0, 10),
              }
            : {
                title: "",
                author: actor.name || "SEZ Secunderabad",
                content: "",
                publishedDate: new Date().toISOString().slice(0, 10),
              }
        }
      />
    </div>
  );
}
