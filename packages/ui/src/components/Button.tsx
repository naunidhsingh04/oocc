import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render props onto the single child element (e.g. a next/link `<Link>`) instead of a `<button>`. */
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border-signal bg-signal text-white hover:brightness-110",
  secondary: "border-rule bg-panel text-ink hover:bg-paper",
  ghost: "border-transparent bg-transparent text-ink hover:bg-paper",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 px-2 text-[13px]",
  md: "h-8 gap-2 px-3 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", type = "button", asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-control border font-body font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
});
