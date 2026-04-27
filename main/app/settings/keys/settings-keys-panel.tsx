"use client";

import type { FormEvent } from "react";
import { useEffect, useId, useState } from "react";

import { apiKeysSection, type ApiKeyCard } from "@/content/account";
import { type ApiKeySummary, type ApiKeyUsageMode, webApi, WebApiError } from "@/lib/web-api";

type KeyRecord = ApiKeyCard & {
  usageMode: ApiKeyUsageMode;
  copyValue?: string;
};

type CreatedKey = {
  label: string;
  value: string;
  usageMode: ApiKeyUsageMode;
};

type SettingsKeysPanelProps = {
  initialKeys: ApiKeySummary[];
};

function CopyIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="5" y="3" width="8" height="10" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M3 11V1.75h7.25" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2.5 4.5h11" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M6 2.5h4" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M4.5 4.5V13.5h7V4.5" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M6.5 6.5v5" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M9.5 6.5v5" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 13h2.75L13 5.75 10.25 3 3 10.25V13Z" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M8.75 4.5 11.5 7.25" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "Added recently";
  }

  return `Added ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))}`;
}

const DEFAULT_USAGE_MODE: ApiKeyUsageMode = "both";

function normalizeUsageMode(value: ApiKeySummary["usageMode"] | ApiKeyCard["usageMode"]): ApiKeyUsageMode {
  if (value === "subscription" || value === "payg" || value === "both") {
    return value;
  }

  return DEFAULT_USAGE_MODE;
}

function getUsageModeOption(value: ApiKeyUsageMode) {
  return (
    apiKeysSection.usageModeOptions.find((option) => option.value === value) ??
    apiKeysSection.usageModeOptions[0]
  );
}

function toKeyRecord(key: ApiKeySummary): KeyRecord {
  return {
    id: key.id,
    label: key.label,
    maskedKey: key.maskedKey,
    usageMode: normalizeUsageMode(key.usageMode),
    addedLabel: formatDateLabel(key.createdAt),
  };
}

const INPUT_MAX_LENGTH = 48;

async function copyTextToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

