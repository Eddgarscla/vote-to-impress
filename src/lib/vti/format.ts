import { format, formatDistanceToNowStrict } from "date-fns";

export function compact(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v < 1000) return String(v);
  if (v < 10000) {
    const s = (v / 1000).toFixed(1).replace(/\.0$/, "");
    return `${s}k`;
  }
  return `${Math.round(v / 1000)}k`;
}

export function ago(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "MMM d");
}

export function countdown(endIso: string, now = Date.now()): string {
  const ms = new Date(endIso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "Ended";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m left`;
}

export function placeLabel(place: number): string {
  if (place === 1) return "1st place";
  if (place === 2) return "2nd place";
  if (place === 3) return "3rd place";
  return `${place}th place`;
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function placeMedal(place: number): string | null {
  return MEDALS[place] ?? null;
}
