import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return <div className={["mx-auto w-full max-w-[1010px] px-4 sm:px-7", className].filter(Boolean).join(" ")}>{children}</div>;
}
