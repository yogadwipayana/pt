import type { ReactNode } from "react";

export function AdminTable({ children }: { children: ReactNode }) {
  return <div className="hidden overflow-x-auto border border-[#b8b1a5] bg-[#fbfaf7] md:block">{children}</div>;
}

export function AdminMobileList({ children }: { children: ReactNode }) {
  return <div className="space-y-3 md:hidden">{children}</div>;
}
