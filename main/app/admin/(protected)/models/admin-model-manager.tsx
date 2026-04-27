"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminModelSummary } from "@/lib/web-api";
import { WebApiError, webApi } from "@/lib/web-api";

type ModelFormState = {
  slug: string;
  name: string;
  provider: string;
  providerCode: string;
  modelId: string;
  contextWindow: string;
  inputPrice: string;
  outputPrice: string;
};

function buildInitialState(model?: AdminModelSummary | null): ModelFormState {
  return {
    slug: model?.slug || "",
    name: model?.name || "",
    provider: model?.provider || "",
    providerCode: model?.providerCode || "",
    modelId: model?.modelId || "",
    contextWindow: model?.contextWindow || "",
    inputPrice: model?.inputPrice || "",
    outputPrice: model?.outputPrice || "",
  };
}

export function AdminModelManager({
  model,
  mode,
}: {
  model?: AdminModelSummary | null;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [form, setForm] = useState<ModelFormState>(buildInitialState(model));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const updateField = (field: keyof ModelFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await webApi.createAdminModel(form);
          setForm(buildInitialState());
          setSuccessMessage("Model created.");
          setIsOpen(false);
        } else if (model) {
          await webApi.updateAdminModel(model.id, form);
          setSuccessMessage("Model updated.");
        }
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to save model.");
      }
    });
  };

  const toggleAccess = () => {
    if (!model) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    startTransition(async () => {
      try {
        if (model.accessState === "enabled") {
          await webApi.disableAdminModel(model.id);
          setSuccessMessage("Model disabled.");
        } else {
          await webApi.enableAdminModel(model.id);
          setSuccessMessage("Model enabled.");
        }
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to change model state.");
      }
    });
  };

  const formContent = (
    <div className="space-y-3 border border-[#b8b1a5] bg-[#fbfaf7] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">
            {mode === "create" ? "Add model" : "Edit model"}
          </p>
          <p className="mt-1 text-[12px] text-[#7a746b]">
            {mode === "create" ? "Create a new runtime-visible model." : model?.modelId}
          </p>
        </div>
        {mode === "create" ? (
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="min-h-[40px] border border-[#b8b1a5] px-3 text-[10px] uppercase tracking-[0.14em] text-[#37322d]"
          >
            Close
          </button>
        ) : model ? (
          <button
            type="button"
            disabled={isPending}
            onClick={toggleAccess}
            className="min-h-[40px] border border-[#b8b1a5] px-3 text-[10px] uppercase tracking-[0.14em] text-[#37322d] disabled:opacity-60"
          >
            {model.accessState === "enabled" ? "Disable" : "Enable"}
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Display name" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.slug} onChange={(event) => updateField("slug", event.target.value)} placeholder="Slug" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.provider} onChange={(event) => updateField("provider", event.target.value)} placeholder="Provider" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.providerCode} onChange={(event) => updateField("providerCode", event.target.value)} placeholder="Provider code" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.modelId} onChange={(event) => updateField("modelId", event.target.value)} placeholder="Runtime model id" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px] sm:col-span-2" />
        <input value={form.contextWindow} onChange={(event) => updateField("contextWindow", event.target.value)} placeholder="Context window" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.inputPrice} onChange={(event) => updateField("inputPrice", event.target.value)} placeholder="Input price" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
        <input value={form.outputPrice} onChange={(event) => updateField("outputPrice", event.target.value)} placeholder="Output price" className="min-h-[44px] rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[13px]" />
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={submit}
        className="min-h-[44px] w-full rounded-none bg-black px-4 text-[10px] uppercase tracking-[0.14em] text-white disabled:opacity-60 sm:w-auto"
      >
        {mode === "create" ? "Create model" : "Save model"}
      </button>

      {errorMessage ? <p className="text-[12px] text-[#7d2f2f]">{errorMessage}</p> : null}
      {successMessage ? <p className="text-[12px] text-[#345140]">{successMessage}</p> : null}
    </div>
  );

  if (mode === "create") {
    return (
      <>
        <div className="flex items-center justify-between border border-[#b8b1a5] bg-[#fbfaf7] p-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#5f5a53]">Add model</p>
            <p className="mt-1 text-[12px] text-[#7a746b]">Create a new runtime-visible model.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setSuccessMessage(null);
              setForm(buildInitialState());
              setIsOpen(true);
            }}
            className="min-h-[44px] rounded-none bg-black px-4 text-[10px] uppercase tracking-[0.14em] text-white"
          >
            Add model
          </button>
        </div>

        {isOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Add model"
              className="max-h-[90vh] w-full max-w-[920px] overflow-y-auto"
            >
              {formContent}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return formContent;
}
