import { connection } from "next/server";
import { Download, FileSpreadsheet } from "lucide-react";
import { requireServerPathAccess } from "@sezsec/rbac/rbac.server";
import { Button, PageHeader } from "@sezsec/ui";

const EXPORT_DATASETS = [
  {
    type: "ACCOUNTS",
    title: "Master Member Ledger & Balances",
    description:
      "Complete member-by-member breakdown of monthly contribution dues, paid totals, event funds, and net outstanding balances.",
  },
  {
    type: "PENDING_FEES",
    title: "Pending Monthly Dues Report",
    description:
      "All unpaid and partially paid monthly fee records with member ITS, contact number, and remaining balance.",
  },
  {
    type: "PAID_HISTORY",
    title: "Paid Transactions & Receipts Register",
    description:
      "Chronological register of all recorded CASH, UPI, and BANK fee receipts with payment references and dates.",
  },
  {
    type: "CONTRIBUTIONS",
    title: "Special Event Contributions Ledger",
    description:
      "All special Miqaat / Shehrullah / Ashara fund pledges, collected amounts, and pending member balances.",
  },
  {
    type: "USERS",
    title: "Full Committee Member Directory",
    description:
      "Complete SEZ Secunderabad directory including 8-digit ITS, username, role, monthly rate, Hifz status, and contact details.",
  },
  {
    type: "EVENTS",
    title: "Jamaat Miqaats & Bookings Schedule",
    description:
      "Live export of scheduled Jamaat occasions, halls, caterers, and thaal counts fetched over loopback from Bookings (:3333).",
  },
  {
    type: "TEMPLATE_USERS",
    title: "Blank Member Import Template",
    description:
      "Clean starter spreadsheet formatted for Bulk Member Import under /admin/users.",
  },
] as const;

export default async function ExportsCenterAdminPage() {
  await connection();
  await requireServerPathAccess("/admin/exports");

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="Data & Reporting"
        title="Excel Reports & Data Exports"
        subtitle="Download live .xlsx spreadsheets directly from the SQLite WAL ledger and Jamaat Bookings bridge."
      />

      <div className="divide-y divide-[#E5DDD0] rounded-2xl border border-[#E5DDD0] bg-white">
        {EXPORT_DATASETS.map((item) => (
          <div
            key={item.type}
            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E5DDD0] bg-[#FAF7F2] text-[#6A1B1B]">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="font-editorial text-xl font-bold text-[#231917]">
                  {item.title}
                </h2>
                <p className="text-xs leading-relaxed text-[#5E4F4A] sm:text-sm">
                  {item.description}
                </p>
              </div>
            </div>

            <a href={`/api/exports?type=${item.type}`} className="shrink-0">
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="h-4 w-4" />}
              >
                Download .xlsx
              </Button>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
