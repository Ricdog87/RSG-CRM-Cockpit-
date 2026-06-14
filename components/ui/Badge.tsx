import { cn } from "@/components/ui/cn";

type Tone = "neutral" | "purple" | "cyan" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-border bg-elevated text-muted",
  purple: "border-purple/30 bg-purple/10 text-purple-soft",
  cyan: "border-cyan/30 bg-cyan/10 text-cyan-soft",
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
