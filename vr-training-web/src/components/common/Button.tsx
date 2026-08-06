import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "../../lib/clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-primary text-primaryInk hover:brightness-110 shadow-glow",
  secondary: "bg-raised text-ink border border-border hover:border-secondary",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-raised",
  danger: "bg-danger/90 text-white hover:bg-danger",
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "text-sm px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
  lg: "text-base px-6 py-3.5 gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
