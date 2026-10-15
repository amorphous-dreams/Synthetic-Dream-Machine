/**
 * handle-publish — the platform-blind orchestration behind `lares handle publish` (and any vessel's publish).
 *
 * Held to the owner-model ruling (2026-09-09): the act reads the persona-KEL prefix off the daemon doc and
 * seats it as the published face's owner — so a Handle anchors to its persona, never to itself. And it FAILS
 * CLOSED when the daemon doc carries no prefix: a face with no persona to own it never self-owns (which
 * forecloses recovery). Living in mesh, a browser or phone vessel runs the same core a node CLI does.
 */
import { describe, test, expect } from "vitest";
import { publishHandleFromDaemonDoc } from "../src/handle-publish.js";
import { PERSONA_KEL_PREFIX_TIDDLER } from "../src/lar-uris.js";
import { currentOwnerSet, type HandleKelEvent } from "../src/handle-kel.js";
import type { LarDoc } from "../src/base-doc.js";
import type { OwnPublicHandleStore, PersonaPublicHandleRecord } from "../src/persona-glamour.js";

const SEED = Uint8Array.from(Array.from({ length: 32 }, (_, i) => (i * 3 + 7) & 0xff));
const OWNER = "persona-" + "ab".repeat(32);

/** A fake WHO board — just enough for announceToWhoFace (change() over an in-memory LarDoc). */
function makeFakeBoard(): { doc(): LarDoc; change(fn: (d: LarDoc) => void): void } {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  return { doc: () => d, change: (fn) => fn(d) };
}

function makeStore(): OwnPublicHandleStore {
  const m = new Map<number, PersonaPublicHandleRecord>();
  return {
    async load(i) { return m.get(i) ?? null; },
    async save(r) { m.set(r.handleIndex, r); },
    async list() { return [...m.keys()].sort((a, b) => a - b); },
  };
}

function daemonDoc(prefix?: string): LarDoc {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  if (prefix) {
    (d.tiddlers as Record<string, unknown>)[PERSONA_KEL_PREFIX_TIDDLER] =
      { tiddler: { title: PERSONA_KEL_PREFIX_TIDDLER, text: prefix, kind: "persona-kel-prefix" } };
  }
  return d;
}

describe("handle-publish — the 'here I am' note anchors to its persona (isomorphic)", () => {
  test("★ the published Handle's owner member reads as the daemon doc's persona-KEL prefix ★", async () => {
    const card = await publishHandleFromDaemonDoc({
      daemonDoc: daemonDoc(OWNER), board: makeFakeBoard() as never,
      seed: SEED, handleIndex: 0, glamour: "Guru-Josh", now: 100, store: makeStore(),
    });
    const owners = currentOwnerSet(card.chain as HandleKelEvent[])!;
    expect(owners.members, "the persona owns the published face").toEqual([OWNER]);
    expect(owners.members[0], "the handle key never owns itself").not.toBe(card.chain[0]!.handleKeyDid);
  });

  test("★ FAIL-CLOSED — no persona-KEL prefix on the daemon doc refuses; the face never self-owns ★", async () => {
    await expect(publishHandleFromDaemonDoc({
      daemonDoc: daemonDoc(undefined), board: makeFakeBoard() as never,
      seed: SEED, handleIndex: 0, glamour: "Guru-Josh", now: 100, store: makeStore(),
    })).rejects.toThrow(/persona-KEL prefix|belongs to its persona/i);
  });
});
