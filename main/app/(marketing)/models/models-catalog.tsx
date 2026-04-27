"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PublicModel } from "@/lib/web-api";

type ModelsCatalogProps = {
  items: PublicModel[];
};

type SortKey = "name" | "price-in" | "price-out" | "context";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  "price-in": "Input Price",
  "price-out": "Output Price",
  context: "Context",
};

function parsePrice(value: string): number {
  const match = value.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : Infinity;
}

function parseContext(value: string): number {
  const match = value.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

export function ModelsCatalog({ items }: ModelsCatalogProps) {
  const [query, setQuery] = useState("");
  const [copiedModelId, setCopiedModelId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("All");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const providers = useMemo(
    () => ["All", ...Array.from(new Set(items.map((model) => model.provider)))],
    [items]
  );

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = items.filter((model) => {
      const haystack = [
        model.name,
        model.provider,
        model.modelId,
        model.providerCode,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesProvider = selectedProvider === "All" || model.provider === selectedProvider;

      return matchesQuery && matchesProvider;
    });

    const sorted = [...filtered];
    if (sortBy === "price-in") {
      sorted.sort((a, b) => parsePrice(a.inputPrice) - parsePrice(b.inputPrice));
    } else if (sortBy === "price-out") {
      sorted.sort((a, b) => parsePrice(a.outputPrice) - parsePrice(b.outputPrice));
    } else if (sortBy === "context") {
      sorted.sort((a, b) => parseContext(b.contextWindow) - parseContext(a.contextWindow));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
  }, [items, query, selectedProvider, sortBy]);

  const activeFilterCount = Number(selectedProvider !== "All");

  return (
    <section id="catalog" className="pb-10">
      {/* Controls */}
      <div className="border-t border-[#bdb7ab] pt-4 sm:pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative flex items-center sm:w-[280px]">
            <span className="pointer-events-none absolute left-3 text-[12px] text-[#8a847a]">&gt;</span>
            <input
              aria-label="Search models"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Query..."
              className="h-[36px] w-full min-w-0 rounded-none border border-[#9f988c] bg-[#f7f5f2] pl-7 pr-3 text-[12px] uppercase tracking-[0.08em] text-black placeholder:text-[#9a948a]"
            />
          </label>

          <div className="flex items-center gap-3">
            {/* Custom sort dropdown */}
            <div ref={sortRef} className="relative">
              <button
                type="button"
                onClick={() => setSortOpen((prev) => !prev)}
                className="flex h-[36px] items-center gap-2 rounded-none border border-[#9f988c] bg-[#f7f5f2] px-3 text-[12px] uppercase tracking-[0.08em] text-black"
              >
                <span>Sort: {SORT_LABELS[sortBy]}</span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                  <path d="M1 1L5 5L9 1" stroke="#6d6962" strokeWidth="1.2" />
                </svg>
              </button>

              {sortOpen ? (
                <div className="absolute right-0 top-[calc(100%+4px)] z-10 w-[160px] border border-[#9f988c] bg-[#f7f5f2]">
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSortBy(key);
                        setSortOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-[12px] uppercase tracking-[0.08em] transition-colors ${
                        sortBy === key
                          ? "bg-black text-[#f7f3eb]"
                          : "text-black hover:bg-[#ece7df]"
                      }`}
                    >
                      <span>{SORT_LABELS[key]}</span>
                      {sortBy === key ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <span className="text-[12px] uppercase tracking-[0.08em] text-[#7b7469]">
              {filteredModels.length} result{filteredModels.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {providers.map((provider) => (
            <button
              key={provider}
              type="button"
              aria-pressed={selectedProvider === provider}
              onClick={() => setSelectedProvider(provider)}
              className="border border-[#c7c1b7] px-2 py-[5px] text-[11px] uppercase tracking-[0.08em] text-[#6d6962] transition-colors aria-pressed:border-black aria-pressed:bg-black aria-pressed:text-[#f7f3eb] hover:border-[#9f988c]"
            >
              {provider}
            </button>
          ))}

          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedProvider("All")}
              className="ml-1 text-[11px] uppercase tracking-[0.08em] text-black underline decoration-[#bdb7ab] underline-offset-2"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Table header */}
      <div className="mt-5 hidden border-b border-[#c7c1b7] pb-2 sm:grid sm:grid-cols-[1fr_100px_100px_110px] sm:items-center lg:grid-cols-[1fr_120px_120px_130px]">
        <span className="text-[11px] uppercase tracking-[0.08em] text-[#7b7469]">Model</span>
        <span className="text-right text-[11px] uppercase tracking-[0.08em] text-[#7b7469]">Input ($/M)</span>
        <span className="text-right text-[11px] uppercase tracking-[0.08em] text-[#7b7469]">Output ($/M)</span>
        <span className="text-right text-[11px] uppercase tracking-[0.08em] text-[#7b7469]">Context</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#e0dbd2]">
        {filteredModels.map((model) => {
          const isCopied = copiedModelId === model.modelId;

          return (
            <div
              key={model.slug}
              className="group py-3 sm:grid sm:grid-cols-[1fr_100px_100px_110px] sm:items-center sm:gap-3 sm:py-2.5 lg:grid-cols-[1fr_120px_120px_130px]"
            >
              {/* Name cell */}
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center border border-[#c7c1b7] bg-[#f5f1eb] text-[10px] font-semibold uppercase tracking-[0.04em] text-[#6d6962]">
                  {model.providerCode.charAt(0)}
                </span>
                <div className="min-w-0">
                  <span className="text-[14px] leading-[1.3] text-[#111111] underline decoration-[#bdb7ab] underline-offset-2 sm:text-[15px]">
                    {model.provider}: {model.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(model.modelId);
                    setCopiedModelId(model.modelId);
                    window.setTimeout(() => setCopiedModelId(null), 1400);
                  }}
                  className={`ml-auto inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center text-[#8a847a] transition-all hover:text-black sm:ml-1 ${isCopied ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  title={isCopied ? "Copied" : "Copy model ID"}
                >
                  {isCopied ? (
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <rect x="2.5" y="2.5" width="6" height="6" stroke="currentColor" strokeWidth="1" />
                      <rect x="4.5" y="0.5" width="6" height="6" stroke="currentColor" strokeWidth="1" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Mobile label + value stack, desktop aligned columns */}
              <div className="mt-2 flex items-center justify-between sm:mt-0 sm:justify-end">
                <span className="text-[11px] uppercase tracking-[0.08em] text-[#7b7469] sm:hidden">Input</span>
                <span className="text-[13px] text-[#111111] sm:text-[14px]">{model.inputPrice}</span>
              </div>

              <div className="mt-1.5 flex items-center justify-between sm:mt-0 sm:justify-end">
                <span className="text-[11px] uppercase tracking-[0.08em] text-[#7b7469] sm:hidden">Output</span>
                <span className="text-[13px] text-[#111111] sm:text-[14px]">{model.outputPrice}</span>
              </div>

              <div className="mt-1.5 flex items-center justify-between sm:mt-0 sm:justify-end">
                <span className="text-[11px] uppercase tracking-[0.08em] text-[#7b7469] sm:hidden">Context</span>
                <span className="text-[13px] text-[#111111] sm:text-[14px]">{model.contextWindow}</span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredModels.length === 0 ? (
        <div className="mt-8 border border-[#c7c1b7] bg-[#fbfaf7] px-5 py-6 text-center">
          <p className="text-[13px] uppercase tracking-[0.08em] text-[#68645c]">
            No models match your query.
          </p>
          <p className="mt-1.5 text-[12px] text-[#8a847a]">
            Try adjusting your search term or clearing active filters.
          </p>
          {activeFilterCount > 0 || query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedProvider("All");
              }}
              className="mt-4 border border-black bg-black px-3 py-[6px] text-[11px] uppercase tracking-[0.08em] text-white"
            >
              Reset search
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
