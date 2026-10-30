/**
 * sealed-memory-vessel — a backup bundle's memory section leaves and enters a REAL founded vessel's island sealed.
 *
 * The real `operatorDaemonOptions` boot runs over a real founding, with real Keyhive identities and the node's own
 * sealed-store shore. The island's three memory verbs run as the dispatcher runs them. Each answers its own
 * vessel's main thread alone: the ask carries the vessel key's signature over its request and what it hands in.
 *
 * The session proof stands composed here as the sealed store's own vessel vectors compose it; no production path
 * opens a session signer yet.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · lar:///ha.ka.ba/lararium/mesh/custody#/the-bundle
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import type { SessionProof } from "@lararium/keyhive";
import {
  ed25519SignerFromSeed, hex, hexToBytes, isVerbRefusal, memoryKeypairOf, mintMemoryKeypair, openMemorySection, sealMemorySecret,
  signMemoryAsk, type MemoryAct, type RecordSigner,
} from "@lararium/mesh";
import { VerbTable } from "@lararium/tw5";
import { sessionSignatureImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { chain, signHex } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { standFoundedIsland } from "./stand-founded-island.js";
import { nodeSealedStoreShore } from "../src/sealed-store-island.js";

const BAG = "lar:///ha.ka.ba/@test/bags/SEARCH-ME-garden-notes";
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");
const unb64 = (s: unknown): Uint8Array => new Uint8Array(Buffer.from(String(s), "base64"));

async function proof(): Promise<SessionProof> {
  const c = await chain("memory-vessel", "nexus-test-one");
  const signer: RecordSigner = {
    certificate: c.sessionCertificate,
    sign: async (purpose, payload) => ({ signature: await signHex(sessionSignatureImage(purpose, c.scope, c.sessionCertificate.sessionKey, payload), c.session) }),
  };
  return { signer: () => signer, standing: { holdsWrite: () => true } };
}

/** Boot the real daemon options over one founded island whose composition names `BAG`; answer its verbs. */
async function stand(over: { dyad?: () => "clear" | "aside" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "memory-vessel-"));
  teardown.push(() => rmSync(root, { recursive: true, force: true }));
  const st = await standFoundedIsland(teardown);
  const daemonAuth = { ...st.daemonAuth, registerBags: [...st.daemonAuth.registerBags, BAG], ...st.veil };
  const opts = operatorDaemonOptions({ daemonAuth } as never, {
    dyadReading: () => (over.dyad ? over.dyad() : "clear"), sealedStore: nodeSealedStoreShore(join(root, "daemon")), persistArchive: () => {}, persistVeilArchive: () => {}, sessionProof: await proof(),
  });
  const kh = await opts.verifierFactory!(st.ctx) as { dispose?: () => Promise<void> };
  teardown.push(() => { void kh.dispose?.(); });
  const registry = new VerbTable();
  opts.wireWorkerVerbs!(registry, st.ctx);
  let n = 0;
  const vesselSign = ed25519SignerFromSeed(Uint8Array.from(Buffer.from(st.veil.atom.seed, "hex")));
  /** Run one verb as the dispatcher would, under a request id of its own. `sign` signs the ask; `as` overrides the facts signed. */
  const run = async (verb: string, args: Record<string, unknown>, ask?: { act: MemoryAct; facts: unknown; sign?: (bytes: Uint8Array) => Promise<string>; requestId?: string }) => {
    const requestId = `r${++n}`;
    const signed = ask ? { ask: await signMemoryAsk({ requestId: ask.requestId ?? requestId, act: ask.act, facts: ask.facts, sign: ask.sign ?? vesselSign }) } : {};
    return registry.get(verb)!({ ...args, ...signed }, { daemon: {} as never, invocation: { requestId } as never, cap: async () => ({ ok: true }), presenter: `0x${st.daemonAuth.atom.key}`, local: true } as never) as Promise<Record<string, unknown>>;
  };
  return { run, registry, vesselSign, placeSeed: st.placeSeed, presenter: `0x${st.daemonAuth.atom.key}` };
}
const refusal = async (p: Promise<unknown>): Promise<string> => {
  const e = await p.then(() => null, (err: unknown) => err);
  return e === null ? "ANSWERED" : isVerbRefusal(e) ? (e as { reason: string }).reason : `threw: ${(e as Error).message.slice(0, 60)}`;
};

