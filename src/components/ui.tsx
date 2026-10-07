import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10", className)}>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "danger" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-secondary text-secondary-foreground",
        tone === "danger" && "bg-destructive text-destructive-foreground",
        tone === "outline" && "bg-card text-foreground ring-1 ring-border",
      )}
    >
      {children}
    </span>
  );
}

export const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export function buttonClass(variant: "primary" | "outline" | "ghost" = "primary", extra?: string) {
  return cn(
    "inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors",
    variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
    variant === "outline" && "bg-card text-foreground ring-1 ring-border hover:bg-muted",
    variant === "ghost" && "h-9 min-w-9 bg-transparent px-2 text-foreground hover:bg-muted",
    extra,
  );
}
