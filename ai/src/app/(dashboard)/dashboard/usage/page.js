"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { UsageStats, RequestLogger, CardSkeleton, SegmentedControl } from "@/shared/components";
import RequestDetailsTab from "./components/RequestDetailsTab";

function ResetUsageButton() {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState("idle");

  const handleReset = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/web/v1/admin/usage/reset", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("success");
        window.location.reload();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
    setConfirming(false);
  };

  const handleCancel = () => {
    setConfirming(false);
    setStatus("idle");
  };

  if (status === "success") {
    return <span className="text-xs text-green-600">Usage reset. Reloading...</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {confirming && (
        <span className="text-xs text-text-muted">Are you sure? This cannot be undone.</span>
      )}
      {confirming && (
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-bg-hover"
        >
          Cancel
        </button>
      )}
      <button
        onClick={handleReset}
        disabled={status === "loading"}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          confirming
            ? "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            : "border border-border hover:bg-bg-hover"
        }`}
      >
        {status === "loading" ? "Resetting..." : confirming ? "Confirm Reset" : "Reset usage"}
      </button>
    </div>
  );
}

export default function UsagePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <UsageContent />
    </Suspense>
  );
}

function UsageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tabLoading, setTabLoading] = useState(false);

  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl && ["overview", "logs", "details"].includes(tabFromUrl)
    ? tabFromUrl
    : "overview";

  const handleTabChange = (value) => {
    if (value === activeTab) return;
    setTabLoading(true);
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`/dashboard/usage?${params.toString()}`, { scroll: false });
    // Brief loading flash so user sees feedback
    setTimeout(() => setTabLoading(false), 300);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SegmentedControl
          options={[
            { value: "overview", label: "Overview" },
            { value: "details", label: "Details" },
          ]}
          value={activeTab}
          onChange={handleTabChange}
        />
        <ResetUsageButton />
      </div>

      {tabLoading ? (
        <CardSkeleton />
      ) : (
        <>
          {activeTab === "overview" && (
            <Suspense fallback={<CardSkeleton />}>
              <UsageStats />
            </Suspense>
          )}
          {activeTab === "logs" && <RequestLogger />}
          {activeTab === "details" && <RequestDetailsTab />}
        </>
      )}
    </div>
  );
}