describe("a memory section leaves and enters a real founded vessel's island sealed", () => {
  test("cut → the section opens under its pair alone and names the counted version; import through a named door answers `held`", async () => {
    const { run } = await stand();
    const sealed = await run("sealed-seal", { bag: BAG, text: "a private note" });
    // THE CUT: a public key in, ciphertext and a list out. The pair derives from 32 bytes the bundle holds.
    const pair = memoryKeypairOf(new Uint8Array(32).fill(9));
    const to = hex(pair.public);
    const cut = await run("sealed-memory-cut", { to }, { act: "cut", facts: { to } });
    expect(cut["holds"]).toEqual([{ bagId: BAG, founding: sealed["founding"], keyVersion: sealed["keyVersion"] }]);
    const entries = openMemorySection(unb64(cut["section"]), pair.secret)!;
    expect(entries.map((e) => [e.bagId, e.keyVersion])).toEqual([[BAG, sealed["keyVersion"]]]);
    // The outcome rests in the daemon wiki: it holds no bare key. CONTROL FIRST: the hunt finds a key where one rests.
    const key = hex(entries[0]!.key);
    expect(hex(hexToBytes(key)).includes(key)).toBe(true);
    expect(hex(unb64(cut["section"])).includes(key)).toBe(false);
    expect(JSON.stringify(cut).includes(key)).toBe(false);
    expect(openMemorySection(unb64(cut["section"]), mintMemoryKeypair().secret)).toBeNull();

    // THE IMPORT: the island names a door; the section's secret half crosses sealed to it.
    const door = await run("sealed-memory-door", {}, { act: "door", facts: {} });
    const args = { section: String(cut["section"]), secret: b64(sealMemorySecret(pair.secret, hexToBytes(String(door["door"])))) };
    const imported = await run("sealed-memory-import", args, { act: "import", facts: args });
    expect(imported["results"]).toEqual([{ bagId: BAG, keyVersion: sealed["keyVersion"], outcome: "held" }]);
    // ONE DOOR, ONE IMPORT: the same sealed secret a second time meets no door.
    expect(await refusal(run("sealed-memory-import", args, { act: "import", facts: args }))).toBe("memory-door-unnamed");
    // A secret sealed to another door opens nothing.
    await run("sealed-memory-door", {}, { act: "door", facts: {} });
    const astray = { section: String(cut["section"]), secret: b64(sealMemorySecret(pair.secret, mintMemoryKeypair().public)) };
    expect(await refusal(run("sealed-memory-import", astray, { act: "import", facts: astray }))).toBe("memory-malformed");
  }, 120_000);

  test("AN ACT READS ITS SHADOW ONCE: a cut whose signed ask says the vessel read its shadow draws a section under a shadow that landed since; an ask that says nothing refuses", async () => {
    let shadow: "clear" | "aside" = "clear";
    const { run } = await stand({ dyad: () => shadow });
    await run("sealed-seal", { bag: BAG, text: "a private note" });
    shadow = "aside";   // a raise lands after the cut's own entry read
    const to = hex(mintMemoryKeypair().public);
    const carried = { to, shadow: "read-clear" };
    const cut = await run("sealed-memory-cut", carried, { act: "cut", facts: carried });
    expect((cut["holds"] as unknown[]).length).toBe(1);
    // CONTROL: the same island under the same shadow, asked with no word of a read, refuses.
    expect(await refusal(run("sealed-memory-cut", { to }, { act: "cut", facts: { to } }))).toBe("own-edge-shadowed");
    // The word rides inside the signed facts: slipped in beside an ask signed without it, the ask refuses.
    expect(await refusal(run("sealed-memory-cut", carried, { act: "cut", facts: { to } }))).toBe("memory-ask-unlicensed");
    // Any other spelling of the word reads as no word.
    const bent = { to, shadow: "clear" };
    expect(await refusal(run("sealed-memory-cut", bent, { act: "cut", facts: { to } }))).toBe("own-edge-shadowed");
  }, 120_000);

  test("THE ISLAND ANSWERS ITS OWN VESSEL ALONE: no ask, another key's ask, another request's ask and another act's ask each refuse", async () => {
    const { run, registry, vesselSign, placeSeed, presenter } = await stand();
    await run("sealed-seal", { bag: BAG, text: "a private note" });
    const to = hex(mintMemoryKeypair().public);
    const stranger = ed25519SignerFromSeed(new Uint8Array(32).fill(3));
    expect(await refusal(run("sealed-memory-cut", { to }))).toBe("memory-ask-unlicensed");
    expect(await refusal(run("sealed-memory-cut", { to }, { act: "cut", facts: { to }, sign: stranger }))).toBe("memory-ask-unlicensed");
    expect(await refusal(run("sealed-memory-cut", { to }, { act: "cut", facts: { to }, sign: ed25519SignerFromSeed(placeSeed) }))).toBe("memory-ask-unlicensed");
    expect(await refusal(run("sealed-memory-cut", { to }, { act: "cut", facts: { to }, requestId: "another-request" }))).toBe("memory-ask-unlicensed");
    expect(await refusal(run("sealed-memory-cut", { to }, { act: "door", facts: { to } }))).toBe("memory-ask-unlicensed");
    // The signature binds the recipient: an ask signed for one key draws no section for another.
    expect(await refusal(run("sealed-memory-cut", { to }, { act: "cut", facts: { to: hex(mintMemoryKeypair().public) } }))).toBe("memory-ask-unlicensed");
    expect(await refusal(run("sealed-memory-door", {}))).toBe("memory-ask-unlicensed");
    expect(await refusal(run("sealed-memory-import", { section: "AA==", secret: "AA==" }))).toBe("memory-ask-unlicensed");
    // CONTROL: the vessel's own ask draws the section.
    expect(typeof (await run("sealed-memory-cut", { to }, { act: "cut", facts: { to } }))["section"]).toBe("string");
    // ONE SIGNED ASK RUNS ONCE: the same signed invocation, placed again under its own request id, refuses.
    const signed = { to, ask: await signMemoryAsk({ requestId: "replayed", act: "cut", facts: { to }, sign: vesselSign }) };
    const place = () => registry.get("sealed-memory-cut")!(signed, { daemon: {} as never, invocation: { requestId: "replayed" } as never, cap: async () => ({ ok: true }), presenter, local: true } as never);
    expect(typeof ((await place()) as Record<string, unknown>)["section"]).toBe("string");
    expect(await refusal(Promise.resolve().then(place))).toBe("memory-ask-spent");
  }, 120_000);
});
