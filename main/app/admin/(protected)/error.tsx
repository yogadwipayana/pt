"use client";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <div className="border border-[#b8b1a5] bg-[#fbfaf7] p-5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#7d2f2f]">Unable to load admin page.</p>
      <button type="button" onClick={reset} className="mt-4 min-h-[44px] border border-black px-4 text-[8px] uppercase tracking-[0.16em] text-black">
        Try again
      </button>
    </div>
  );
}
