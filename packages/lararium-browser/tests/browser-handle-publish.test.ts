/**
 * browser-handle-publish.test.ts — a browser/phone vessel publishes a Handle with no node CLI in reach.
 *
 * The isomorphic act (`publishHandleFromDaemonDoc`, @lararium/mesh) is proven platform-blind; THIS pins the
 * browser adapter that supplies its shores from the origin's own IndexedDB vault + store, and inherits the
 * fail-closed fence: a face anchors to its persona (the daemon doc's persona-KEL prefix owns it), and a
 * daemon doc with no prefix REFUSES — a browser face never self-owns, exactly as the node CLI refuses.
 */
import { describe, test, expect, afterEach } from "vitest";
import {
  PERSONA_KEL_PREFIX_TIDDLER, currentOwnerSet,
  type LarDoc, type HandleKelEvent,
} from "@lararium/mesh";
import { generateOrLoadBrowserPersonaRoot } from "../src/browser-vessel-identity.js";
import { publishHandleBrowser } from "../src/browser-handle-publish.js";

let created = 0;
const opened = new Set<string>();
function idb(): string { const n = `lares:test-hpub:${Date.now()}:${created++}`; opened.add(n); return n; }
function deleteIdb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
afterEach(async () => { for (const n of opened) await deleteIdb(n); opened.clear(); });

function makeFakeBoard(): { doc(): LarDoc; change(fn: (d: LarDoc) => void): void } {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  return { doc: () => d, change: (fn) => fn(d) };
}
const OWNER = "persona-" + "ab".repeat(32);

function daemonDoc(prefix?: string): LarDoc {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  if (prefix) {
    (d.tiddlers as Record<string, unknown>)[PERSONA_KEL_PREFIX_TIDDLER] =
      { tiddler: { title: PERSONA_KEL_PREFIX_TIDDLER, text: prefix, kind: "persona-kel-prefix" } };
  }
  return d;
}

describe("the browser publish surface — a phone vessel names itself", () => {
  test("★ publishes a persona-anchored Handle — the owner is the daemon doc's persona-KEL prefix ★", async () => {
    const name = idb();
    await generateOrLoadBrowserPersonaRoot(name, 0);   // seed the origin's persona vault
    const card = await publishHandleBrowser({
      daemonDoc: daemonDoc(OWNER), board: makeFakeBoard() as never,
      handleIndex: 0, glamour: "Guru-Josh", idbName: name, now: 100,
    });
    const owners = currentOwnerSet(card.chain as HandleKelEvent[])!;
    expect(owners.members, "the persona owns the published face").toEqual([OWNER]);
    expect(owners.members[0], "the handle key never owns itself").not.toBe(card.chain[0]!.handleKeyDid);
  });

  test("★ FAIL-CLOSED — no persona-KEL prefix on the daemon doc refuses; a browser face never self-owns ★", async () => {
    const name = idb();
    await generateOrLoadBrowserPersonaRoot(name, 0);
    await expect(publishHandleBrowser({
      daemonDoc: daemonDoc(undefined), board: makeFakeBoard() as never,
      handleIndex: 0, glamour: "Guru-Josh", idbName: name, now: 100,
    })).rejects.toThrow(/persona-KEL prefix|belongs to its persona/i);
  });
});
