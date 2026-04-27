"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatAdminDate } from "@/content/admin";
import type { AdminModelSummary } from "@/lib/web-api";
import { WebApiError, webApi } from "@/lib/web-api";

import { StatusPill } from "../components/status-pill";

type ModelFormState = {
  slug: string;
  name: string;
  provider: string;
  providerCode: string;
  modelId: string;
  contextWindow: string;
  inputPrice: string;
  outputPrice: string;
  visibility: string;
  accessState: string;
};

function buildInitialState(model: AdminModelSummary): ModelFormState {
  return {
    slug: model.slug,
    name: model.name,
    provider: model.provider,
    providerCode: model.providerCode,
    modelId: model.modelId,
    contextWindow: model.contextWindow || "",
    inputPrice: model.inputPrice || "",
    outputPrice: model.outputPrice || "",
    visibility: model.visibility || "visible",
    accessState: model.accessState || "enabled",
  };
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9.8 3.2 12.8 6.2" />
      <path d="M3.2 10.8 10.7 3.3a2.1 2.1 0 0 1 3 3l-7.5 7.5-3.4.4.4-3.4Z" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.8v6" />
      <path d="M5.1 3.6a5.2 5.2 0 1 0 5.8 0" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.5 4h11" />
      <path d="M5.5 4v9a1.5 1.5 0 0 0 1.5 1.5h2a1.5 1.5 0 0 0 1.5-1.5V4" />
      <path d="M6 2.5h4" />
    </svg>
  );
}

function ModelStatusStack({ accessState, visibility }: { accessState: string; visibility: string }) {
  const isEnabled = accessState === "enabled";
  const isVisible = visibility === "visible";

  return (
    <div className="inline-grid min-w-[132px] grid-cols-[8px_1fr] items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-[#4f4a43]">
      <span className={isEnabled ? "h-2 w-2 bg-black" : "h-2 w-2 border border-[#8a847a]"} aria-hidden="true" />
      <span>{isEnabled ? "Enabled" : "Disabled"}</span>
      <span className={isVisible ? "h-2 w-2 bg-[#8a847a]" : "h-2 w-2 border border-[#c9c1b5]"} aria-hidden="true" />
      <span className="text-[#7a746b]">{isVisible ? "Visible" : "Hidden"}</span>
    </div>
  );
}

