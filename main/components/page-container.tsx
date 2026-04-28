import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return <div className={["mx-auto box-border w-[calc(100%-32px)] max-w-[1010px] sm:w-full sm:px-7", className].filter(Boolean).join(" ")}>{children}</div>;
}
