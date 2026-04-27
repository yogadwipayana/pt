"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { webApi, WebApiError } from "@/lib/web-api";

export function AdminPaymentActions({ paymentId, status }: { paymentId: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isTerminal = status === "approved" || status === "rejected" || status === "expired";

  const approve = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await webApi.approveAdminPayment(paymentId, { note: note.trim() || undefined, idempotencyKey: crypto.randomUUID() });
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to approve payment.");
      }
    });
  };

  const reject = () => {
    if (!reason.trim()) {
      setErrorMessage("Rejection reason is required.");
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await webApi.rejectAdminPayment(paymentId, { reason: reason.trim(), note: note.trim() || undefined, idempotencyKey: crypto.randomUUID() });
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to reject payment.");
      }
    });
  };

  if (isTerminal) return null;

  return (
    <div className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
      <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">Payment action</p>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Internal note (optional)" className="mt-4 min-h-[88px] w-full rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 py-3 text-[12px]" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button disabled={isPending} onClick={approve} className="min-h-[44px] rounded-none bg-black px-4 text-[8px] uppercase tracking-[0.16em] text-white disabled:opacity-60 sm:text-[9px]">
          Approve payment
        </button>
        <div className="space-y-2">
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Rejection reason" className="min-h-[44px] w-full rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
          <button disabled={isPending} onClick={reject} className="min-h-[44px] w-full rounded-none border border-[#7d2f2f] px-4 text-[8px] uppercase tracking-[0.16em] text-[#7d2f2f] disabled:opacity-60 sm:text-[9px]">
            Reject payment
          </button>
        </div>
      </div>
      {errorMessage ? <p className="mt-3 text-[10px] text-[#7d2f2f]">{errorMessage}</p> : null}
    </div>
  );
}
