import { cn } from "@/lib/cn";

const sizes = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src: string | null;
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  if (src) {
    return (
      <span className={cn("avatar-ring inline-grid", className)}>
        <img src={src} alt="" className={cn("bg-chip object-cover", sizes[size])} />
      </span>
    );
  }
  return (
    <span className={cn("avatar-ring inline-grid", className)}>
      <span className={cn("grid place-items-center bg-chip font-display text-ink", sizes[size])}>
        {name.slice(0, 1).toUpperCase()}
      </span>
    </span>
  );
}
