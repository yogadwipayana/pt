import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Dwipa - The API you'll need for AI",
  description:
    "Dwipa gives developers deterministic AI infrastructure with high-throughput outputs, clear telemetry, and direct operational control.",
};

const terminalLines = [
  "curl -X POST https://ai.dwipa.my.id/v1/chat/completions \\",
  "  -H \"Authorization: Bearer $DWIPA_API_KEY\" \\",
  "  -H \"Content-Type: application/json\" \\",
  "  -d '{",
  '  "model": "openai/gpt-5.2",',
  '  "messages": [',
  "    {",
  '      "role": "user",',
  '      "content": "What is the meaning of life?"',
  "    }",
  "  ]",
  "}'",
] as const;

function TerminalWindow() {
  return (
    <div className="w-full max-w-[520px] shadow-[4px_4px_0_0_#2b2b2b] lg:max-w-[640px]">
      <div className="border-[1.5px] border-[#303030] bg-[#f8f6f0]">
        <div className="flex items-center justify-between border-b border-[#303030] px-3 py-[5px] text-[7px] uppercase tracking-[0.18em] text-[#7d7568]">
          <span>Terminal // Int</span>
          <div className="flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] border border-[#303030]" />
            <span className="h-[5px] w-[5px] border border-[#303030]" />
            <span className="h-[5px] w-[5px] border border-[#303030]" />
          </div>
        </div>

        <div className="space-y-5 px-4 py-4 font-mono text-[8px] leading-[1.65] text-[#4d473f] sm:px-5 sm:py-5 sm:text-[9px]">
          <div className="space-y-1">
            {terminalLines.map((line) => (
              <p key={line} className="whitespace-pre-wrap">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f3eb] pb-6 pt-[6px] text-[#111111]">
      <div>
        <SiteHeader />

        <PageContainer>
          <div className="border-t border-[#c8bfae]" />

          <section className="grid gap-8 pb-[54px] pt-[56px] md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.85fr)] md:items-start md:gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10">
            <div className="max-w-[430px] pt-[8px]">
              <div className="inline-flex border border-[#bfb6a8] px-[10px] py-[5px] text-[7px] uppercase tracking-[0.18em] text-[#736b5f]">
                System Online
              </div>

              <h1 className="mt-8 max-w-[380px] text-[38px] font-semibold leading-[0.9] tracking-[-0.08em] text-black sm:text-[52px] lg:text-[56px]">
                The API you&apos;ll need for AI
              </h1>

              <div className="mt-8 max-w-[340px] space-y-[7px] text-[11px] leading-[1.65] text-[#686156]">
                <p>One endpoint for every model you need.</p>
                <p>Low-friction access with transparent usage and billing.</p>
                <p>Designed for builders who want speed and control.</p>
              </div>

              <div className="mt-8 flex flex-wrap gap-[10px] text-[8px] uppercase tracking-[0.16em]">
                <Link href="/signup" className="border border-black bg-black px-[14px] py-[10px] text-white">
                  Get Started
                </Link>
                <Link href="/models" className="border border-[#bfb6a8] px-[14px] py-[10px] text-black">
                  Check Models
                </Link>
              </div>
            </div>

            <div className="pt-1 md:flex md:justify-end lg:pl-2">
              <TerminalWindow />
            </div>
          </section>

          <div className="h-[120px] border-t border-[#c8bfae]" />
        </PageContainer>
      </div>
    </main>
  );
}
