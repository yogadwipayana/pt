import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/page-container";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Beta Tester - Dwipa",
  description:
    "Panduan beta tester Dwipa: register, pilih plan, buat API key, hubungkan aplikasi, lalu kirim report ke grup WA atau Telegram.",
};

const steps = [
  {
    number: "01",
    title: "Register",
    body: "Buat akun di /sign-up lalu login ke Dwipa.",
    href: "/sign-up",
    cta: "Sign Up",
  },
  {
    number: "02",
    title: "Plans",
    body: "Beta tester pakai plan Free. Beberapa beta tester awal mendapat $50 credit. Untuk Pro atau credit tambahan, hubungi WA admin.",
    href: "/pricing",
    cta: "Lihat Pricing",
  },
  {
    number: "03",
    title: "API Keys",
    body: "Buat API key baru di /settings/keys, lalu salin dan simpan dengan aman.",
    href: "/settings/keys",
    cta: "Buat API Key",
  },
  {
    number: "04",
    title: "Hubungkan",
    body: "Pakai endpoint OpenAI-compatible, lalu jalankan test request hingga response berhasil.",
    meta: [
      { label: "Base URL", value: "https://ai.dwipa.my.id/v1" },
      { label: "Endpoint", value: "/v1/chat/completions" },
      { label: "Format", value: "OpenAI-compatible" },
    ],
    href: null,
    cta: null,
  },
] as const;

const reportFields = [
  "Nama:",
  "Email akun:",
  "Plan:",
  "Project/aplikasi:",
  "Model yang dicoba:",
  "Status API key:",
  "Status request:",
  "Kendala:",
  "Screenshot:",
] as const;

const communityLinks = [
  {
    label: "WA Group",
    href: "https://chat.whatsapp.com/HPrp2KTt4Ta9pTVwRLGWLu?mode=hqctcli",
  },
  {
    label: "Telegram",
    href: "https://t.me/+WA8J9FWMWpE0OWU1",
  },
] as const;

export default function BetaTesterPage() {
  return (
    <main className="min-h-screen bg-[#f7f3eb] pb-16 pt-[6px] text-[#111111]">
      <SiteHeader />

      <PageContainer>
        <div className="w-full border-t border-[#c8bfae]" />

        <section className="py-10 sm:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#736b5f]">Beta Tester</p>
              <h1 className="mt-4 text-[32px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[40px]">
                Panduan mulai testing Dwipa.
              </h1>
              <p className="mt-3 max-w-[480px] text-[13px] leading-[1.7] text-[#686156]">
                Empat langkah singkat untuk mulai testing, lalu kirim report ke grup WA atau
                Telegram.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em]">
              <Link
                href="/sign-up"
                className="border border-black bg-black px-4 py-2.5 text-white transition-opacity hover:opacity-80"
              >
                Register
              </Link>
              <Link
                href="/pricing"
                className="border border-[#bfb6a8] px-4 py-2.5 text-black transition-colors hover:border-black"
              >
                View Plans
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="grid gap-3 sm:grid-cols-2">
            {steps.map((step) => (
              <article
                key={step.number}
                className="flex min-h-[220px] flex-col justify-between bg-[#fbfaf7] px-5 py-5 sm:px-6 sm:py-6"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-4 border-b border-[#e0d8cc] pb-3">
                    <h2 className="text-[18px] font-medium leading-[1.3] tracking-[-0.02em] sm:text-[20px]">
                      {step.title}
                    </h2>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[#9a9488]">
                      {step.number}
                    </span>
                  </div>

                  <p className="mt-4 text-[13px] leading-[1.65] text-[#686156]">{step.body}</p>

                  {"meta" in step && step.meta ? (
                    <dl className="mt-4 space-y-2 border-t border-[#ebe5db] pt-4">
                      {step.meta.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-baseline justify-between gap-4"
                        >
                          <dt className="text-[10px] uppercase tracking-[0.14em] text-[#8a847a]">
                            {item.label}
                          </dt>
                          <dd className="font-mono text-[11px] text-[#3e3932]">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>

                {step.href && step.cta ? (
                  <Link
                    href={step.href}
                    className="mt-6 inline-flex w-fit items-center text-[10px] uppercase tracking-[0.16em] text-[#3e3932] underline decoration-[#bfb6a8] underline-offset-[6px] transition-colors hover:text-black hover:decoration-black"
                  >
                    {step.cta} →
                  </Link>
                ) : (
                  <span aria-hidden className="mt-6 block h-[1px]" />
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-3">
          <article className="bg-[#fbfaf7] px-5 py-6 sm:px-7 sm:py-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
              <div>
                <div className="flex items-baseline justify-between gap-4 border-b border-[#e0d8cc] pb-3">
                  <h2 className="text-[20px] font-medium leading-[1.25] tracking-[-0.02em] sm:text-[24px]">
                    Kirim report ke grup.
                  </h2>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[#9a9488]">05</span>
                </div>
                <p className="mt-4 max-w-[460px] text-[13px] leading-[1.65] text-[#686156]">
                  Setelah testing, kirim report ke WA atau Telegram dengan format di samping agar
                  issue atau kebutuhan credit bisa diproses lebih cepat.
                </p>

                <div className="mt-5 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.14em]">
                  {communityLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-black bg-black px-4 py-2.5 text-white transition-opacity hover:opacity-80"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              <pre className="overflow-x-auto rounded bg-[#f3eee6] p-4 font-mono text-[11px] leading-[1.85] text-[#3e3932] sm:text-[12px]">
                {reportFields.join("\n")}
              </pre>
            </div>
          </article>
        </section>
      </PageContainer>
    </main>
  );
}
