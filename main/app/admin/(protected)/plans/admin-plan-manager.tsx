"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import type { AdminPlanSummary } from "@/lib/web-api";
import { WebApiError, webApi } from "@/lib/web-api";

type PlanFormState = {
  name: string;
  description: string;
  billingType: string;
  priceMinor: string;
  currency: string;
  interval: string;
  includedCreditUsd: string;
  windowHours: string;
  discountPercent: string;
  sortOrder: string;
  active: boolean;
  visible: boolean;
};

function buildInitialState(plan: AdminPlanSummary): PlanFormState {
  return {
    name: plan.name,
    description: plan.description,
    billingType: plan.billingType,
    priceMinor: String(plan.priceMinor ?? 0),
    currency: plan.currency,
    interval: plan.interval || "",
    includedCreditUsd: plan.includedCreditUsd === undefined || plan.includedCreditUsd === null ? "" : String(plan.includedCreditUsd),
    windowHours: plan.windowHours === undefined || plan.windowHours === null ? "" : String(plan.windowHours),
    discountPercent: plan.discountPercent === undefined || plan.discountPercent === null ? "" : String(plan.discountPercent),
    sortOrder: String(plan.sortOrder ?? 0),
    active: plan.active,
    visible: plan.visible,
  };
}

function toOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9.8 3.2 12.8 6.2" />
      <path d="M3.2 10.8 10.7 3.3a2.1 2.1 0 0 1 3 3l-7.5 7.5-3.4.4.4-3.4Z" />
    </svg>
  );
}

function PublishIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2.2v8.6" />
      <path d="M4.5 5.7 8 2.2l3.5 3.5" />
      <path d="M3 10.2v2.6h10v-2.6" />
    </svg>
  );
}

function PlanStatusStack({ active, visible }: { active: boolean; visible: boolean }) {
  return (
    <div className="inline-grid min-w-[124px] grid-cols-[8px_1fr] items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-[#4f4a43]">
      <span className={active ? "h-2 w-2 bg-black" : "h-2 w-2 border border-[#8a847a]"} aria-hidden="true" />
      <span>{active ? "Active" : "Inactive"}</span>
      <span className={visible ? "h-2 w-2 bg-[#8a847a]" : "h-2 w-2 border border-[#c9c1b5]"} aria-hidden="true" />
      <span className="text-[#7a746b]">{visible ? "Visible" : "Hidden"}</span>
    </div>
  );
}

