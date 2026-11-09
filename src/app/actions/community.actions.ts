"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { ApprovalStatus } from "@/generated/prisma/client";
import { syncUserByIdToJamatevents } from "@sezsec/bridge";
import { db, withWriteLock } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import { sendSystemEmail } from "@sezsec/notifications";
import { hasUserPathAccess, requireServerSession } from "@sezsec/rbac/rbac.server";
import { parseISTDateOnly } from "@sezsec/shared";

async function assertPathOrAdmin(targetPath: string) {
  const session = await requireServerSession();
  const ok =
    session.role === "ADMIN" || (await hasUserPathAccess(session, targetPath));
  if (!ok) {
    throw new Error("Insufficient permissions.");
  }
  return session;
}

export async function updateMemberRegistrationStatusAction(input: {
  registrationId: string;
  status: ApprovalStatus;
  provisionAccount?: boolean;
}): Promise<{ ok: boolean; provisionedUserId?: string; error?: string }> {
  try {
    const actor = await assertPathOrAdmin("/admin/members");
    let provisionedUserId: string | undefined;

    await withWriteLock(() =>
      db.$transaction(async (tx) => {
        const reg = await tx.memberRegistration.update({
          where: { id: input.registrationId },
          data: { status: input.status },
        });

        if (input.status === "APPROVED" && input.provisionAccount) {
          const existing = await tx.user.findFirst({
            where: {
              OR: [{ its: reg.its }, { username: reg.its }],
            },
          });
          if (!existing) {
            const passwordHash = await bcrypt.hash(reg.its, 10);
            const created = await tx.user.create({
              data: {
                username: reg.its,
                password: passwordHash,
                name: reg.name,
                its: reg.its,
                email: reg.email,
                mobile: reg.phone,
                dob: reg.dob,
                quranHifz: reg.quranHifz,
                passport: reg.passport,
                kunSafar: reg.kunSafar,
                occupation: reg.occupation,
                sports: reg.sports,
                role: "USER",
                profileStatus: "COMPLETED",
              },
            });
            provisionedUserId = created.id;
          }
        }
      })
    );

    if (provisionedUserId) {
      await syncUserByIdToJamatevents(provisionedUserId);
    }

    await recordActivity({
      action: "MEMBER_REGISTRATION_REVIEWED",
      summary: `Marked member registration ${input.registrationId} as ${input.status}${provisionedUserId ? " & provisioned member account" : ""}`,
      userId: actor.id,
      userName: actor.name || actor.username,
      targetId: input.registrationId,
    });

    revalidatePath("/admin/members");
    revalidatePath("/admin/users");
    return { ok: true, provisionedUserId };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to update application.",
    };
  }
}

export async function deleteMemberRegistrationAction(
  registrationId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPathOrAdmin("/admin/members");
    await withWriteLock(() =>
      db.memberRegistration.delete({ where: { id: registrationId } })
    );
    revalidatePath("/admin/members");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete record.",
    };
  }
}

export async function updateKhidmatStatusAction(input: {
  requestId: string;
  status: ApprovalStatus;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPathOrAdmin("/admin/khidmat");
    await withWriteLock(() =>
      db.khidmatRequest.update({
        where: { id: input.requestId },
        data: { status: input.status },
      })
    );
    revalidatePath("/admin/khidmat");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update request.",
    };
  }
}

export async function deleteKhidmatRequestAction(
  requestId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPathOrAdmin("/admin/khidmat");
    await withWriteLock(() =>
      db.khidmatRequest.delete({ where: { id: requestId } })
    );
    revalidatePath("/admin/khidmat");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete request.",
    };
  }
}

export async function saveBannerAction(input: {
  id?: string;
  imageUrl: string;
  href?: string;
  isActive: boolean;
  countdownTarget?: string | null;
  countdownLabel?: string;
  x?: number;
  y?: number;
  countdownSize?: string;
  countdownColor?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPathOrAdmin("/admin/banners");
    const imageUrl = input.imageUrl.trim();
    if (!imageUrl) {
      return { ok: false, error: "Banner image is required." };
    }

    const parsedTarget = input.countdownTarget
      ? new Date(input.countdownTarget)
      : null;
    const validTarget =
      parsedTarget && !Number.isNaN(parsedTarget.getTime())
        ? parsedTarget
        : null;

    const payload = {
      imageUrl,
      href: input.href?.trim() || null,
      isActive: Boolean(input.isActive),
      countdownTarget: validTarget,
      countdownLabel: input.countdownLabel?.trim() || null,
      x: Number.isFinite(input.x) ? Number(input.x) : 50,
      y: Number.isFinite(input.y) ? Number(input.y) : 50,
      countdownSize: input.countdownSize || "normal",
      countdownColor: input.countdownColor || "gold",
    };

    await withWriteLock(() =>
      input.id
        ? db.banner.update({ where: { id: input.id }, data: payload })
        : db.banner.create({ data: payload })
    );

    revalidatePath("/");
    revalidatePath("/admin/banners");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save banner.",
    };
  }
}

