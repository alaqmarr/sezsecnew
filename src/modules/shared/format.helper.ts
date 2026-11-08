export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export function formatRupees(
  amount: number | null | undefined,
  withSymbol = true
): string {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) return withSymbol ? "₹0" : "0";
  const formatted = Math.round(num).toLocaleString("en-IN");
  return withSymbol ? `₹${formatted}` : formatted;
}

export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getHallModuleId(hallName: string): string {
  return `hall-${slugify(hallName)}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "your registered email";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0] ?? "*"}***@${domain}`;
  }
  return `${local.slice(0, 2)}${"*".repeat(Math.min(5, local.length - 2))}@${domain}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const MONTH_NAMES_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  ADMIN_CUSTOM: "Custom Administrator",
  MANAGER: "Committee Manager",
  STAFF: "Committee Staff",
  WATCHER: "Observer",
  USER: "Committee Member",
};
