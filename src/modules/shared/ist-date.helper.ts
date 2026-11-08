import { formatInTimeZone } from "date-fns-tz";

export const IST_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function formatIST(
  date: Date | string | number,
  formatStr: string = "dd MMM yyyy"
): string {
  const d =
    typeof date === "string" || typeof date === "number"
      ? new Date(date)
      : date;
  if (Number.isNaN(d.getTime())) return "";
  return formatInTimeZone(d, IST_TIMEZONE, formatStr);
}

export function getISTTodayString(now: Date = new Date()): string {
  return formatInTimeZone(now, IST_TIMEZONE, "yyyy-MM-dd");
}

export function getISTDayBounds(dateInput: Date | string): {
  startOfDay: Date;
  endOfDay: Date;
  dateKey: string;
} {
  let year: number;
  let month: number;
  let day: number;
  let dateKey: string;

  if (
    typeof dateInput === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())
  ) {
    dateKey = dateInput.trim();
    const parts = dateKey.split("-").map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    dateKey = formatInTimeZone(d, IST_TIMEZONE, "yyyy-MM-dd");
    const parts = dateKey.split("-").map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
  }

  const startOfDay = new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS
  );
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000 - 1);

  return { startOfDay, endOfDay, dateKey };
}

export function parseTimeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 19 * 60 + 30;
  const trimmed = timeStr.trim();

  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }

  return 19 * 60 + 30;
}

export function formatMinutesTo12h(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
}

export function formatTimeDisplay(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  if (/AM|PM/i.test(timeStr)) return timeStr.trim().toUpperCase();
  if (/^\d{1,2}:\d{2}$/.test(timeStr.trim())) {
    return formatMinutesTo12h(parseTimeToMinutes(timeStr));
  }
  return timeStr;
}

export function parseISTEventDateTime(
  dateInput: Date | string,
  timeStr?: string | null
): Date {
  const { startOfDay } = getISTDayBounds(dateInput);
  const minutes = parseTimeToMinutes(timeStr || "07:30 PM");
  return new Date(startOfDay.getTime() + minutes * 60_000);
}
