import Link from "next/link";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";

const recoveryLinks = [
  {
    label: "Back to Home",
    href: "/",
    primary: true,
  },
  {
    label: "Documentation",
    href: "/docs",
    primary: false,
  },
  {
    label: "View Models",
    href: "/models",
    primary: false,
  },
] as const;

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f7f3eb] px-[26px] pb-8 pt-[6px] text-[#111111] sm:px-8 lg:px-[26px]">
      <div>
        <SiteHeader />

        <PageContainer>
          <div className="border-t border-[#c8bfae]" />

          <section className="flex min-h-[calc(100vh-180px)] flex-col justify-between py-10 sm:py-14 lg:py-16">
            <div className="max-w-[760px]">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#6e6a63]">404 - Not Found</p>

              <div className="mt-12 border border-[#c8bfae] bg-[#fbfaf7] px-5 py-6 shadow-[4px_4px_0_0_#d9d2c7] sm:px-8 sm:py-8">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#6e6a63]">SYS_ERR // NOT_FOUND</p>

                <h1 className="mt-6 text-[82px] font-semibold leading-none tracking-[-0.1em] text-black sm:text-[116px] lg:text-[148px]">
                  404
                </h1>

                <div className="mt-6 max-w-[420px] space-y-2 text-[13px] leading-[1.7] text-[#68645c] sm:text-[14px]">
                  <p>The page you requested is unavailable in the current index.</p>
                  <p>It may have been moved, renamed, or never initialized.</p>
                </div>

                <div className="mt-8 flex flex-wrap gap-[10px] text-[10px] uppercase tracking-[0.16em] sm:mt-10">
                  {recoveryLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={
                        link.primary
                          ? "border border-black bg-black px-[14px] py-[10px] text-white"
                          : "border border-[#bfb6a8] px-[14px] py-[10px] text-black"
                      }
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <footer className="mt-12 border-t border-[#c8bfae] pt-4 text-[10px] uppercase tracking-[0.18em] text-[#6e6a63] sm:mt-16">
              DWIPA // ROUTE_INDEX
            </footer>
          </section>
        </PageContainer>
      </div>
    </main>
  );
}
