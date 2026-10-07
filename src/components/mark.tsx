import { cn } from "@/lib/cn";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 text-ink", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M8.2 8.5h4.1L16 18.4l3.7-9.9h4.1L17.4 24h-2.8L8.2 8.5z" fill="var(--color-paper)" />
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={cn("brand-track font-display text-sm", light ? "text-paper" : "text-ink")}>
      VOTE TO IMPRESS
    </span>
  );
}
