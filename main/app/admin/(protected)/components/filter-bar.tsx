import type { ReactNode } from "react";

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 border border-[#d8d0c3] bg-[#fbfaf7] p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
