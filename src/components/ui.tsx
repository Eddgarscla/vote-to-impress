import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "line" | "ghost" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-medium transition-transform duration-150 active:scale-[0.98] disabled:opacity-50",
        variant === "primary" && "btn-glow",
        variant === "line" && "border border-line bg-surface text-ink",
        variant === "ghost" && "bg-transparent text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none placeholder:text-muted/80 focus:border-ink",
        props.className,
      )}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-xl border border-line bg-surface px-3 py-3 text-base text-ink outline-none placeholder:text-muted/80 focus:border-ink",
        props.className,
      )}
    />
  );
}

export function NumberField({
  label,
  value,
  onChange,
  max = 1000000,
}: {
  label?: string;
  value: number;
  onChange: (value: number | null) => void;
  max?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const input = (
    <input
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      value={shown}
      onFocus={() => setDraft((current) => current ?? String(value))}
      onChange={(event) => {
        const raw = event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
        setDraft(raw);
        onChange(raw === "" ? null : Math.min(max, Number(raw)));
      }}
      onBlur={() => setDraft(null)}
      className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none focus:border-ink"
    />
  );
  if (!label) return input;
  return <Field label={label}>{input}</Field>;
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-3 px-4 py-5" role="status" aria-live="polite" aria-label={label}>
      <div className="h-4 w-28 animate-pulse rounded-full bg-chip" />
      <div className="aspect-[4/5] w-full animate-pulse bg-chip" />
      <div className="h-3 w-2/3 animate-pulse rounded-full bg-chip" />
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const text = /unauthorized/i.test(message) ? "Please log in again." : message;
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-sm text-muted">{text}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-4 text-sm font-medium underline underline-offset-4">
          Try again
        </button>
      ) : null}
    </div>
  );
}
