import type { Metadata } from "next";
import { headers } from "next/headers";

import { webApi } from "@/lib/web-api";

import { SettingsKeysPanel } from "./settings-keys-panel";

export const metadata: Metadata = {
  title: "API Keys - Dwipa Settings",
  description:
    "Review Dwipa API keys and manage access credentials inside your settings workspace.",
};

async function getKeys() {
  try {
    const requestHeaders = await headers();
    const cookie = requestHeaders.get("cookie");
    const response = await webApi.getKeys({
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });

    return response.keys;
  } catch {
    return [];
  }
}

export default async function SettingsKeysPage() {
  const keys = await getKeys();

  return <SettingsKeysPanel initialKeys={keys} />;
}
