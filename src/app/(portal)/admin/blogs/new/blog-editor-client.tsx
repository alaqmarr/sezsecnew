"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { saveBlogChronicleAction } from "@/app/actions/community.actions";
import { Button, Input, RichEditor, notify } from "@sezsec/ui";

interface EditableChronicle {
  id?: string;
  title: string;
  author: string;
  content: string;
  publishedDate: string;
}

export function BlogEditorClient({
  initialBlog,
}: {
  initialBlog: EditableChronicle;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialBlog.title);
  const [author, setAuthor] = useState(initialBlog.author);
  const [publishedDate, setPublishedDate] = useState(initialBlog.publishedDate);
  const [content, setContent] = useState(initialBlog.content);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      notify.error("Please provide a title and chronicle body");
      return;
    }
    setSaving(true);
    try {
      const res = await saveBlogChronicleAction({
        id: initialBlog.id,
        title,
        author,
        content,
        publishedAt: publishedDate,
      });
      if (!res.ok) {
        notify.error("Could not publish chronicle", res.error);
        return;
      }
      notify.success("Chronicle published");
      router.push("/admin/blogs");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-5 rounded-2xl border border-[#E5DDD0] bg-white p-6"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Input
            label="Chronicle Headline"
            placeholder="e.g. Ashara Mubaraka 1448H Khidmat Summary"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="lg:col-span-3">
          <Input
            label="Author / Attribution"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            required
          />
        </div>
        <div className="lg:col-span-3">
          <Input
            label="Publish Date"
            type="date"
            value={publishedDate}
            onChange={(e) => setPublishedDate(e.target.value)}
          />
        </div>
      </div>

      <RichEditor
        label="Chronicle Body"
        value={content}
        onChange={setContent}
      />

      <div className="flex justify-end border-t border-[#EAE2D6] pt-4">
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          icon={<Save className="h-4 w-4" />}
        >
          {initialBlog.id ? "Save Changes" : "Publish Chronicle"}
        </Button>
      </div>
    </form>
  );
}
