"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit2, ExternalLink, Trash2 } from "lucide-react";
import { deleteBlogChronicleAction } from "@/app/actions/community.actions";
import { formatIST } from "@sezsec/shared";
import { Button, ConfirmDialog, notify } from "@sezsec/ui";

interface BlogSummary {
  id: string;
  title: string;
  author: string;
  excerpt: string;
  publishedAt: string;
}

export function BlogsAdminClient({ blogs }: { blogs: BlogSummary[] }) {
  const router = useRouter();
  const [deletingBlog, setDeletingBlog] = useState<BlogSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deletingBlog) return;
    setDeleting(true);
    try {
      const res = await deleteBlogChronicleAction(deletingBlog.id);
      if (!res.ok) {
        notify.error("Delete failed", res.error);
        return;
      }
      notify.info("Chronicle deleted");
      setDeletingBlog(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (blogs.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E5DDD0] bg-white px-6 py-12 text-center text-sm text-[#7B6B63]">
        No community chronicles published yet. Click{" "}
        <strong>Write Chronicle</strong> to compose your first report.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="divide-y divide-[#E5DDD0] rounded-2xl border border-[#E5DDD0] bg-white">
        {blogs.map((b) => (
          <div
            key={b.id}
            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="text-xs text-[#8C7B73]">
                {formatIST(b.publishedAt, "dd MMM yyyy")} • By {b.author}
              </div>
              <h2 className="font-editorial text-2xl font-bold text-[#231917]">
                {b.title}
              </h2>
              <p className="line-clamp-2 text-xs leading-relaxed text-[#5E4F4A]">
                {b.excerpt}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/our-events?read=${encodeURIComponent(b.id)}`}>
                <Button
                  size="xs"
                  variant="ghost"
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                >
                  View
                </Button>
              </Link>
              <Link href={`/admin/blogs/new?edit=${encodeURIComponent(b.id)}`}>
                <Button
                  size="xs"
                  variant="secondary"
                  icon={<Edit2 className="h-3.5 w-3.5" />}
                >
                  Edit
                </Button>
              </Link>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setDeletingBlog(b)}
                icon={<Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />}
              />
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deletingBlog)}
        onClose={() => setDeletingBlog(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Chronicle?"
        description={
          <>
            Delete <strong>{deletingBlog?.title}</strong> permanently?
          </>
        }
      />
    </div>
  );
}
