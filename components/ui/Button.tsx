import { cn } from "@/components/ui/cn";

type Variant = "primary" | "ghost" | "subtle";

const variants: Record<Variant, string> = {
  primary:
    "bg-purple-deep text-white hover:bg-purple-ink shadow-glow disabled:opacity-60",
  ghost:
    "border border-border bg-surface text-ink hover:bg-elevated disabled:opacity-60",
  subtle: "bg-elevated text-ink hover:bg-border disabled:opacity-60",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
