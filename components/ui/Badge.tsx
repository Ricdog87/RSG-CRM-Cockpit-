import { cn } from "@/components/ui/cn";

type Tone = "neutral" | "brand" | "sky" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-border bg-elevated text-muted",
  brand: "border-brand/30 bg-brand/10 text-brand-deep",
  sky: "border-sky/30 bg-sky/10 text-sky-deep",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
