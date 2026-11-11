"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Bottom sheet modal. */
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="Fechar" className="absolute inset-0 animate-[fade-up_.25s_ease_both] bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md animate-[sheet-in_.35s_cubic-bezier(.2,.9,.25,1)_both] rounded-t-[28px] border border-line bg-[#12301f] px-5 pb-[calc(20px+var(--safe-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/15" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{title}</div>
          <button onClick={onClose} aria-label="Fechar" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/8 text-muted active:scale-95">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
      <style>{`@keyframes sheet-in{from{transform:translateY(100%)}to{transform:none}}`}</style>
    </div>,
    document.body,
  );
}
