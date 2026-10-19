import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** The club runs on Malaysia time; pass this to every date format so server-rendered
 * HTML (Vercel runs in UTC) matches what the browser renders. */
export const CLUB_TIME_ZONE = "Asia/Kuala_Lumpur";

export function formatCurrency(amount: number | string, currency = "RM"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${currency} ${num.toFixed(2)}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-MY", {
    timeZone: CLUB_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-MY", {
    timeZone: CLUB_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
