import { connection } from "next/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@sezsec/db";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { Button, PageHeader } from "@sezsec/ui";
import { BlogsAdminClient } from "./blogs-admin-client";

export default async function BlogsAdminPage() {
  await connection();
  await requireServerPathAccess("/admin/blogs");

  const blogs = await db.blog.findMany({
    orderBy: { publishedAt: "desc" },
  });

  const serialized = blogs.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    excerpt: b.content
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180),
    publishedAt: b.publishedAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Community Chronicles"
        title="Reports & Chronicles"
        subtitle="Publish Miqaat reports, community updates, and event chronicles to /our-events."
        actions={
          <Link href="/admin/blogs/new">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
            >
              Write Chronicle
            </Button>
          </Link>
        }
      />

      <BlogsAdminClient blogs={serialized} />
    </div>
  );
}
