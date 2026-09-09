/**
 * handle-publish — `lares handle publish`, the publicly published "here I am" note (a Handle).
 *
 * The command's own new logic, held to the owner-model ruling (2026-09-09): it reads the persona-KEL
 * prefix off the daemon doc and seats it as the face's owner — so the published Handle anchors to its
 * persona, never to itself. And it FAILS CLOSED when the daemon doc carries no prefix: a face with no
 * persona to own it must never fall back to self-ownership (which forecloses recovery). The mint itself
 * (persona-glamour) is proven platform-blind; this pins the daemon-doc → owner wire and the fence.
 */
import { describe, test, expect } from "vitest";
import { publishHandleFromDaemonDoc } from "../src/commands/handle.js";
import {
  PERSONA_KEL_PREFIX_TIDDLER, currentOwnerSet,
  type LarDoc, type HandleKelEvent, type OwnPublicHandleStore, type PersonaPublicHandleRecord,
} from "@lararium/mesh";

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

/** A daemon doc carrying (or lacking) the persona-KEL prefix tiddler the founding persists. */
function daemonDoc(prefix?: string): LarDoc {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  if (prefix) {
    (d.tiddlers as Record<string, unknown>)[PERSONA_KEL_PREFIX_TIDDLER] =
      { tiddler: { title: PERSONA_KEL_PREFIX_TIDDLER, text: prefix, kind: "persona-kel-prefix" } };
  }
  return d;
}

describe("lares handle publish — the 'here I am' note anchors to its persona", () => {
  test("★ the published Handle's owner member is the daemon doc's persona-KEL prefix ★", async () => {
    const card = await publishHandleFromDaemonDoc({
      daemonDoc: daemonDoc(OWNER), board: makeFakeBoard() as never,
      seed: SEED, handleIndex: 0, glamour: "Guru-Josh", now: 100, store: makeStore(),
    });
    const owners = currentOwnerSet(card.chain as HandleKelEvent[])!;
    expect(owners.members, "the persona owns the published face").toEqual([OWNER]);
    expect(owners.members[0], "the handle key does NOT own itself").not.toBe(card.chain[0]!.handleKeyDid);
  });

  test("★ FAIL-CLOSED — no persona-KEL prefix on the daemon doc refuses; the face never self-owns ★", async () => {
    await expect(publishHandleFromDaemonDoc({
      daemonDoc: daemonDoc(undefined), board: makeFakeBoard() as never,
      seed: SEED, handleIndex: 0, glamour: "Guru-Josh", now: 100, store: makeStore(),
    })).rejects.toThrow(/persona-KEL prefix|owned by its persona/i);
  });
});
