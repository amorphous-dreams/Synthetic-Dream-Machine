/**
 * browser-handle-publish.test.ts — a browser/phone vessel publishes a Handle with no node CLI in reach.
 *
 * The isomorphic act (`publishHandleFromDaemonDoc`, @lararium/mesh) is proven platform-blind; THIS pins the
 * browser adapter that supplies its shores from the origin's own IndexedDB vault + store, and inherits the
 * fail-closed fence: a face anchors to its persona (the daemon doc's persona-KEL prefix owns it), and a
 * daemon doc with no prefix REFUSES — a browser face never self-owns, exactly as the node CLI refuses.
 */
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import { describe, test, expect, afterEach } from "vitest";
import { currentOwnerSet, type LarDoc, type HandleKelEvent } from "@lararium/mesh";
import { generateOrLoadBrowserPersonaRoot } from "../src/browser-vessel-identity.js";
import { sealOwnerFace, stableBoard } from "./handle-owner-fixture.js";
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

const emptyKelBoard = (): { doc(): LarDoc } => ({ doc: () => ({ tiddlers: {} } as LarDoc) });

describe("the browser publish surface — a phone vessel names itself", () => {
  test("★ publishes a persona-anchored Handle — the owner is the selected face's SEALED-ANCHOR prefix ★", async () => {
    const name = idb();
    await bindSyntheticBrowserCustodySlot(name);
    const face = await sealOwnerFace(name, 0);
    const card = await publishHandleBrowser({
      board: makeFakeBoard() as never, kelBoard: face.kelBoard as never,
      handleIndex: 0, glamour: "Guru-Josh", idbName: name,
    });
    const owners = currentOwnerSet(card.chain as HandleKelEvent[])!;
    expect(owners.members, "the persona owns the published face").toEqual([face.prefix]);
    expect(owners.members[0], "the handle key never owns itself").not.toBe(card.chain[0]!.handleKeyDid);
  });

  test("★ RED on the old door: a verb that selects the SECOND persona publishes under the second persona's prefix, never the founding one ★", async () => {
    const name = idb();
    await bindSyntheticBrowserCustodySlot(name);
    const kel = stableBoard();
    const founding = await sealOwnerFace(name, 0, kel);
    const second   = await sealOwnerFace(name, 1, kel);
    expect(second.prefix).not.toBe(founding.prefix);
    const card = await publishHandleBrowser({ board: makeFakeBoard() as never, kelBoard: kel as never, handleIndex: 1, glamour: "Second", idbName: name });
    expect(currentOwnerSet(card.chain as HandleKelEvent[])!.members).toEqual([second.prefix]);
  });

  test("★ FAIL-CLOSED CONTROLS — no sealed anchor, or no chain on the KEL board, refuses; a browser face never self-owns ★", async () => {
    const name = idb();
    await bindSyntheticBrowserCustodySlot(name);
    await generateOrLoadBrowserPersonaRoot(name, 0);   // a root, but no sealed anchor
    await expect(publishHandleBrowser({
      board: makeFakeBoard() as never, kelBoard: emptyKelBoard() as never, handleIndex: 0, glamour: "Guru-Josh", idbName: name,
    })).rejects.toThrow(/sealed anchor|belongs to its persona/i);
    const sealed = await sealOwnerFace(name, 1);
    await expect(publishHandleBrowser({
      board: makeFakeBoard() as never, kelBoard: emptyKelBoard() as never, handleIndex: 1, glamour: "Guru-Josh", idbName: name,
    }), `${sealed.prefix.slice(0, 12)}… with no chain on the board`).rejects.toThrow(/absent from the local board|fail-closed/i);
  });
});
