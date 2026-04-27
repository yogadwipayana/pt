"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { clearPendingSignupChallenge, type PendingSignupChallenge, writePendingSignupChallenge } from "@/lib/pending-signup";
import { webApi, WebApiError } from "@/lib/web-api";

type OtpFormProps = {
  challenge: PendingSignupChallenge | null;
};

const normalizeOtp = (value: string) => value.replace(/\D/g, "").slice(0, 6);

export function OtpForm({ challenge }: OtpFormProps) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!challenge?.challengeId) {
      setFeedback("Start from sign up to request a verification code.");
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setFeedback("Enter the 6-digit code from your email.");
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await webApi.verifyOtp({
          challengeId: challenge.challengeId,
          otpCode: otp,
        });

        clearPendingSignupChallenge();
        router.push(response.redirectTo || "/settings/usage");
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof WebApiError ? error.message : "Unable to verify this code. Try again.");
      }
    });
  };

  const handleResend = () => {
    if (!challenge?.challengeId) {
      setFeedback("Start from sign up to request a verification code.");
      return;
    }

    setFeedback(null);

    startResendTransition(async () => {
      try {
        const response = await webApi.resendOtp({ challengeId: challenge.challengeId });
        writePendingSignupChallenge({
          challengeId: response.challengeId,
          email: response.email,
          maskedDestination: response.maskedDestination,
          expiresAt: response.expiresAt,
        });
        setFeedback("A new code has been sent.");
      } catch (error) {
        setFeedback(error instanceof WebApiError ? error.message : "Unable to resend the code. Try again.");
      }
    });
  };

  const isError = feedback && feedback !== "A new code has been sent.";

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8a847a]">&gt;</span>
        <input
          id="otp"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          value={otp}
          onChange={(event) => {
            setOtp(normalizeOtp(event.target.value));
            setFeedback(null);
          }}
          className="h-[44px] w-full rounded-none border border-[#9f988c] bg-[#f7f5f2] pl-7 pr-4 font-mono text-[16px] tracking-[0.3em] text-black placeholder:tracking-[0.1em] placeholder:text-[#9a948a]"
        />
      </label>

      {feedback ? (
        <p className={`text-[12px] leading-[1.5] ${isError ? "text-[#7c4d3a]" : "text-[#68645c]"}`}>
          {feedback}
        </p>
      ) : (
        <p className="text-[12px] leading-[1.5] text-[#68645c]">
          Enter the 6-digit code from your email to finish creating the account.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-[36px] w-full items-center justify-center border border-black bg-black px-4 text-[11px] uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-60"
      >
        {isPending ? "Verifying" : "Verify code"}
      </button>

      <div className="flex items-center justify-between border-t border-[#e0dbd2] pt-4">
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="text-[11px] uppercase tracking-[0.08em] text-black underline decoration-[#bdb7ab] underline-offset-4 disabled:opacity-60"
        >
          {isResending ? "Sending" : "Resend code"}
        </button>
        <Link
          href="/sign-up"
          className="text-[11px] uppercase tracking-[0.08em] text-[#6d6962] underline decoration-[#bdb7ab] underline-offset-4 hover:text-black"
        >
          Use another email
        </Link>
      </div>
    </form>
  );
}
