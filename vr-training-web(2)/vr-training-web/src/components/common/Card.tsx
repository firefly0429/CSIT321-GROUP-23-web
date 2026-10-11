import type { HTMLAttributes, KeyboardEvent } from "react";
import { clsx } from "../../lib/clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
}

/**
 * Cards used as clickable tiles throughout the app (Role Selection,
 * Scenario Selection, Main Menu, ...) were plain `<div onClick={...}>`
 * elements - operable with a mouse, but not reachable or activatable via
 * Tab/Enter/Space for keyboard users. Fixing that here, once, in the
 * shared component covers every existing and future call site instead of
 * requiring the same role/tabIndex/onKeyDown boilerplate to be repeated
 * on every page that uses a clickable Card.
 */
export function Card({ raised, className, children, onClick, onKeyDown, ...rest }: CardProps) {
  const isInteractive = typeof onClick === "function";

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e);
    if (!isInteractive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      (onClick as (e: unknown) => void)(e);
    }
  }

  return (
    <div
      className={clsx(
        "surface-panel rounded-2xl border border-border p-5",
        raised ? "bg-raised" : "bg-surface",
        isInteractive && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary",
        className
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}