function EditorFields({
  form,
  onChange,
}: {
  form: ModelFormState;
  onChange: (field: keyof ModelFormState, value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <input value={form.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Display name" className="min-h-[40px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.slug} onChange={(event) => onChange("slug", event.target.value)} placeholder="Slug" className="min-h-[40px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.provider} onChange={(event) => onChange("provider", event.target.value)} placeholder="Provider" className="min-h-[40px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.providerCode} onChange={(event) => onChange("providerCode", event.target.value)} placeholder="Provider code" className="min-h-[40px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.modelId} onChange={(event) => onChange("modelId", event.target.value)} placeholder="Runtime model id" className="min-h-[40px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px] md:col-span-2" />
        <input value={form.contextWindow} onChange={(event) => onChange("contextWindow", event.target.value)} placeholder="Context window" className="min-h-[40px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.inputPrice} onChange={(event) => onChange("inputPrice", event.target.value)} placeholder="Input price" className="min-h-[40px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.outputPrice} onChange={(event) => onChange("outputPrice", event.target.value)} placeholder="Output price" className="min-h-[40px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <select value={form.visibility} onChange={(event) => onChange("visibility", event.target.value)} className="min-h-[40px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]">
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
        <select value={form.accessState} onChange={(event) => onChange("accessState", event.target.value)} className="min-h-[40px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]">
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>
    </>
  );
}

export function AdminModelListItem({
  model,
  mobile = false,
}: {
  model: AdminModelSummary;
  mobile?: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ModelFormState>(buildInitialState(model));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const updateField = (field: keyof ModelFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        await webApi.updateAdminModel(model.id, form);
        setSuccessMessage("Model updated.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to save model.");
      }
    });
  };

  const toggleAccess = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        if (model.accessState === "enabled") await webApi.disableAdminModel(model.id);
        else await webApi.enableAdminModel(model.id);
        setSuccessMessage(model.accessState === "enabled" ? "Model disabled." : "Model enabled.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to change model state.");
      }
    });
  };

  const remove = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        await webApi.deleteAdminModel(model.id);
        setSuccessMessage("Model deleted.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to delete model.");
        setConfirmDelete(false);
      }
    });
  };

  if (mobile) {
    return (
      <article className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] text-black">{model.name}</p>
              <p className="mt-1 text-[10px] text-[#7a746b]">{model.modelId}</p>
            </div>
            <div className="flex flex-col gap-2">
              <StatusPill status={model.accessState} />
              <StatusPill status={model.visibility} />
            </div>
          </div>

          <dl className="grid gap-3 text-[10px] text-[#37322d] sm:grid-cols-2">
            <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Provider</dt><dd className="mt-1">{model.provider}</dd></div>
            <div><dt className="uppercase tracking-[0.12em] text-[#8a847a]">Updated</dt><dd className="mt-1">{formatAdminDate(model.updatedAt)}</dd></div>
          </dl>

          <div className="flex gap-2">
            <button type="button" aria-label={isOpen ? `Close editor for ${model.name}` : `Edit ${model.name}`} aria-expanded={isOpen} title={isOpen ? "Close editor" : "Edit"} onClick={() => setIsOpen((value) => !value)} className="inline-flex h-10 w-10 items-center justify-center rounded-none text-black hover:bg-black hover:text-white">
              <EditIcon />
            </button>
            <button type="button" aria-label={model.accessState === "enabled" ? `Disable ${model.name}` : `Enable ${model.name}`} title={model.accessState === "enabled" ? "Disable" : "Enable"} disabled={isPending} onClick={toggleAccess} className="inline-flex h-10 w-10 items-center justify-center rounded-none text-[#37322d] hover:bg-[#f2eee7] disabled:opacity-60">
              <PowerIcon />
            </button>
            <button type="button" aria-label={confirmDelete ? `Confirm delete ${model.name}` : `Delete ${model.name}`} title={confirmDelete ? "Confirm delete" : "Delete"} disabled={isPending} onClick={() => confirmDelete ? remove() : setConfirmDelete(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-none text-[#7d2f2f] hover:bg-[#7d2f2f] hover:text-white disabled:opacity-60">
              <TrashIcon />
            </button>
          </div>

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-[#7d2f2f]">Click again to confirm deletion.</p>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-[11px] text-[#5f5a53] underline">
                Cancel
              </button>
            </div>
          ) : null}

          {isOpen ? (
            <div className="space-y-3 border-t border-[#d8d0c3] pt-4">
              <EditorFields form={form} onChange={updateField} />
              <button type="button" disabled={isPending} onClick={submit} className="min-h-[40px] rounded-none bg-black px-4 text-[10px] uppercase tracking-[0.14em] text-white disabled:opacity-60">
                Save model
              </button>
              {errorMessage ? <p className="text-[12px] text-[#7d2f2f]">{errorMessage}</p> : null}
              {successMessage ? <p className="text-[12px] text-[#345140]">{successMessage}</p> : null}
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <>
      <tr className="border-b border-[#e4ddd2] align-top text-[12px] text-[#37322d] last:border-b-0 hover:bg-[#f7f5f2]">
        <td className="px-4 py-3">
          <p className="text-[13px] text-black">{model.name}</p>
          <p className="mt-1 text-[11px] text-[#7a746b]">{model.modelId}</p>
        </td>
        <td className="px-4 py-3">
          <p>{model.provider}</p>
          <p className="mt-1 text-[11px] text-[#7a746b]">{model.providerCode}</p>
        </td>
        <td className="px-4 py-3">
          <ModelStatusStack accessState={model.accessState} visibility={model.visibility} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">{formatAdminDate(model.updatedAt)}</td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button type="button" aria-label={isOpen ? `Close editor for ${model.name}` : `Edit ${model.name}`} aria-expanded={isOpen} title={isOpen ? "Close editor" : "Edit"} onClick={() => setIsOpen((value) => !value)} className="inline-flex h-10 w-10 items-center justify-center rounded-none text-black hover:bg-black hover:text-white">
              <EditIcon />
            </button>
            <button type="button" aria-label={model.accessState === "enabled" ? `Disable ${model.name}` : `Enable ${model.name}`} title={model.accessState === "enabled" ? "Disable" : "Enable"} disabled={isPending} onClick={toggleAccess} className="inline-flex h-10 w-10 items-center justify-center rounded-none text-[#37322d] hover:bg-[#f2eee7] disabled:opacity-60">
              <PowerIcon />
            </button>
            <button type="button" aria-label={confirmDelete ? `Confirm delete ${model.name}` : `Delete ${model.name}`} title={confirmDelete ? "Confirm delete" : "Delete"} disabled={isPending} onClick={() => confirmDelete ? remove() : setConfirmDelete(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-none text-[#7d2f2f] hover:bg-[#7d2f2f] hover:text-white disabled:opacity-60">
              <TrashIcon />
            </button>
          </div>
          {confirmDelete ? (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-[11px] text-[#7d2f2f]">Click again to confirm.</p>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-[11px] text-[#5f5a53] underline">
                Cancel
              </button>
            </div>
          ) : null}
        </td>
      </tr>

      {isOpen ? (
        <tr className="border-b border-[#b8b1a5] bg-[#f7f5f2] text-[12px] text-[#37322d] last:border-b-0">
          <td colSpan={5} className="px-4 py-4">
            <div className="space-y-3">
              <EditorFields form={form} onChange={updateField} />
              <div className="flex items-center gap-3">
                <button type="button" disabled={isPending} onClick={submit} className="min-h-[40px] rounded-none bg-black px-4 text-[10px] uppercase tracking-[0.14em] text-white disabled:opacity-60">
                  Save model
                </button>
                {errorMessage ? <p className="text-[12px] text-[#7d2f2f]">{errorMessage}</p> : null}
                {successMessage ? <p className="text-[12px] text-[#345140]">{successMessage}</p> : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
