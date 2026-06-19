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

const sizes: Record<"sm" | "md", string> = {
  sm: "gap-1 px-2 py-0.5 text-[0.7rem]",
  md: "gap-1.5 px-2.5 py-0.5 text-xs",
};

export function Badge({
  children,
  tone = "neutral",
  size = "md",
  title,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        sizes[size],
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
