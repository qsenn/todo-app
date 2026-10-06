"use client";

import { useEffect, useId, type ReactNode } from "react";

type Props = { title: string; onClose: () => void; children: ReactNode };

export function Modal({ title, onClose, children }: Props) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-md bg-canvas p-6 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="mb-5 text-xl font-semibold tracking-[-0.18px] text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
