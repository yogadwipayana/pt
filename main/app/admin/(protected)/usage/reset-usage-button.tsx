"use client";

import { useState } from "react";

export function ResetUsageButton() {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

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
    return (
      <p className="text-[10px] uppercase tracking-[0.14em] text-green-700">
        Usage reset successfully. Reloading...
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {confirming ? (
        <>
          <p className="text-[10px] text-[#8a847a]">Are you sure? This cannot be undone.</p>
          <button
            type="button"
            onClick={handleCancel}
            className="min-h-[36px] border border-[#b8b1a5] px-3 text-[8px] uppercase tracking-[0.14em] text-[#37322d] hover:border-black"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={status === "loading"}
            className="min-h-[36px] bg-red-700 px-3 text-[8px] uppercase tracking-[0.14em] text-white hover:bg-red-800 disabled:opacity-50"
          >
            {status === "loading" ? "Resetting..." : "Confirm Reset"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleReset}
          className="min-h-[36px] border border-[#b8b1a5] px-3 text-[8px] uppercase tracking-[0.14em] text-[#37322d] hover:border-black hover:text-black"
        >
          Reset usage
        </button>
      )}
    </div>
  );
}
