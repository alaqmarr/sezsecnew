import { connection, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { fetchBridgeEvents } from "@sezsec/bridge";
import { db } from "@sezsec/db";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import { formatIST, MONTH_NAMES_SHORT } from "@sezsec/shared";

export type ExportDatasetType =
  | "USERS"
  | "ACCOUNTS"
  | "EVENTS"
  | "CONTRIBUTIONS"
  | "PENDING_FEES"
  | "PAID_HISTORY"
  | "TEMPLATE_USERS";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const type = (url.searchParams.get("type") || "USERS") as ExportDatasetType;

  const auth = await requireApiAuth({
    path: type === "TEMPLATE_USERS" ? "/admin/users" : "/admin/exports",
  });
  if (!auth.ok) return auth.response;

  let rows: Record<string, unknown>[] = [];
  let sheetName = "Report";
  let filePrefix = "sezsec-export";

  if (type === "TEMPLATE_USERS") {
    sheetName = "BulkUsersTemplate";
    filePrefix = "sezsec-members-template";
    rows = [
      {
        Username: "30405060",
        ITS: "30405060",
        Name: "Mulla Example Bhai",
        Email: "member@example.com",
        Mobile: "9876543210",
        Role: "USER",
        Password: "ChangeMe123",
        MonthlyFee: 500,
      },
    ];
  } else if (type === "USERS") {
    sheetName = "Members";
    filePrefix = "sezsec-members-directory";
    const users = await db.user.findMany({
      orderBy: { name: "asc" },
      include: {
        feeConfig: true,
        headedBy: { select: { name: true, username: true } },
        floorHeadOf: { select: { name: true } },
        floorSubHeadOf: { select: { name: true } },
        floorMemberOf: { select: { name: true } },
      },
    });

    rows = users.map((u) => ({
      "ITS Number": u.its || "",
      Username: u.username,
      "Full Name": u.name || "",
      Role: u.role,
      Mobile: u.mobile || "",
      Email: u.email || "",
      "DOB": u.dob ? formatIST(u.dob, "yyyy-MM-dd") : "",
      "Monthly Contribution (INR)": u.feeConfig?.amount ?? 0,
      "Floor Head Of": u.floorHeadOf.map((f) => f.name).join(", "),
      "Floor Sub-Head Of": u.floorSubHeadOf.map((f) => f.name).join(", "),
      "Floor Member Of": u.floorMemberOf.map((f) => f.name).join(", "),
      "Quran Hifz": u.quranHifz || "",
      Occupation: u.occupation || "",
      Sports: u.sports || "",
      "Profile Status": u.profileStatus || "INCOMPLETE",
    }));
  } else if (type === "ACCOUNTS") {
    sheetName = "AccountsSummary";
    filePrefix = "sezsec-accounts-standing";
    const users = await db.user.findMany({
      orderBy: { name: "asc" },
      include: {
        feeConfig: true,
        feeRecords: true,
        eventContributions: true,
      },
    });

    rows = users.map((u) => {
      const monthlyBilled = u.feeRecords.reduce((s, r) => s + r.amount, 0);
      const monthlyPaid = u.feeRecords.reduce((s, r) => s + r.paidAmount, 0);
      const monthlyPending = Math.max(0, monthlyBilled - monthlyPaid);

      const contribBilled = u.eventContributions.reduce((s, c) => s + c.amount, 0);
      const contribPaid = u.eventContributions.reduce(
        (s, c) => s + c.paidAmount,
        0
      );
      const contribPending = Math.max(0, contribBilled - contribPaid);

      return {
        ITS: u.its || "",
        Username: u.username,
        Name: u.name || "",
        Mobile: u.mobile || "",
        "Monthly Rate": u.feeConfig?.amount ?? 0,
        "Monthly Billed": monthlyBilled,
        "Monthly Paid": monthlyPaid,
        "Monthly Pending": monthlyPending,
        "Event Funds Billed": contribBilled,
        "Event Funds Paid": contribPaid,
        "Event Funds Pending": contribPending,
        "Total Outstanding": monthlyPending + contribPending,
      };
    });
  } else if (type === "EVENTS") {
    sheetName = "JamaatEvents";
    filePrefix = "sezsec-miqaats-events";
    const events = await fetchBridgeEvents({ order: "desc", limit: 1000 }).catch(
      () => []
    );
    const attendanceCounts = await db.attendanceRecord.groupBy({
      by: ["eventId", "status"],
      _count: { _all: true },
    });
    const presentByEvent = new Map<string, number>();
    for (const grp of attendanceCounts) {
      if (grp.status === "PRESENT") {
        presentByEvent.set(grp.eventId, grp._count._all);
      }
    }

    rows = events.map((ev) => ({
      Reference: ev.reference || ev.id,
      "Occasion / Miqaat": ev.description || ev.name,
      "Host / Organizer": ev.name,
      Type: ev.eventType,
      Status: ev.status,
      Date: formatIST(ev.occasionDate, "dd MMM yyyy"),
      Time: ev.occasionTime,
      Halls: ev.hall.join(", "),
      "Expected Thaals": ev.thaalCount,
      "Actual Thaals Done": ev.totalThaalsDone ?? "",
      "SEZ Members Present": presentByEvent.get(ev.id) ?? 0,
      Menu: ev.menu || "",
    }));
  } else if (type === "CONTRIBUTIONS") {
    sheetName = "EventFunds";
    filePrefix = "sezsec-event-contributions";
    const contribs = await db.eventContribution.findMany({
      orderBy: [{ title: "asc" }, { createdAt: "desc" }],
      include: {
        user: { select: { name: true, username: true, its: true, mobile: true } },
      },
    });

    rows = contribs.map((c) => ({
      "Campaign / Title": c.title,
      ITS: c.user.its || "",
      Username: c.user.username,
      "Member Name": c.user.name || "",
      Mobile: c.user.mobile || "",
      "Assigned Amount": c.amount,
      "Paid Amount": c.paidAmount,
      Balance: Math.max(0, c.amount - c.paidAmount),
      Status: c.status,
      "Created Date": formatIST(c.createdAt, "dd MMM yyyy"),
    }));
  } else if (type === "PENDING_FEES") {
    sheetName = "PendingFeesMatrix";
    filePrefix = "sezsec-pending-fees-matrix";
    const pendingRecords = await db.feeRecord.findMany({
      where: { status: { in: ["PENDING", "PARTIAL"] } },
      include: {
        user: { select: { id: true, name: true, username: true, its: true, mobile: true } },
      },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });

    const periodKeys: string[] = [];
    const seenPeriods = new Set<string>();
    for (const r of pendingRecords) {
      const label = `${MONTH_NAMES_SHORT[r.month] || r.month} ${r.year}`;
      if (!seenPeriods.has(label)) {
        seenPeriods.add(label);
        periodKeys.push(label);
      }
    }

    const byUser = new Map<string, Record<string, unknown>>();
    for (const r of pendingRecords) {
      const due = Math.max(0, r.amount - r.paidAmount);
      if (due <= 0) continue;
      let entry = byUser.get(r.userId);
      if (!entry) {
        entry = {
          ITS: r.user.its || "",
          Username: r.user.username,
          Name: r.user.name || "",
          Mobile: r.user.mobile || "",
        };
        for (const pk of periodKeys) entry[pk] = 0;
        entry["Total Pending"] = 0;
        byUser.set(r.userId, entry);
      }
      const label = `${MONTH_NAMES_SHORT[r.month] || r.month} ${r.year}`;
      entry[label] = Number(entry[label] || 0) + due;
      entry["Total Pending"] = Number(entry["Total Pending"] || 0) + due;
    }

    rows = [...byUser.values()];
  } else if (type === "PAID_HISTORY") {
    sheetName = "Transactions";
    filePrefix = "sezsec-payment-transactions";
    const txs = await db.feeTransaction.findMany({
      orderBy: { date: "desc" },
      include: {
        user: { select: { name: true, username: true, its: true } },
        allocations: {
          include: {
            feeRecord: true,
            eventContribution: true,
          },
        },
      },
    });

    rows = txs.map((t) => ({
      "Transaction ID": t.id,
      Date: formatIST(t.date, "dd MMM yyyy hh:mm a"),
      ITS: t.user.its || "",
      Username: t.user.username,
      "Member Name": t.user.name || "",
      "Amount Paid (INR)": t.amount,
      Mode: t.mode,
      Reference: t.reference || "",
      Allocations: t.allocations
        .map((a) => {
          if (a.feeRecord) {
            return `${MONTH_NAMES_SHORT[a.feeRecord.month]} ${a.feeRecord.year} (₹${a.allocatedAmount})`;
          }
          if (a.eventContribution) {
            return `${a.eventContribution.title} (₹${a.allocatedAmount})`;
          }
          return `₹${a.allocatedAmount}`;
        })
        .join("; "),
      Note: t.note || "",
    }));
  }

  const worksheet = XLSX.utils.json_to_sheet(
    rows.length > 0 ? rows : [{ Notice: "No records found for this report" }]
  );
  const keys = Object.keys(rows[0] || { Notice: "" });
  worksheet["!cols"] = keys.map((k) => ({
    wch: Math.max(k.length + 4, 16),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const stamp = formatIST(new Date(), "yyyy-MM-dd");
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filePrefix}-${stamp}.xlsx"`,
    },
  });
}
