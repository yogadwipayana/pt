"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

export function AdminAuditFilterModal({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="min-h-[44px] rounded-none border border-black px-4 text-[10px] uppercase tracking-[0.14em] text-black hover:bg-black hover:text-white"
      >
        Filters
      </button>

      <dialog ref={dialogRef} aria-labelledby="audit-filter-title" aria-describedby="audit-filter-description" className="m-auto w-[min(680px,calc(100vw-32px))] max-w-none rounded-none border border-black bg-[#fbfaf7] p-0 text-black backdrop:bg-black/35">
        <div className="border-b border-[#d8d0c3] px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p id="audit-filter-title" className="text-[10px] uppercase tracking-[0.14em] text-[#5f5a53]">Audit filters</p>
              <p id="audit-filter-description" className="mt-1 text-[12px] text-[#8a847a]">Refine admin mutation events.</p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-none text-[18px] leading-none text-black hover:bg-[#f2eee7]"
              aria-label="Close filters"
            >
              ×
            </button>
          </div>
        </div>
        {children}
      </dialog>
    </div>
  );
}
