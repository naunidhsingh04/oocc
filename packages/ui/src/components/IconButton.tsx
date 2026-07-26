import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, active = false, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-active={active || undefined}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-control border border-transparent text-ink-soft transition-colors hover:border-rule hover:bg-paper hover:text-ink",
        "data-[active]:border-rule data-[active]:bg-paper data-[active]:text-signal",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
});
