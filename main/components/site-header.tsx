"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PageContainer } from "@/components/page-container";
import { webApi } from "@/lib/web-api";

type SiteHeaderProps = {
  className?: string;
};

const navigationLinks = [
  { label: "Home", href: "/" },
  { label: "Models", href: "/models" },
  { label: "Pricing", href: "/pricing" },
  { label: "Beta", href: "/beta-tester" },
] as const;

function HeaderActions({ authenticated, onLogout }: { authenticated: boolean | null; onLogout: () => void }) {
  if (authenticated === null) {
    return <div className="h-8 w-8" aria-hidden="true" />;
  }

  if (authenticated) {
    return (
      <>
        <Link href="/settings/usage" className="text-[11px] text-black">
          Settings
        </Link>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Logout"
          className="inline-flex h-8 w-8 items-center justify-center bg-black text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
        </button>
      </>
    );
  }

  return (
    <>
      <Link href="/sign-in" className="text-[11px] text-black">
        Sign In
      </Link>
      <Link href="/sign-up" className="border border-black bg-black px-2 py-1 text-[11px] text-white">
        Sign Up
      </Link>
    </>
  );
}

export function SiteHeader({ className = "" }: SiteHeaderProps) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void webApi
      .getSession({ cache: "no-store" })
      .then((session) => {
        if (isCurrent) {
          setAuthenticated(session.authenticated);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setAuthenticated(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleLogout = () => {
    void webApi.logout().finally(() => {
      setAuthenticated(false);
      router.push("/");
      router.refresh();
    });
  };

  return (
    <PageContainer className={className}>
      <header className="flex w-full flex-col gap-3 border-t border-[#bdb7ab] py-3 text-[11px] uppercase tracking-[0.16em] text-[#7b7469] sm:text-[12px] md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex items-center justify-between gap-4 md:flex-none">
          <Link href="/" className="-ml-1 flex items-center text-black sm:ml-0">
            <Image
              src="/logo-side.svg"
              alt="Dwipa"
              width={260}
              height={86}
              className="h-8 w-auto sm:h-9"
              priority
            />
          </Link>

          <div className="flex items-center gap-2 text-[11px] md:hidden">
            <HeaderActions authenticated={authenticated} onLogout={handleLogout} />
          </div>
        </div>

        <nav className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-[10px] tracking-[0.12em] text-[#6e6a63] sm:gap-x-6 sm:text-[12px] sm:tracking-[0.16em] md:flex-1 md:justify-center">
          {navigationLinks.map((link) => (
            <Link key={link.label} href={link.href} className="py-2 hover:text-black">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <HeaderActions authenticated={authenticated} onLogout={handleLogout} />
        </div>
      </header>
    </PageContainer>
  );
}
