"use server";

import { revalidatePath } from "next/cache";
import type { FeeStatus } from "@/generated/prisma/client";
import { db, withWriteLock } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import { hasUserPathAccess, requireServerSession } from "@sezsec/rbac/rbac.server";
import { formatRupees, MONTH_NAMES_FULL } from "@sezsec/shared";

async function assertFinanceAdmin() {
  const session = await requireServerSession();
  const ok =
    session.role === "ADMIN" ||
    (await hasUserPathAccess(session, "/admin/fees")) ||
    (await hasUserPathAccess(session, "/admin/accounts"));
  if (!ok) {
    throw new Error("Insufficient permissions for finance administration.");
  }
  return session;
}

function computeStatus(amount: number, paidAmount: number): FeeStatus {
  if (paidAmount >= amount && amount > 0) return "PAID";
  if (paidAmount === 0 && amount === 0) return "PAID";
  if (paidAmount > 0) return "PARTIAL";
  return "PENDING";
}

export async function updateMemberMonthlyFeeConfigAction(input: {
  userId: string;
  amount: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertFinanceAdmin();
    const safeAmount = Math.max(0, Math.round(Number(input.amount) || 0));

    await withWriteLock(() =>
      db.userFeeConfig.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, amount: safeAmount },
        update: { amount: safeAmount },
      })
    );

    await recordActivity({
      action: "FEE_CONFIG_UPDATED",
      summary: `Set monthly contribution rate to ${formatRupees(safeAmount)} for user ${input.userId}`,
      userId: actor.id,
      userName: actor.name || actor.username,
      targetId: input.userId,
    });

    revalidatePath("/admin/fees");
    revalidatePath("/admin/accounts");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update fee config.",
    };
  }
}

export async function generateMonthlyFeesAction(input: {
  month: number;
  year: number;
  fallbackAmount?: number;
}): Promise<{
  ok: boolean;
  createdCount: number;
  skippedCount: number;
  error?: string;
}> {
  try {
    const actor = await assertFinanceAdmin();
    const month = Math.min(11, Math.max(0, Math.round(input.month)));
    const year = Math.round(input.year);
    const fallback = Math.max(0, Math.round(Number(input.fallbackAmount ?? 0)));

    const users = await db.user.findMany({
      include: { feeConfig: true },
    });

    let createdCount = 0;
    let skippedCount = 0;

    await withWriteLock(() =>
      db.$transaction(async (tx) => {
        for (const u of users) {
          const targetAmt = u.feeConfig?.amount ?? fallback;
          if (targetAmt <= 0) {
            skippedCount += 1;
            continue;
          }

          const existing = await tx.feeRecord.findUnique({
            where: {
              userId_month_year: { userId: u.id, month, year },
            },
          });
          if (existing) {
            skippedCount += 1;
            continue;
          }

          await tx.feeRecord.create({
            data: {
              userId: u.id,
              month,
              year,
              amount: targetAmt,
              paidAmount: 0,
              status: "PENDING",
            },
          });
          createdCount += 1;
        }
      })
    );

    await recordActivity({
      action: "MONTHLY_FEES_GENERATED",
      summary: `Generated ${createdCount} monthly fee records for ${MONTH_NAMES_FULL[month]} ${year}`,
      userId: actor.id,
      userName: actor.name || actor.username,
    });

    revalidatePath("/admin/fees");
    revalidatePath("/admin/accounts");
    revalidatePath("/fees");
    return { ok: true, createdCount, skippedCount };
  } catch (err) {
    return {
      ok: false,
      createdCount: 0,
      skippedCount: 0,
      error: err instanceof Error ? err.message : "Failed to generate fees.",
    };
  }
}

export async function updateFeeRecordAction(input: {
  feeRecordId: string;
  amount: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertFinanceAdmin();
    const safeAmount = Math.max(0, Math.round(Number(input.amount) || 0));

    await withWriteLock(async () => {
      const rec = await db.feeRecord.findUnique({
        where: { id: input.feeRecordId },
      });
      if (!rec) throw new Error("Fee record not found.");
      const nextStatus = computeStatus(safeAmount, rec.paidAmount);
      await db.feeRecord.update({
        where: { id: rec.id },
        data: { amount: safeAmount, status: nextStatus },
      });
    });

    revalidatePath("/admin/fees");
    revalidatePath("/admin/accounts");
    revalidatePath("/fees");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update fee record.",
    };
  }
}

export async function deleteFeeRecordAction(
  feeRecordId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertFinanceAdmin();
    await withWriteLock(() =>
      db.feeRecord.delete({ where: { id: feeRecordId } })
    );
    revalidatePath("/admin/fees");
    revalidatePath("/admin/accounts");
    revalidatePath("/fees");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete fee record.",
    };
  }
}

