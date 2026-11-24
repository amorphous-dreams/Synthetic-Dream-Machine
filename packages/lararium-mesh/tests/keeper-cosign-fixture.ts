/**
 * keeper-cosign-fixture — one face's plane and gate port, and the keeper vest's co-sign driven through the real gate: the issuer's
 * first reach lands its intent and ask and waits; a device answers the ask (under its own atom and its own ward key, or a forger's
 * choice of both); the issuer's second reach spends it and hands back the proof a keeper commit carries.
 */
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { faceIntentVerbs } from "../src/intent-verbs.js";
import { buildAnswer, buildOutcome } from "../src/intent-issue.js";
import { intentEntryCid } from "../src/intent-entry.js";
import { keeperCosignGate, keeperVestAct, type KeeperCosign, type KeeperVestTerms } from "../src/keeper-cosign.js";
import { wardAnswerImage } from "../src/ward-answer.js";
import { intentPlaneCosignPort, wardCosignIntentId, type WardCosignPort } from "../src/ward-cosign-gate.js";

export type Signer = { readonly key: string; sign(bytes: Uint8Array): Promise<string> };
export const keyed = async (n: number): Promise<Signer> => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
export const KEEPER_FACE = "keeper-cosign-face", F0 = "0".repeat(64);

/** A face of `devicesN` devices (a: the vessel, b: the second device, c: a third), its plane, and the vessel's gate port. */
export async function keeperFace(devicesN: 1 | 2 | 3, group = KEEPER_FACE) {
  const a = await keyed(71), b = await keyed(72), c = await keyed(73), root = await keyed(74);
  const ward = new Map<string, Signer>([[a.key, await keyed(81)], [b.key, await keyed(82)], [c.key, await keyed(83)]]);
  const devices = [a.key, b.key, c.key].slice(0, devicesN);
  const lineage = makeHandLineage([{ epoch: 0, signers: [root.key], threshold: 1 }])!;
  const doc = { tiddlers: {} } as LarDoc;
  const plane = { doc: () => doc, change: (fn: (d: LarDoc) => void) => fn(doc) };
  const port: WardCosignPort = intentPlaneCosignPort({ group, requester: a, verbs: faceIntentVerbs(), plane,
    face: () => ({ devices, rosterCids: ["admit"], admittedAt: new Map(devices.map((d) => [d, "admit"])), lineage }),
    standing: () => "stands", frontier: () => F0, stoodAt: () => true, wardKey: (k) => ward.get(k)?.key ?? null });
  /** A device's answer to the issuer's ask, signed by `by` under the ward key of `wardOf` (its own, by default). */
  const answer = async (by: Signer, ask: string, terms: KeeperVestTerms, wardOf: Signer = by) => {
    const { digest } = wardCosignIntentId(port, keeperVestAct(terms, devices));
    const wardSig = await ward.get(wardOf.key)!.sign(wardAnswerImage({ group, ask, detail: digest, verdict: "approve", executor: a.key, frontier: F0 }));
    const entry = await buildAnswer({ group, signer: by, ask, verdict: "approve", executor: a.key, refs: [ask], frontier: F0, wardSig });
    await port.write(entry);
    return entry;
  };
  return { a, b, c, ward, devices, port, group, answer };
}

/** The gate's waiting refusal carries the ask's cid as its message. */
export async function awaitingAsk(port: WardCosignPort, terms: KeeperVestTerms & { readonly ordinal: number }): Promise<string> {
  try { await keeperCosignGate(port, terms); }
  catch (e) { if ((e as { reading?: string }).reading === "ward-awaiting-cosign") return (e as Error).message.slice("ward-awaiting-cosign: ".length); throw e; }
  throw new Error("the gate did not wait on a co-sign");
}

/** The whole co-sign over one commit on a face of two devices: ask, the second device's approve, the spend. */
export async function cosignedCommit(terms: KeeperVestTerms, ordinal = 0, group = KEEPER_FACE): Promise<KeeperCosign> {
  const f = await keeperFace(2, group);
  const ask = await awaitingAsk(f.port, { ...terms, ordinal });
  await f.answer(f.b, ask, terms);
  return keeperCosignGate(f.port, { ...terms, ordinal });
}

/** A forged spend: the vessel answers its own ask under its own ward key and signs the outcome over that answer, outside the gate. */
export async function selfCosigned(terms: KeeperVestTerms, ordinal = 0): Promise<KeeperCosign> {
  const f = await keeperFace(2);
  const ask = await awaitingAsk(f.port, { ...terms, ordinal });
  const self = await f.answer(f.a, ask, terms);
  const act = keeperVestAct(terms, f.devices), { id, digest } = wardCosignIntentId(f.port, act);
  const outcome = await buildOutcome({ group: f.group, signer: f.a, cause: id, result: { status: "done", act: act.verb, digest, cosigner: f.a.key, answer: intentEntryCid(self), frontier: F0 } });
  const askEntry = f.port.view()!.intents.find((s) => s.id === id)!.asks[0]!.entry;
  return { ordinal, group: f.group, devices: [...f.devices].sort(), proof: { wardKey: f.ward.get(f.a.key)!.key, ask: askEntry, answer: self, outcome } };
}
