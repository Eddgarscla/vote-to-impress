import { cn } from "@/lib/cn";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 text-accent", className)} aria-hidden="true">
      <path fill="currentColor" d="M16 2.2 19.2 11H28l-7.2 5.2 2.7 8.6L16 19.8 8.5 24.8l2.7-8.6L4 11h8.8L16 2.2z" />
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={cn("brand-track font-game text-sm", light ? "text-paper" : "text-ink")}>
      VOTE TO IMPRESS
    </span>
  );
}