export async function toggleBannerActiveAction(input: {
  bannerId: string;
  isActive: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPathOrAdmin("/admin/banners");
    await withWriteLock(() =>
      db.banner.update({
        where: { id: input.bannerId },
        data: { isActive: input.isActive },
      })
    );
    revalidatePath("/");
    revalidatePath("/admin/banners");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to toggle banner.",
    };
  }
}

export async function deleteBannerAction(
  bannerId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPathOrAdmin("/admin/banners");
    await withWriteLock(() => db.banner.delete({ where: { id: bannerId } }));
    revalidatePath("/");
    revalidatePath("/admin/banners");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete banner.",
    };
  }
}

export async function saveBlogChronicleAction(input: {
  id?: string;
  title: string;
  content: string;
  author: string;
  publishedAt?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    await assertPathOrAdmin("/admin/blogs");
    const title = input.title.trim();
    const content = input.content.trim();
    const author = input.author.trim() || "SEZ Secunderabad";
    if (!title || !content) {
      return { ok: false, error: "Title and content are required." };
    }

    const pubDate = input.publishedAt?.trim()
      ? /^\d{4}-\d{2}-\d{2}$/.test(input.publishedAt.trim())
        ? parseISTDateOnly(input.publishedAt)
        : new Date(input.publishedAt)
      : new Date();
    const safePubDate = Number.isNaN(pubDate.getTime()) ? new Date() : pubDate;

    const saved = await withWriteLock(() =>
      input.id
        ? db.blog.update({
            where: { id: input.id },
            data: { title, content, author, publishedAt: safePubDate },
          })
        : db.blog.create({
            data: { title, content, author, publishedAt: safePubDate },
          })
    );

    revalidatePath("/our-events");
    revalidatePath("/admin/blogs");
    revalidatePath("/");
    return { ok: true, id: saved.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save chronicle.",
    };
  }
}

export async function deleteBlogChronicleAction(
  blogId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPathOrAdmin("/admin/blogs");
    await withWriteLock(() => db.blog.delete({ where: { id: blogId } }));
    revalidatePath("/our-events");
    revalidatePath("/admin/blogs");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete chronicle.",
    };
  }
}

export async function createCommunityMessageAction(input: {
  title: string;
  body: string;
  audience: "ALL" | "FLOOR_HEADS" | "ADMINS";
  isPinned: boolean;
  sendEmailBroadcast: boolean;
}): Promise<{ ok: boolean; sentCount: number; error?: string }> {
  try {
    const actor = await assertPathOrAdmin("/admin/messages");
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) {
      return {
        ok: false,
        sentCount: 0,
        error: "Notice title and message body are required.",
      };
    }

    let sentCount = 0;
    if (input.sendEmailBroadcast) {
      const recipients = await db.user.findMany({
        where:
          input.audience === "ADMINS"
            ? { role: { in: ["ADMIN", "ADMIN_CUSTOM", "MANAGER"] }, email: { not: null } }
            : input.audience === "FLOOR_HEADS"
              ? {
                  OR: [
                    { floorHeadOf: { some: {} } },
                    { floorSubHeadOf: { some: {} } },
                  ],
                  email: { not: null },
                }
              : { email: { not: null } },
        select: { email: true },
      });

      const emails = [
        ...new Set(
          recipients
            .map((r) => (r.email || "").trim().toLowerCase())
            .filter((e) => e.includes("@"))
        ),
      ];

      if (emails.length > 0) {
        const htmlParagraphs = body
          .split(/\n+/)
          .map(
            (p) =>
              `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#3D2E2A;">${p.replace(/</g, "&lt;")}</p>`
          )
          .join("");
        const mailRes = await sendSystemEmail({
          to: emails,
          subject: `SEZ Notice: ${title}`,
          title,
          bodyHtml: htmlParagraphs,
        });
        if (mailRes.ok) {
          sentCount = emails.length;
        }
      }
    }

    await withWriteLock(() =>
      db.communityMessage.create({
        data: {
          title,
          body,
          audience: input.audience,
          isPinned: Boolean(input.isPinned),
          sentByEmail: input.sendEmailBroadcast && sentCount > 0,
          sentCount,
          authorName: actor.name || actor.username,
        },
      })
    );

    revalidatePath("/");
    revalidatePath("/fees");
    revalidatePath("/admin/messages");
    return { ok: true, sentCount };
  } catch (err) {
    return {
      ok: false,
      sentCount: 0,
      error: err instanceof Error ? err.message : "Failed to publish notice.",
    };
  }
}

export async function togglePinCommunityMessageAction(input: {
  messageId: string;
  isPinned: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPathOrAdmin("/admin/messages");
    await withWriteLock(() =>
      db.communityMessage.update({
        where: { id: input.messageId },
        data: { isPinned: input.isPinned },
      })
    );
    revalidatePath("/");
    revalidatePath("/fees");
    revalidatePath("/admin/messages");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update pin.",
    };
  }
}

export async function deleteCommunityMessageAction(
  messageId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertPathOrAdmin("/admin/messages");
    await withWriteLock(() =>
      db.communityMessage.delete({ where: { id: messageId } })
    );
    revalidatePath("/");
    revalidatePath("/fees");
    revalidatePath("/admin/messages");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete notice.",
    };
  }
}
