/**
 * e2e/sealed-session-store — a face's session seals and reopens a private body on a real vessel, through the real CLI's
 * session socket (lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store).
 *
 * THE STAND. A founds its hearth and a Nexus key; B, a vessel of the same face, lands A's fleet-join answer and dials
 * A's Nexus by the pin its landing wrote, so B's sessions anchor at that Nexus (a founder alone anchors at its own place,
 * and a place session reaches no sealed store). The daemon island holds no session key: it signs each record through
 * the session that placed the call, on B's main thread (the session sign door).
 *
 *   W1 — B's `h0` session seals a body into a bag its face registers: the island answers an address, a key version and
 *        the body's digest, and no plaintext rides the outcome
 *   W2 — B restarts over the same root; a fresh `h0` session opens the body by its digest, whole
 *   W3 — CONTROL: A's `h0` session stands at A's own place (A dials no Nexus): its seal refuses `session-anchor-place`
 *        and nothing seals
 *
 * The suite runs only in a STAGED target: it founds two vessels and never touches a live hearth.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { openStaged, openStagedJoinee, vesselStorageDir, type LarInstance, type StagedJoinee } from "../harness/instance.js";
import { mintStagedNexusKey } from "../harness/vessel-key.js";
import { openLocalSession } from "../../packages/lares-cli/src/session-connector.js";

const BAG = "lar:///ha.ka.ba/wikis/lares/working";
const BODY = `the household's private note, sealed by a session ${process.pid}`;
const staged = process.env["LAR_TARGET"] !== "live";

let pair: StagedJoinee | null = null;
let B2: LarInstance | null = null;

async function crossed(v: LarInstance): Promise<void> {
  const line = "[lar-leaf] verdict OK — crossing open";
  const deadline = performance.now() + 90_000;
  while (!v.bootLog().includes(line) && performance.now() < deadline) await new Promise((r) => setTimeout(r, 250));
  if (!v.bootLog().includes(line)) throw new Error(`B never crossed A's gate:\n${v.bootLog().slice(-2000)}`);
}

/** One call over a fresh `h0` session on `v`'s socket; a refusal answers as data. */
async function call(v: LarInstance, verb: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const session = await openLocalSession({ faceRef: "h0", dataDir: vesselStorageDir(v) });
  try { return await session.call(verb, args, { timeoutMs: 90_000 }); }
  finally { await session.close(); }
}
const refusalOf = (answer: Record<string, unknown>): string | undefined => (answer["refusal"] as { reason?: string } | undefined)?.reason;
const resultOf = (answer: Record<string, unknown>): Record<string, unknown> => {
  const summary = (answer["results"] as { summary?: { output?: Record<string, unknown> } } | undefined)?.summary;
  return summary?.output ?? {};
};

beforeAll(async () => {
  if (!staged) return;
  pair = await openStagedJoinee({ tag: "sealed-session", riteA: async (_cli, rootA) => { await mintStagedNexusKey(rootA); } });
  if (!pair.B) throw new Error(`B never stood: ${pair.joinGate ?? ""}`);
  await crossed(pair.B);
}, 600_000);

afterAll(async () => { await B2?.stopDaemonOnly(); await pair?.stop(); });

describe.runIf(staged)("a face's session reaches the sealed store on a real vessel", () => {
  let sealed: Record<string, unknown> = {};

  test("W1 — B's session seals a body; the outcome names an address, a key version and a digest, and no plaintext", async () => {
    const answer = await call(pair!.B!, "sealed-seal", { bag: BAG, text: BODY });
    expect(answer["status"], JSON.stringify(answer).slice(0, 800)).not.toBe("error");
    sealed = resultOf(answer);
    expect(String(sealed["cid"]), JSON.stringify(answer).slice(0, 800)).toMatch(/^blake3:[0-9a-f]{64}$/);
    expect(String(sealed["keyVersion"])).toMatch(/^[0-9a-f]+$/);
    expect(String(sealed["ref"])).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(answer).includes(BODY)).toBe(false);
  }, 180_000);

  test("W2 — B restarts over the same root, and a fresh session opens the body by its digest, whole", async () => {
    expect(sealed["ref"]).toBeTruthy();
    await pair!.B!.stopDaemonOnly();
    B2 = await openStaged({ tag: "sealed-session-B2", root: pair!.rootB, port: pair!.portB, found: async () => {} });
    await crossed(B2);
    const answer = await call(B2, "sealed-open", { bag: BAG, ref: sealed["ref"] });
    expect(answer["status"], JSON.stringify(answer).slice(0, 800)).not.toBe("error");
    const opened = resultOf(answer);
    expect(opened["keyVersion"]).toBe(sealed["keyVersion"]);
    expect(opened["cid"]).toBe(sealed["ref"]);
    expect(opened["bytes"]).toBe(Buffer.byteLength(BODY));
  }, 300_000);

  test("W3 — CONTROL: a place session (A dials no Nexus) reaches no sealed store: `session-anchor-place`, nothing seals", async () => {
    const answer = await call(pair!.A, "sealed-seal", { bag: BAG, text: "x" });
    expect(refusalOf(answer), JSON.stringify(answer).slice(0, 800)).toBe("session-anchor-place");
  }, 180_000);
});
