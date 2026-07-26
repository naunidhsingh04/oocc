"use client";

import * as RadixToast from "@radix-ui/react-toast";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { CloseIcon } from "../icons";
import { cn } from "../lib/cn";

export const ToastProvider = RadixToast.Provider;

export function ToastViewport({ className }: { className?: string }) {
  return (
    <RadixToast.Viewport
      className={cn(
        "fixed bottom-4 right-4 z-50 flex w-full max-w-sm list-none flex-col gap-2 outline-none",
        className,
      )}
    />
  );
}

export type ToastTone = "neutral" | "ok" | "warn" | "mutate";

export interface ToastProps extends Omit<ComponentProps<typeof RadixToast.Root>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
}

const toneBorder: Record<ToastTone, string> = {
  neutral: "border-rule",
  ok: "border-ok",
  warn: "border-warn",
  mutate: "border-mutate",
};

export const Toast = forwardRef<HTMLLIElement, ToastProps>(function Toast(
  { title, description, tone = "neutral", className, ...props },
  ref,
) {
  return (
    <RadixToast.Root
      ref={ref}
      className={cn(
        "grid grid-cols-[1fr_auto] items-start gap-x-3 rounded-control border bg-panel p-3 shadow-menu",
        toneBorder[tone],
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <RadixToast.Title className="font-body text-sm font-medium text-ink">{title}</RadixToast.Title>
        {description ? (
          <RadixToast.Description className="font-body text-sm text-ink-soft">
            {description}
          </RadixToast.Description>
        ) : null}
      </div>
      <RadixToast.Close aria-label="Dismiss" className="text-ink-soft transition-colors hover:text-ink">
        <CloseIcon />
      </RadixToast.Close>
    </RadixToast.Root>
  );
});