export function AdminPlanManager({ plan, mobile = false }: { plan: AdminPlanSummary; mobile?: boolean }) {
  const variant = mobile ? "mobile" : "desktop";
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<PlanFormState>(buildInitialState(plan));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateField = <K extends keyof PlanFormState>(field: K, value: PlanFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        await webApi.updateAdminPlan(plan.id, {
          name: form.name,
          description: form.description,
          billingType: form.billingType,
          priceMinor: Number(form.priceMinor),
          currency: form.currency,
          interval: form.interval || null,
          includedCreditUsd: toOptionalNumber(form.includedCreditUsd),
          windowHours: toOptionalNumber(form.windowHours),
          discountPercent: toOptionalNumber(form.discountPercent),
          sortOrder: Number(form.sortOrder),
          active: form.active,
          visible: form.visible,
        });
        setSuccessMessage("Plan updated.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to update plan.");
      }
    });
  };

  const publish = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        await webApi.publishAdminPlan(plan.id);
        setSuccessMessage("Plan published.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to publish plan.");
      }
    });
  };

  const editor = (
    <dialog ref={dialogRef} aria-labelledby={`plan-editor-${variant}-${plan.id}`} className="m-auto w-[min(760px,calc(100vw-32px))] max-w-none rounded-none border border-black bg-[#fbfaf7] p-0 text-black backdrop:bg-black/35">
      <div className="border-b border-[#d8d0c3] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p id={`plan-editor-${variant}-${plan.id}`} className="text-[10px] uppercase tracking-[0.14em] text-[#5f5a53]">Edit plan</p>
            <p className="mt-1 text-[16px] leading-none tracking-[-0.03em] text-black">{plan.name}</p>
          </div>
          <button type="button" onClick={() => dialogRef.current?.close()} className="inline-flex h-10 w-10 items-center justify-center rounded-none text-[18px] leading-none text-black hover:bg-[#f2eee7]" aria-label={`Close editor for ${plan.name}`}>
            ×
          </button>
        </div>
      </div>

      <div className="space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Plan name" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
          <input value={form.billingType} onChange={(event) => updateField("billingType", event.target.value)} placeholder="Billing type" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
          <input value={form.priceMinor} onChange={(event) => updateField("priceMinor", event.target.value)} placeholder="Price minor" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
          <input value={form.currency} onChange={(event) => updateField("currency", event.target.value)} placeholder="Currency" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
          <input value={form.interval} onChange={(event) => updateField("interval", event.target.value)} placeholder="Interval" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
          <input value={form.includedCreditUsd} onChange={(event) => updateField("includedCreditUsd", event.target.value)} placeholder="Included credit USD" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
          <input value={form.windowHours} onChange={(event) => updateField("windowHours", event.target.value)} placeholder="Refresh window hours" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
          <input value={form.discountPercent} onChange={(event) => updateField("discountPercent", event.target.value)} placeholder="Discount percent" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
          <input value={form.sortOrder} onChange={(event) => updateField("sortOrder", event.target.value)} placeholder="Sort order" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px]" />
        </div>

        <textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Description" className="min-h-[92px] w-full rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 py-3 text-[12px]" />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-[44px] rounded-none items-center justify-between border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px] text-[#37322d]">
            Active
            <input type="checkbox" checked={form.active} onChange={(event) => updateField("active", event.target.checked)} />
          </label>
          <label className="flex min-h-[44px] rounded-none items-center justify-between border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px] text-[#37322d]">
            Visible
            <input type="checkbox" checked={form.visible} onChange={(event) => updateField("visible", event.target.checked)} />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" disabled={isPending} onClick={save} className="min-h-[44px] rounded-none bg-black px-4 text-[9px] uppercase tracking-[0.16em] text-white disabled:opacity-60">
            Save plan
          </button>
          {errorMessage ? <p className="text-[10px] text-[#7d2f2f]">{errorMessage}</p> : null}
          {successMessage ? <p className="text-[10px] text-[#345140]">{successMessage}</p> : null}
        </div>
      </div>
    </dialog>
  );

  const actions = (
    <div className="flex gap-2">
      <button type="button" aria-label={`Edit ${plan.name}`} title="Edit" onClick={() => dialogRef.current?.showModal()} className="inline-flex h-10 w-10 items-center justify-center rounded-none text-black hover:bg-black hover:text-white">
        <EditIcon />
      </button>
      <button type="button" aria-label={`Publish ${plan.name}`} title="Publish" disabled={isPending} onClick={publish} className="inline-flex h-10 w-10 items-center justify-center rounded-none text-[#37322d] hover:bg-[#f2eee7] disabled:opacity-60">
        <PublishIcon />
      </button>
    </div>
  );

  if (mobile) {
    return (
      <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">{plan.slug}</p>
            <p className="mt-1 text-[13px] text-black">{plan.name}</p>
            <p className="mt-1 text-[10px] text-[#7a746b]">{plan.priceDisplay || plan.priceLabel}</p>
          </div>
          {actions}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[10px] text-[#37322d]">
          <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Billing</dt><dd className="mt-1">{plan.billingType}</dd></div>
          <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Status</dt><dd className="mt-1">{plan.visible ? "Visible" : "Hidden"} / {plan.active ? "Active" : "Inactive"}</dd></div>
        </dl>
        {editor}
      </article>
    );
  }

  return (
    <tr className="border-b border-[#e4ddd2] align-top text-[12px] text-[#37322d] last:border-b-0 hover:bg-[#f7f5f2]">
      <td className="px-4 py-3">
        <p className="text-[13px] text-black">{plan.name}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#7a746b]">{plan.slug}</p>
      </td>
      <td className="px-4 py-3">{plan.billingType}</td>
      <td className="px-4 py-3 text-black">{plan.priceDisplay || plan.priceLabel}</td>
      <td className="px-4 py-3">{plan.includedCreditUsd ?? "-"}</td>
      <td className="px-4 py-3">{plan.discountPercent ?? "-"}</td>
      <td className="px-4 py-3"><PlanStatusStack active={plan.active} visible={plan.visible} /></td>
      <td className="px-4 py-3">
        {actions}
        {editor}
      </td>
    </tr>
  );
}