export async function recordMemberPaymentAction(input: {
  userId: string;
  feeRecordIds: string[];
  contributionIds: string[];
  amount?: number;
  mode: "UPI" | "CASH" | "BANK";
  reference?: string;
  note?: string;
}): Promise<{ ok: boolean; transactionId?: string; error?: string }> {
  try {
    const session = await requireServerSession();
    const isSelf = session.id === input.userId;
    const isAdmin =
      session.role === "ADMIN" ||
      (await hasUserPathAccess(session, "/admin/fees")) ||
      (await hasUserPathAccess(session, "/admin/accounts"));

    if (!isSelf && !isAdmin) {
      return { ok: false, error: "Not authorized to record this payment." };
    }

    if (isSelf && !isAdmin && input.mode === "UPI" && !input.reference?.trim()) {
      return {
        ok: false,
        error: "Please enter your 12-digit UPI UTR / Transaction Reference.",
      };
    }

    if (
      input.feeRecordIds.length === 0 &&
      input.contributionIds.length === 0
    ) {
      return {
        ok: false,
        error: "Select at least one pending monthly fee or event fund item.",
      };
    }

    const txResult = await withWriteLock(() =>
      db.$transaction(async (tx) => {
        const feeRecords =
          input.feeRecordIds.length > 0
            ? await tx.feeRecord.findMany({
                where: {
                  id: { in: input.feeRecordIds },
                  userId: input.userId,
                },
                orderBy: [{ year: "asc" }, { month: "asc" }],
              })
            : [];

        const contributions =
          input.contributionIds.length > 0
            ? await tx.eventContribution.findMany({
                where: {
                  id: { in: input.contributionIds },
                  userId: input.userId,
                },
                orderBy: { createdAt: "asc" },
              })
            : [];

        const totalSelectedDue =
          feeRecords.reduce(
            (sum, r) => sum + Math.max(0, r.amount - r.paidAmount),
            0
          ) +
          contributions.reduce(
            (sum, c) => sum + Math.max(0, c.amount - c.paidAmount),
            0
          );

        const payAmount =
          input.amount !== undefined && input.amount > 0
            ? Math.min(totalSelectedDue, Math.round(input.amount))
            : totalSelectedDue;

        if (payAmount <= 0) {
          throw new Error("Selected items have no remaining balance due.");
        }

        const createdTx = await tx.feeTransaction.create({
          data: {
            userId: input.userId,
            amount: payAmount,
            mode: input.mode,
            reference: input.reference?.trim() || null,
            note: input.note?.trim() || null,
            date: new Date(),
          },
        });

        let remaining = payAmount;

        for (const rec of feeRecords) {
          if (remaining <= 0) break;
          const due = Math.max(0, rec.amount - rec.paidAmount);
          if (due <= 0) continue;
          const alloc = Math.min(due, remaining);
          const nextPaid = rec.paidAmount + alloc;
          await tx.feeRecord.update({
            where: { id: rec.id },
            data: {
              paidAmount: nextPaid,
              status: computeStatus(rec.amount, nextPaid),
            },
          });
          await tx.feeTransactionAllocation.create({
            data: {
              transactionId: createdTx.id,
              feeRecordId: rec.id,
              allocatedAmount: alloc,
            },
          });
          remaining -= alloc;
        }

        for (const contrib of contributions) {
          if (remaining <= 0) break;
          const due = Math.max(0, contrib.amount - contrib.paidAmount);
          if (due <= 0) continue;
          const alloc = Math.min(due, remaining);
          const nextPaid = contrib.paidAmount + alloc;
          await tx.eventContribution.update({
            where: { id: contrib.id },
            data: {
              paidAmount: nextPaid,
              status: computeStatus(contrib.amount, nextPaid),
            },
          });
          await tx.feeTransactionAllocation.create({
            data: {
              transactionId: createdTx.id,
              eventContributionId: contrib.id,
              allocatedAmount: alloc,
            },
          });
          remaining -= alloc;
        }

        return createdTx;
      })
    );

    await recordActivity({
      action: "PAYMENT_RECORDED",
      summary: `Recorded ${formatRupees(txResult.amount)} (${input.mode}) payment`,
      userId: session.id,
      userName: session.name || session.username,
      targetId: txResult.id,
    });

    revalidatePath("/fees");
    revalidatePath("/admin/contributions");
    revalidatePath("/admin/contribution-history");
    revalidatePath("/admin/fees");
    revalidatePath("/admin/accounts");
    return { ok: true, transactionId: txResult.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record payment.",
    };
  }
}