export function SettingsKeysPanel({ initialKeys }: SettingsKeysPanelProps) {
  const inputId = useId();
  const [keys, setKeys] = useState<KeyRecord[]>(initialKeys.map(toKeyRecord));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftUsageMode, setDraftUsageMode] = useState<ApiKeyUsageMode>(DEFAULT_USAGE_MODE);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [hasCopiedCreatedKey, setHasCopiedCreatedKey] = useState(false);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<KeyRecord | null>(null);
  const [editingKey, setEditingKey] = useState<KeyRecord | null>(null);
  const [editingUsageMode, setEditingUsageMode] = useState<ApiKeyUsageMode>(DEFAULT_USAGE_MODE);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const isAnyModalOpen = isModalOpen || pendingDeleteKey !== null || editingKey !== null;

  useEffect(() => {
    if (!isAnyModalOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
        setDraftName("");
        setDraftUsageMode(DEFAULT_USAGE_MODE);
        setCreatedKey(null);
        setHasCopiedCreatedKey(false);
        setErrorMessage(null);
        setPendingDeleteKey(null);
        setEditingKey(null);
        setEditingUsageMode(DEFAULT_USAGE_MODE);
        setIsSavingEdit(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAnyModalOpen]);

  useEffect(() => {
    if (!copiedKeyId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedKeyId(null);
    }, 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedKeyId]);

  const resetModal = () => {
    setIsModalOpen(false);
    setDraftName("");
    setCreatedKey(null);
    setHasCopiedCreatedKey(false);
    setErrorMessage(null);
    setPendingDeleteKey(null);
    setEditingKey(null);
    setEditingUsageMode(DEFAULT_USAGE_MODE);
    setIsSavingEdit(false);
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setDraftName("");
    setCreatedKey(null);
    setHasCopiedCreatedKey(false);
    setErrorMessage(null);
    setPendingDeleteKey(null);
    setEditingKey(null);
    setEditingUsageMode(DEFAULT_USAGE_MODE);
    setIsSavingEdit(false);
  };

  const handleCreateKey = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = draftName.trim();

    if (!nextName) {
      setErrorMessage(apiKeysSection.createErrorEmpty);
      return;
    }

    const hasDuplicateName = keys.some(
      (key) => key.label.toLowerCase() === nextName.toLowerCase(),
    );

    if (hasDuplicateName) {
      setErrorMessage(apiKeysSection.createErrorDuplicate);
      return;
    }

    setErrorMessage(null);
    setIsCreating(true);

    void webApi
      .createKey({ label: nextName, usageMode: draftUsageMode })
      .then((response) => {
        const nextRecord: KeyRecord = {
          ...toKeyRecord(response.key),
          usageMode: normalizeUsageMode(response.key.usageMode),
          addedLabel: apiKeysSection.justAddedLabel,
          copyValue: response.secret,
        };

        setKeys((currentKeys) => [nextRecord, ...currentKeys]);
        setCreatedKey({
          label: nextName,
          value: response.secret,
          usageMode: normalizeUsageMode(response.key.usageMode),
        });
        setDraftName("");
        setDraftUsageMode(DEFAULT_USAGE_MODE);
      })
      .catch((error) => {
        setErrorMessage(error instanceof WebApiError ? error.message : "Unable to create this key.");
      })
      .finally(() => {
        setIsCreating(false);
      });
  };

  const handleCopyKey = async (key: KeyRecord) => {
    if (!key.copyValue) {
      return;
    }

    if (await copyTextToClipboard(key.copyValue)) {
      setCopiedKeyId(key.id);
    } else {
      setCopiedKeyId(null);
    }
  };

  const handleCopyCreatedKey = async () => {
    if (!createdKey) {
      return;
    }

    setHasCopiedCreatedKey(await copyTextToClipboard(createdKey.value));
  };

  const handleDeleteKey = (keyId: string) => {
    void webApi
      .deleteKey(keyId)
      .then(() => {
        setKeys((currentKeys) => currentKeys.filter((key) => key.id !== keyId));
        setCopiedKeyId((currentKeyId) => (currentKeyId === keyId ? null : currentKeyId));
        setPendingDeleteKey(null);
      })
      .catch(() => {
        setErrorMessage("Unable to delete this key.");
      });
  };

  const handleOpenEditModal = (key: KeyRecord) => {
    setEditingKey(key);
    setEditingUsageMode(key.usageMode);
    setErrorMessage(null);
    setPendingDeleteKey(null);
  };

  const handleUpdateKey = () => {
    if (!editingKey || editingUsageMode === editingKey.usageMode) {
      setEditingKey(null);
      setEditingUsageMode(DEFAULT_USAGE_MODE);
      return;
    }

    setIsSavingEdit(true);
    setErrorMessage(null);

    void webApi
      .updateKey(editingKey.id, { usageMode: editingUsageMode })
      .then((response) => {
        const nextUsageMode = normalizeUsageMode(response.key.usageMode);
        setKeys((currentKeys) =>
          currentKeys.map((key) =>
            key.id === editingKey.id
              ? {
                  ...key,
                  usageMode: nextUsageMode,
                }
              : key,
          ),
        );
        setEditingKey(null);
        setEditingUsageMode(DEFAULT_USAGE_MODE);
      })
      .catch((error) => {
        setErrorMessage(error instanceof WebApiError ? error.message : apiKeysSection.updateError);
      })
      .finally(() => {
        setIsSavingEdit(false);
      });
  };

  const showCreatedState = createdKey !== null;

  return (
    <section>
      <div>
        <h2 className="text-[24px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]">
          {apiKeysSection.title}
        </h2>
        <p className="mt-2 max-w-[360px] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
          {apiKeysSection.description}
        </p>
      </div>

      <div className="mt-6 space-y-3 sm:mt-7 sm:space-y-4">
        {keys.map((key) => {
          const canCopy = Boolean(key.copyValue);
          const isCopied = copiedKeyId === key.id;

          return (
            <article
              key={key.id}
              className="border border-[#b8b1a5] bg-[#fbfaf7] px-4 py-2.5 sm:px-5 sm:py-3"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4">
                <div className="min-w-0">
                  <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
                    {key.label}
                  </p>
                  <p className="mt-1 truncate font-mono text-[10px] text-black sm:text-[11px]">
                    {key.maskedKey}
                  </p>
                  <p className="mt-1 text-[10px] text-[#8a847a] sm:text-[11px]">{key.addedLabel}</p>
                  <p className="mt-1 text-[10px] text-[#8a847a] sm:text-[11px]">
                    {apiKeysSection.usageModeCardLabel}: {getUsageModeOption(key.usageMode).label}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(key)}
                    aria-label={`Edit ${key.label} key plan access`}
                    title={apiKeysSection.editLabel}
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-[#6f695f]"
                  >
                    <EditIcon />
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCopyKey(key)}
                    disabled={!canCopy}
                    aria-label={
                      isCopied
                        ? `${apiKeysSection.copiedLabel} ${key.label} key`
                        : `Copy ${key.label} key`
                    }
                    title={isCopied ? apiKeysSection.copiedLabel : apiKeysSection.copyLabel}
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-[#6f695f] disabled:text-[#b2ab9f]"
                  >
                    <CopyIcon copied={isCopied} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPendingDeleteKey(key)}
                    aria-label={`Delete ${key.label} key`}
                    title={apiKeysSection.deleteLabel}
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-[#6f695f]"
                  >
                    <DeleteIcon />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleOpenModal}
        className="mt-6 flex min-h-[44px] w-fit items-center justify-center bg-black px-5 text-[8px] uppercase tracking-[0.16em] text-white sm:mt-7 sm:text-[9px]"
      >
        {apiKeysSection.addLabel}
      </button>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#111111]/65 px-4 pb-4 pt-16 sm:items-center sm:p-6"
          onClick={resetModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-key-modal-title"
            className="w-full max-w-[520px] border border-[#b8b1a5] bg-[#fbfaf7] p-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            {showCreatedState ? (
              <div>
                <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
                  {createdKey.label}
                </p>
                <h3
                  id="api-key-modal-title"
                  className="mt-3 text-[26px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]"
                >
                  {apiKeysSection.revealTitle}
                </h3>
                <p className="mt-2 max-w-[44ch] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
                  {apiKeysSection.revealDescription}
                </p>
                <p className="mt-3 text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
                  {apiKeysSection.usageModeCardLabel}: {getUsageModeOption(createdKey.usageMode).label}
                </p>

                <div className="mt-5 border border-[#b8b1a5] bg-[#f7f3eb] px-4 py-4">
                  <p className="break-all font-mono text-[11px] leading-[1.6] text-black sm:text-[12px]">
                    {createdKey.value}
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => void handleCopyCreatedKey()}
                    className="flex min-h-[44px] items-center justify-center border border-black px-5 text-[8px] uppercase tracking-[0.16em] text-black sm:text-[9px]"
                  >
                    {hasCopiedCreatedKey ? apiKeysSection.copiedLabel : apiKeysSection.copyLabel}
                  </button>
                  <button
                    type="button"
                    onClick={resetModal}
                    className="flex min-h-[44px] items-center justify-center bg-black px-5 text-[8px] uppercase tracking-[0.16em] text-white sm:text-[9px]"
                  >
                    {apiKeysSection.doneLabel}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateKey}>
                <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
                  {apiKeysSection.modalEyebrow}
                </p>
                <h3
                  id="api-key-modal-title"
                  className="mt-3 text-[26px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]"
                >
                  {apiKeysSection.modalTitle}
                </h3>
                <p className="mt-2 max-w-[44ch] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
                  {apiKeysSection.modalDescription}
                </p>

                <div className="mt-5">
                  <label
                    htmlFor={inputId}
                    className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]"
                  >
                    {apiKeysSection.nameLabel}
                  </label>
                  <input
                    id={inputId}
                    name="keyName"
                    type="text"
                    value={draftName}
                    autoFocus
                    maxLength={INPUT_MAX_LENGTH}
                    onChange={(event) => {
                      setDraftName(event.target.value);
                      if (errorMessage) {
                        setErrorMessage(null);
                      }
                    }}
                    placeholder={apiKeysSection.namePlaceholder}
                    aria-invalid={errorMessage ? "true" : "false"}
                    aria-describedby={errorMessage ? `${inputId}-error` : undefined}
                    className="mt-3 w-full border border-[#b8b1a5] bg-[#f7f3eb] px-4 py-3 text-[13px] text-black placeholder:text-[#9f998f]"
                  />
                  {errorMessage ? (
                    <p
                      id={`${inputId}-error`}
                      className="mt-2 text-[10px] leading-[1.55] text-[#7a4335] sm:text-[11px]"
                    >
                      {errorMessage}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5">
                  <label
                    htmlFor={`${inputId}-usage-mode`}
                    className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]"
                  >
                    {apiKeysSection.usageModeLabel}
                  </label>
                  <p className="mt-1 text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
                    {apiKeysSection.usageModeDescription}
                  </p>
                  <select
                    id={`${inputId}-usage-mode`}
                    name="usageMode"
                    value={draftUsageMode}
                    onChange={(event) => setDraftUsageMode(event.target.value as ApiKeyUsageMode)}
                    className="mt-3 min-h-[44px] w-full border border-[#b8b1a5] bg-[#f7f3eb] px-4 py-3 text-[13px] text-black"
                  >
                    {apiKeysSection.usageModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} — {option.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={resetModal}
                    className="flex min-h-[44px] items-center justify-center border border-[#b8b1a5] px-5 text-[8px] uppercase tracking-[0.16em] text-[#5f5a53] sm:text-[9px]"
                  >
                    {apiKeysSection.cancelLabel}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex min-h-[44px] items-center justify-center bg-black px-5 text-[8px] uppercase tracking-[0.16em] text-white disabled:opacity-60 sm:text-[9px]"
                  >
                    {isCreating ? `${apiKeysSection.createLabel}...` : apiKeysSection.createLabel}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {editingKey ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#111111]/65 px-4 pb-4 pt-16 sm:items-center sm:p-6"
          onClick={resetModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-api-key-modal-title"
            className="w-full max-w-[520px] border border-[#b8b1a5] bg-[#fbfaf7] p-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
              {apiKeysSection.editModalEyebrow}
            </p>
            <h3
              id="edit-api-key-modal-title"
              className="mt-3 text-[26px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]"
            >
              {apiKeysSection.editModalTitle}
            </h3>
            <p className="mt-2 max-w-[44ch] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
              {apiKeysSection.editModalDescription}
            </p>

            <div className="mt-5 border border-[#b8b1a5] bg-[#f7f3eb] px-4 py-4">
              <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
                {editingKey.label}
              </p>
              <p className="mt-3 font-mono text-[11px] leading-[1.6] text-black sm:text-[12px]">
                {editingKey.maskedKey}
              </p>
            </div>

            <div className="mt-5">
              <label
                htmlFor={`${inputId}-edit-usage-mode`}
                className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]"
              >
                {apiKeysSection.usageModeLabel}
              </label>
              <p className="mt-1 text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
                {apiKeysSection.usageModeDescription}
              </p>
              <select
                id={`${inputId}-edit-usage-mode`}
                name="editUsageMode"
                value={editingUsageMode}
                onChange={(event) => {
                  setEditingUsageMode(event.target.value as ApiKeyUsageMode);
                  if (errorMessage) {
                    setErrorMessage(null);
                  }
                }}
                className="mt-3 min-h-[44px] w-full border border-[#b8b1a5] bg-[#f7f3eb] px-4 py-3 text-[13px] text-black"
              >
                {apiKeysSection.usageModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
              {errorMessage ? (
                <p className="mt-2 text-[10px] leading-[1.55] text-[#7a4335] sm:text-[11px]">
                  {errorMessage}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetModal}
                className="flex min-h-[44px] items-center justify-center border border-[#b8b1a5] px-5 text-[8px] uppercase tracking-[0.16em] text-[#5f5a53] sm:text-[9px]"
              >
                {apiKeysSection.cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleUpdateKey}
                disabled={isSavingEdit}
                className="flex min-h-[44px] items-center justify-center bg-black px-5 text-[8px] uppercase tracking-[0.16em] text-white disabled:bg-[#6f695f] sm:text-[9px]"
              >
                {isSavingEdit ? `${apiKeysSection.saveLabel}...` : apiKeysSection.saveLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteKey ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#111111]/65 px-4 pb-4 pt-16 sm:items-center sm:p-6"
          onClick={resetModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-api-key-modal-title"
            className="w-full max-w-[520px] border border-[#b8b1a5] bg-[#fbfaf7] p-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
              {apiKeysSection.deleteModalEyebrow}
            </p>
            <h3
              id="delete-api-key-modal-title"
              className="mt-3 text-[26px] leading-[0.98] tracking-[-0.04em] sm:text-[30px]"
            >
              {apiKeysSection.deleteModalTitle}
            </h3>
            <p className="mt-2 max-w-[44ch] text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">
              {apiKeysSection.deleteModalDescription}
            </p>

            <div className="mt-5 border border-[#b8b1a5] bg-[#f7f3eb] px-4 py-4">
              <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">
                {pendingDeleteKey.label}
              </p>
              <p className="mt-3 font-mono text-[11px] leading-[1.6] text-black sm:text-[12px]">
                {pendingDeleteKey.maskedKey}
              </p>
              <p className="mt-4 text-[10px] leading-[1.55] text-[#7a4335] sm:text-[11px]">
                {apiKeysSection.deleteModalWarning}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetModal}
                className="flex min-h-[44px] items-center justify-center border border-[#b8b1a5] px-5 text-[8px] uppercase tracking-[0.16em] text-[#5f5a53] sm:text-[9px]"
              >
                {apiKeysSection.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteKey(pendingDeleteKey.id)}
                className="flex min-h-[44px] items-center justify-center bg-black px-5 text-[8px] uppercase tracking-[0.16em] text-white sm:text-[9px]"
              >
                {apiKeysSection.confirmDeleteLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
