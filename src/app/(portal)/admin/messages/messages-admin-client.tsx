"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Send, Trash2 } from "lucide-react";
import {
  createCommunityMessageAction,
  deleteCommunityMessageAction,
  togglePinCommunityMessageAction,
} from "@/app/actions/community.actions";
import { formatIST } from "@sezsec/shared";
import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  Select,
  Textarea,
  Toggle,
  notify,
} from "@sezsec/ui";

interface NoticeItem {
  id: string;
  title: string;
  body: string;
  audience: string;
  isPinned: boolean;
  sentByEmail: boolean;
  sentCount: number;
  authorName: string;
  createdAt: string;
}

export function MessagesAdminClient({ messages }: { messages: NoticeItem[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"ALL" | "FLOOR_HEADS" | "ADMINS">(
    "ALL"
  );
  const [isPinned, setIsPinned] = useState(true);
  const [sendEmailBroadcast, setSendEmailBroadcast] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<NoticeItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setPublishing(true);
    try {
      const res = await createCommunityMessageAction({
        title,
        body,
        audience,
        isPinned,
        sendEmailBroadcast,
      });
      if (!res.ok) {
        notify.error("Could not publish notice", res.error);
        return;
      }
      notify.success(
        "Announcement published",
        res.sentCount > 0
          ? `Delivered by email to ${res.sentCount} recipient(s)`
          : undefined
      );
      setTitle("");
      setBody("");
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  async function handleTogglePin(item: NoticeItem, next: boolean) {
    setTogglingId(item.id);
    try {
      const res = await togglePinCommunityMessageAction({
        messageId: item.id,
        isPinned: next,
      });
      if (!res.ok) {
        notify.error("Failed to update pin", res.error);
        return;
      }
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      const res = await deleteCommunityMessageAction(deletingItem.id);
      if (!res.ok) {
        notify.error("Delete failed", res.error);
        return;
      }
      notify.info("Notice deleted");
      setDeletingItem(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Compose Notice */}
      <form
        onSubmit={handlePublish}
        className="space-y-4 rounded-2xl border border-[#E5DDD0] bg-white p-6 xl:col-span-5"
      >
        <h2 className="font-editorial text-2xl font-bold text-[#231917]">
          Compose Announcement
        </h2>

        <Input
          label="Notice Title"
          placeholder="e.g. Shehrullah Floor Khidmat Schedule"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Select
          label="Target Audience"
          value={audience}
          onChange={(v) =>
            setAudience(v as "ALL" | "FLOOR_HEADS" | "ADMINS")
          }
          options={[
            {
              value: "ALL",
              label: "All Community & Members (Public + Portal)",
            },
            { value: "FLOOR_HEADS", label: "Floor Heads & Sub-Heads Only" },
            { value: "ADMINS", label: "Administrators & Managers Only" },
          ]}
        />

        <Textarea
          label="Announcement Message"
          rows={5}
          placeholder="Write a concise, clear message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />

        <div className="space-y-3 rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-4">
          <Toggle
            checked={isPinned}
            onChange={setIsPinned}
            label="Pin notice to top strip"
            description="Displays prominently on the landing page (if Audience = All) and member portal."
          />
          <div className="border-t border-[#E5DDD0] pt-3">
            <Toggle
              checked={sendEmailBroadcast}
              onChange={setSendEmailBroadcast}
              label="Send Email Broadcast via SMTP"
              description="Dispatches formatted email to all matching member addresses."
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={publishing}
          icon={<Send className="h-4 w-4" />}
        >
          Publish Announcement
        </Button>
      </form>

      {/* Published History */}
      <div className="space-y-4 xl:col-span-7">
        <div className="divide-y divide-[#E5DDD0] rounded-2xl border border-[#E5DDD0] bg-white">
          {messages.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-[#7B6B63]">
              No announcements published yet.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="space-y-2 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[#231917]">
                        {m.title}
                      </h3>
                      <Badge tone="brass">{m.audience}</Badge>
                      {m.sentByEmail ? (
                        <Badge tone="emerald">
                          <Mail className="mr-1 inline h-3 w-3" />
                          Emailed ({m.sentCount})
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-[#8C7B73]">
                      {formatIST(m.createdAt, "dd MMM yyyy, hh:mm a")} •{" "}
                      {m.authorName}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Toggle
                      checked={m.isPinned}
                      loading={togglingId === m.id}
                      onChange={(next) => handleTogglePin(m, next)}
                      label="Pinned"
                    />
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setDeletingItem(m)}
                      icon={<Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />}
                    />
                  </div>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[#4E3F3A]">
                  {m.body}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Announcement?"
        description={
          <>
            Delete notice <strong>{deletingItem?.title}</strong>?
          </>
        }
      />
    </div>
  );
}
