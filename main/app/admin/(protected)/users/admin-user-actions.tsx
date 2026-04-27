"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { webApi, WebApiError } from "@/lib/web-api";

export function AdminUserActions({
  userId,
  currentPlanSlug,
  currentEmail,
  currentName,
  currentStatus,
}: {
  userId: string;
  currentPlanSlug: string;
  currentEmail: string;
  currentName: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(currentEmail);
  const [name, setName] = useState(currentName);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [targetPlanSlug, setTargetPlanSlug] = useState(currentPlanSlug);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isBanned = currentStatus === "banned";
  const hasReason = reason.trim().length > 0;

  const requireReason = (actionLabel = "This action") => {
    if (!reason.trim()) {
      setErrorMessage(`${actionLabel} requires a reason.`);
      return false;
    }
    return true;
  };

  const addCredit = () => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Enter a positive credit amount.");
      return;
    }
    if (!requireReason("Adding credit")) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        await webApi.addAdminUserPaygCredit(userId, { amountMinor: Math.round(parsedAmount * 100), currency: "USD", reason: reason.trim(), idempotencyKey: crypto.randomUUID() });
        setSuccessMessage("PayG credit updated.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to add credit.");
      }
    });
  };

  const changePlan = () => {
    if (!requireReason("Changing subscription")) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        await webApi.changeAdminUserSubscription(userId, {
          targetPlanSlug,
          effectiveMode: "immediate",
          reason: reason.trim(),
          idempotencyKey: crypto.randomUUID(),
        });
        setSuccessMessage("Subscription updated.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to change subscription.");
      }
    });
  };

  const saveProfile = () => {
    if (!email.trim() || !name.trim()) {
      setErrorMessage("Name and email are required.");
      return;
    }
    if (!requireReason("Saving profile changes")) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        await webApi.updateAdminUser(userId, {
          email: email.trim(),
          name: name.trim(),
          planSlug: targetPlanSlug,
          reason: reason.trim(),
        });
        setSuccessMessage("User profile updated.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to update user.");
      }
    });
  };

  const toggleBan = () => {
    if (!requireReason(isBanned ? "Unbanning a user" : "Banning a user")) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        const response = await webApi.banAdminUser(userId, { reason: reason.trim() });
        setSuccessMessage(response.action === "banned" ? "User has been banned." : "User has been reactivated.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to change user status.");
      }
    });
  };

  const removeUser = () => {
    if (!requireReason("Deleting a user")) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        await webApi.deleteAdminUser(userId, { reason: reason.trim() });
        router.push("/admin/users");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to delete user.");
      }
    });
  };

  return (
    <div className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">Admin actions</p>
        <span className="border border-[#b8b1a5] px-2 py-1 text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
          {currentStatus}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="PayG credit amount" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
        <select value={targetPlanSlug} onChange={(event) => setTargetPlanSlug(event.target.value)} className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]">
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="payg">Pay as you go</option>
        </select>
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required reason" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
      </div>
      <p className="mt-2 text-[10px] text-[#7a746b]">
        Fill <span className="text-black">Required reason</span> before save, ban, unban, delete, credit, or subscription actions.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button disabled={isPending || !hasReason} onClick={saveProfile} className="min-h-[44px] rounded-none border border-black px-4 text-[8px] uppercase tracking-[0.16em] text-black disabled:opacity-60 sm:text-[9px]">
          Save profile
        </button>
        <button disabled={isPending || !hasReason} onClick={addCredit} className="min-h-[44px] rounded-none bg-black px-4 text-[8px] uppercase tracking-[0.16em] text-white disabled:opacity-60 sm:text-[9px]">Add PayG credit</button>
        <button disabled={isPending || !hasReason} onClick={changePlan} className="min-h-[44px] rounded-none border border-black px-4 text-[8px] uppercase tracking-[0.16em] text-black disabled:opacity-60 sm:text-[9px]">Change subscription</button>
        <button disabled={isPending || !hasReason} onClick={toggleBan} className="min-h-[44px] rounded-none border border-[#7d5d1f] px-4 text-[8px] uppercase tracking-[0.16em] text-[#7d5d1f] disabled:opacity-60 sm:text-[9px]">
          {isBanned ? "Unban user" : "Ban user"}
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <button disabled={isPending || !hasReason} onClick={removeUser} className="min-h-[44px] rounded-none border border-[#7d2f2f] px-4 text-[8px] uppercase tracking-[0.16em] text-[#7d2f2f] disabled:opacity-60 sm:text-[9px]">
          Delete user
        </button>
        <Link href="/admin/users" className="flex min-h-[44px] rounded-none items-center justify-center border border-[#b8b1a5] px-4 text-[8px] uppercase tracking-[0.16em] text-[#5f5a53] sm:text-[9px]">
          Back to users
        </Link>
      </div>
      {errorMessage ? <p className="mt-3 text-[10px] text-[#7d2f2f]">{errorMessage}</p> : null}
      {successMessage ? <p className="mt-3 text-[10px] text-[#345140]">{successMessage}</p> : null}
    </div>
  );
}
