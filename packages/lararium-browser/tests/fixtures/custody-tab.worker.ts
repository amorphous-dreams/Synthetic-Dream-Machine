/**
 * custody-tab.worker — a second JS realm on the same origin and the same IndexedDB, standing in for a second tab: its module
 * graph is its own, so it holds whatever unlock it makes itself and nothing the first realm holds.
 */
import { readBrowserCustody, unlockBrowserCustody, readKeystoreRow, type BrowserCustodyRefused } from "../../src/browser-custody.js";

const scope = globalThis as unknown as {
  addEventListener(type: "message", callback: (event: MessageEvent) => void): void;
  postMessage(message: unknown): void;
};

scope.addEventListener("message", (event) => {
  const msg = event.data as { op: string; idbName: string; passphrase?: string; row?: string };
  void (async () => {
    if (msg.op === "status") {
      const status = await readBrowserCustody(msg.idbName);
      scope.postMessage({ op: msg.op, reading: status.reading, unlocked: "unlocked" in status ? status.unlocked : null });
    } else if (msg.op === "read-row") {
      try { await readKeystoreRow(msg.idbName, msg.row!); scope.postMessage({ op: msg.op, refused: null }); }
      catch (e) { scope.postMessage({ op: msg.op, refused: (e as BrowserCustodyRefused).reading ?? String(e) }); }
    } else if (msg.op === "unlock") {
      const u = await unlockBrowserCustody(msg.idbName, [{ kind: "passphrase", passphrase: msg.passphrase! }]);
      scope.postMessage({ op: msg.op, reading: u.reading });
    }
  })().catch((e: unknown) => scope.postMessage({ op: msg.op, error: String(e) }));
});
