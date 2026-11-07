import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";

type Variant = "primary" | "ghost" | "quiet";

interface Common {
  children: ReactNode;
  variant?: Variant;
  size?: "sm" | "md";
  className?: string;
}

export function PillButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`pill pill--${variant} pill--${size} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

export function PillLink({
  children,
  to,
  variant = "primary",
  size = "md",
  className = "",
}: Common & { to: string }) {
  return (
    <Link to={to} className={`pill pill--${variant} pill--${size} ${className}`.trim()}>
      {children}
    </Link>
  );
}

export function PillExternal({
  children,
  href,
  variant = "ghost",
  size = "md",
  className = "",
}: Common & { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`pill pill--${variant} pill--${size} ${className}`.trim()}
    >
      {children}
    </a>
  );
}
