/**
 * Node auth session seed.
 *
 * Slate-clean model: the node server no longer creates a did:key operator or
 * verifies UCANs. It will host provider-specific auth edges instead:
 *
 * - BlueSky OAuth routes when elyncia.app can serve OAuth metadata/callbacks.
 * - GitHub VS Code claim routes for the local editor-mediated workflow.
 *
 * For now local development receives a provider-neutral local-dev receipt.
 */

import { createLocalDevReceipt, type LarAuthReceipt } from "@lararium/core";

export async function getOrCreateNodeAuthReceipt(_dataDir: string): Promise<LarAuthReceipt> {
  return createLocalDevReceipt("node-local-operator");
}
