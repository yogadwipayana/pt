export function StatusPill({ status }: { status: string }) {
  const normalized = status.replace(/_/g, " ");
  return (
    <span className="inline-flex min-h-[24px] items-center border border-[#b8b1a5] bg-[#f2eee7] px-2 text-[8px] uppercase tracking-[0.12em] text-[#4f4a43] sm:text-[9px]">
      {normalized || "unknown"}
    </span>
  );
}
