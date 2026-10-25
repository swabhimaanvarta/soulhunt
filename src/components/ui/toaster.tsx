"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Info, Sparkles } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right" duration={4500}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="shrink-0 mt-0.5">
                {variant === "destructive" ? (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                ) : variant === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : variant === "cyber" ? (
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Info className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

