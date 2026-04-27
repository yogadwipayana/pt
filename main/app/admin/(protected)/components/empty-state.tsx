import { adminCopy } from "@/content/admin";

export function AdminEmptyState({ title = adminCopy.emptyTitle, description = adminCopy.emptyDescription }: { title?: string; description?: string }) {
  return (
    <div className="border border-[#b8b1a5] bg-[#fbfaf7] px-5 py-10 text-center">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#5f5a53]">{title}</p>
      <p className="mx-auto mt-2 max-w-[360px] text-[11px] leading-[1.55] text-[#8a847a]">{description}</p>
    </div>
  );
}
