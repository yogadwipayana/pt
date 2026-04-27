"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { readPendingSignupChallenge } from "@/lib/pending-signup";

import { OtpForm } from "./otp-form";

const subscribe = () => () => {};

const getClientSnapshot = () => JSON.stringify(readPendingSignupChallenge());

const getServerSnapshot = () => "null";

export function OtpPanel() {
  const router = useRouter();
  const challenge = JSON.parse(useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)) as ReturnType<
    typeof readPendingSignupChallenge
  >;
  const email = challenge?.email ?? null;
  const hasValidChallenge = Boolean(challenge?.challengeId);

  useEffect(() => {
    if (!hasValidChallenge) {
      router.replace("/sign-up");
    }
  }, [hasValidChallenge, router]);

  if (!hasValidChallenge) {
    return (
      <div className="border border-[#a59e92] bg-[#fbfaf7] px-4 py-5 sm:px-5 sm:py-6">
        <p className="text-[12px] leading-[1.5] text-[#68645c]">
          No active verification session. Redirecting to sign up...
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[#a59e92] bg-[#fbfaf7]">
      <div className="border-b border-[#e0dbd2] px-4 py-2 sm:px-5">
        <p className="text-[11px] uppercase tracking-[0.1em] text-[#7b7469]">
          {email ? `Target: ${email}` : "No active verification session"}
        </p>
      </div>

      <div className="px-4 pb-5 pt-4 sm:px-5 sm:pb-6 sm:pt-5">
        <OtpForm challenge={challenge} />
      </div>
    </div>
  );
}
