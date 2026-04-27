import { cleanupProviderConnections } from "@/lib/localDb";

/**
 * Initialize app on startup
 * - Cleanup stale data
 */
export async function initializeApp() {
  try {
    await cleanupProviderConnections();
  } catch (error) {
    console.error("[InitApp] Error:", error);
  }
}

export default initializeApp;