export async function revokeFeeTransactionAction(
  transactionId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const actor = await assertFinanceAdmin();

    await withWriteLock(() =>
      db.$transaction(async (tx) => {
        const feeTx = await tx.feeTransaction.findUnique({
          where: { id: transactionId },
          include: { allocations: true },
        });
        if (!feeTx) {
          throw new Error("Transaction not found.");
        }

        for (const alloc of feeTx.allocations) {
          if (alloc.feeRecordId) {
            const rec = await tx.feeRecord.findUnique({
              where: { id: alloc.feeRecordId },
            });
            if (rec) {
              const revertedPaid = Math.max(
                0,
                rec.paidAmount - alloc.allocatedAmount
              );
              await tx.feeRecord.update({
                where: { id: rec.id },
                data: {
                  paidAmount: revertedPaid,
                  status: computeStatus(rec.amount, revertedPaid),
                },
              });
            }
          }
          if (alloc.eventContributionId) {
            const contrib = await tx.eventContribution.findUnique({
              where: { id: alloc.eventContributionId },
            });
            if (contrib) {
              const revertedPaid = Math.max(
                0,
                contrib.paidAmount - alloc.allocatedAmount
              );
              await tx.eventContribution.update({
                where: { id: contrib.id },
                data: {
                  paidAmount: revertedPaid,
                  status: computeStatus(contrib.amount, revertedPaid),
                },
              });
            }
          }
        }

        await tx.feeTransaction.delete({ where: { id: transactionId } });
      })
    );

    await recordActivity({
      action: "TRANSACTION_REVOKED",
      summary: `Revoked payment transaction ${transactionId} and restored member balances`,
      userId: actor.id,
      userName: actor.name || actor.username,
      targetId: transactionId,
    });

    revalidatePath("/fees");
    revalidatePath("/admin/fees");
    revalidatePath("/admin/accounts");
    revalidatePath("/admin/contribution-history");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Failed to revoke transaction.",
    };
  }
}

export async function createEventContributionCampaignAction(input: {
  title: string;
  amount: number;
  userIds?: string[]; // empty or omitted => all non-watcher members
}): Promise<{ ok: boolean; createdCount: number; error?: string }> {
  try {
    const actor = await assertFinanceAdmin();
    const title = input.title.trim();
    const safeAmount = Math.max(1, Math.round(Number(input.amount) || 0));
    if (!title) {
      return { ok: false, createdCount: 0, error: "Campaign title is required." };
    }

    const targetUsers =
      input.userIds && input.userIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: input.userIds } },
            select: { id: true },
          })
        : await db.user.findMany({
            select: { id: true },
          });

    let createdCount = 0;
    await withWriteLock(() =>
      db.$transaction(async (tx) => {
        for (const u of targetUsers) {
          const existing = await tx.eventContribution.findFirst({
            where: { userId: u.id, title },
          });
          if (existing) continue;
          await tx.eventContribution.create({
            data: {
              userId: u.id,
              title,
              amount: safeAmount,
              paidAmount: 0,
              status: "PENDING",
            },
          });
          createdCount += 1;
        }
      })
    );

    await recordActivity({
      action: "CONTRIBUTION_CAMPAIGN_CREATED",
      summary: `Created "${title}" event contribution (${formatRupees(safeAmount)}) for ${createdCount} members`,
      userId: actor.id,
      userName: actor.name || actor.username,
    });

    revalidatePath("/admin/fees");
    revalidatePath("/admin/accounts");
    revalidatePath("/fees");
    return { ok: true, createdCount };
  } catch (err) {
    return {
      ok: false,
      createdCount: 0,
      error:
        err instanceof Error ? err.message : "Failed to create event campaign.",
    };
  }
}

export async function updateEventContributionAction(input: {
  contributionId: string;
  amount: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertFinanceAdmin();
    const safeAmount = Math.max(0, Math.round(Number(input.amount) || 0));

    await withWriteLock(async () => {
      const existing = await db.eventContribution.findUnique({
        where: { id: input.contributionId },
      });
      if (!existing) throw new Error("Contribution record not found.");
      await db.eventContribution.update({
        where: { id: existing.id },
        data: {
          amount: safeAmount,
          status: computeStatus(safeAmount, existing.paidAmount),
        },
      });
    });

    revalidatePath("/admin/fees");
    revalidatePath("/admin/accounts");
    revalidatePath("/fees");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update record.",
    };
  }
}

export async function deleteEventContributionAction(
  contributionId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertFinanceAdmin();
    await withWriteLock(() =>
      db.eventContribution.delete({ where: { id: contributionId } })
    );
    revalidatePath("/admin/fees");
    revalidatePath("/admin/accounts");
    revalidatePath("/fees");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete record.",
    };
  }
}

export async function deleteContributionCampaignByTitleAction(
  title: string
): Promise<{ ok: boolean; deletedCount: number; error?: string }> {
  try {
    const actor = await assertFinanceAdmin();
    const res = await withWriteLock(() =>
      db.eventContribution.deleteMany({
        where: { title, paidAmount: 0 },
      })
    );
    await recordActivity({
      action: "CONTRIBUTION_CAMPAIGN_CLEANED",
      summary: `Removed ${res.count} unpaid "${title}" records`,
      userId: actor.id,
      userName: actor.name || actor.username,
    });
    revalidatePath("/admin/fees");
    revalidatePath("/admin/accounts");
    revalidatePath("/fees");
    return { ok: true, deletedCount: res.count };
  } catch (err) {
    return {
      ok: false,
      deletedCount: 0,
      error: err instanceof Error ? err.message : "Failed to remove campaign.",
    };
  }
}
