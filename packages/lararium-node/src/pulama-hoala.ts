/**
 * pulama-hoala — THE HOʻĀLA LEI: a restarted keeper stands lit again with no terminal, one counted return per restart.
 *
 * A host restart ends the keeper's process, and the fire with it: every key it held lived in memory alone. The hand strings ONE
 * hoʻāla lei on a terminal (`lares lei kui --rite hoala --returns <n>`), proving the vessel's route against the lit keeper as an
 * admit does; from then the keeper that starts unlit on the same code closure may spend one return (`hoala`, no route) and stand
 * lit with the faces that stood lit at the stringing. Returns spent, the lei unstrung, the closure moved, or either half missing:
 * the keeper stays at the locked floor and the hand lights it.
 *
 * ── WHAT RESTS, AND WHERE ───────────────────────────────────────────────────────────────────────
 *   hoala/lei/<cid>           `hoala-strung`: the lei itself, under the pūlama's key (its returns, the closure it licenses, the
 *                               image and the faces lit at the stringing). The cid names the lei everywhere below.
 *   hoala/slot                `hoala-slot`: ONE row, the sealed keys for the return that comes next. It carries what a keeper
 *                               vest carries (the node key and each lit face's custody key, `keeperPayloadPack`), sealed to one
 *                               X25519 key (`sealed-box`), bound by the seal's salt to the lei, the closure and the count `n` of
 *                               returns spent so far, and signed under the pūlama's key. It rests in the pūlama's STATE directory
 *                               (the house: `LARES_HOUSE/pulama/state`).
 *   <device>/hoala-<pub>.key  THE DEVICE KEY: the X25519 secret that opens the slot, in hex, 0600. It rests in the keeper's DEVICE
 *                               directory (`hoalaDeviceDir`: the state directory's sibling `device`), which the compose file
 *                               mounts from a named Docker volume the keeper alone mounts and no host path names. It belongs to
 *                               this device: a keep, a backup or a copy of the house carries the slot and never this key.
 *   hoala/receipt/<lei>/<n>   `hoala-woke`: one receipt per return spent, claimed atomically (`writeNew`) BEFORE the slot
 *                               moves and before anything serves.
 *   hoala/unstrung/<lei>      the unstring's word (signed where the keeper stands lit).
 *
 * ── THE COUNT RATCHETS INSIDE THE SLOT ──────────────────────────────────────────────────────────
 * No clock ends a hoʻāla lei. Each spend claims its receipt, then seals the SAME keys afresh to a NEW device key under `n + 1`
 * and destroys the key before it; the last return destroys slot and key and seals nothing. So the count rides the signed slot
 * itself, and a deleted receipt returns no return. A slot brought back from an older copy finds its receipt standing and refuses
 * `hoala-return-respent`, which locks the keeper and destroys what rests.
 *
 * ── WHO COULD USE IT (the custody this lei moves; read it before stringing one) ────────────────
 * Unstrung, the keeper's keys never rest: a restart costs the hand's route. Strung, the house's end of the bond rests on this
 * machine in two halves, and whoever reads BOTH opens it with no route:
 *   - anyone who can run Docker as the operator on this host (the volume mounts into any container they start) and read the
 *     house directory: every host process under the operator's uid, AI seats among them. The doors refuse a seat the stringing
 *     and name no read of either half; a seat that leaves the doors and reads the files holds what this lei holds.
 *   - anyone holding the powered-off disk, where the disk carries no encryption of its own.
 * It never reaches: a copy of the house alone (a keep, a carry, a backup of LARES_HOUSE), a vessel (it mounts neither half), or the
 * human's route (the passphrase and the paper pins never ride a slot; ward keys never rest open to hand).
 * A holder of both halves at one earlier moment can bring both back and spend a return again: the ratchet binds the house's own
 * doors, never a disk someone else rewinds.
 *
 * ── THE SAME KEEPER CODE, AND ONE LIFE ──────────────────────────────────────────────────────────
 * The slot names the closure the hand strung it under, and a keeper reporting another closure refuses `hoala-closure-moved`: a
 * moved keeper takes the hand's light (the struck fire), as the keeper tally asks. And a keeper that stood lit once in its life
 * refuses `hoala-keeper-lived`: a `lock` by the hand stays locked, since the lei re-stands a RESTARTED keeper alone.
 *
 * ── UNSTRING: REVOKE WINS ───────────────────────────────────────────────────────────────────────
 * `hoalaUnstring` asks no route and no light: it destroys the device key (overwritten, then unlinked), clears the slot row and
 * rests the unstring's word. Destroying lowers power alone, so a locked keeper unstrings as a lit one does.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-restart-lei
 */
import { randomUUID } from "node:crypto";
import { accessSync, closeSync, constants, fsyncSync, openSync, readFileSync, readdirSync, statSync, unlinkSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { mintSealedBoxRecipient, openFromSender, sealToRecipient } from "@lararium/mesh/sealed-box";
import { type SwarmWikiPort } from "@lararium/mesh/swarm-tiddlers";
import type { KukuluSigner } from "./kukulu-gate.js";
import { CLOSURE, keeperPayloadDrop, keeperPayloadPack, keeperPayloadUnpack, type KeeperKeys, type VestPayload } from "./pulama-keeper.js";
import {
  pulamaRecordCid, signPulamaRecord, verifiedPulamaRecord,
  type AdmittedFace, type HoalaSlotBody, type SignedPulamaAdmit,
} from "./pulama-admit.js";

const PREFIX = "$:/lares/pulama/hoala/";
export const pulamaHoalaPrefix = (): string => PREFIX;
export const hoalaSlotTitle = (): string => `${PREFIX}slot`;
export const hoalaLeiTitle = (lei: string): string => `${PREFIX}lei/${lei}`;
export const hoalaReceiptTitle = (lei: string, n: number): string => `${PREFIX}receipt/${lei}/${n}`;
export const hoalaUnstrungTitle = (lei: string): string => `${PREFIX}unstrung/${lei}`;
/** A count above this asks the hand to confirm it, as a lei's does (`LEI_RETURNS_ASK_ABOVE`). */
export const HOALA_RETURNS_ASK_ABOVE = 12;
/** THE CURE every refusal that leaves the keeper dark names: the hand's light, then a fresh stringing. */
export const HOALA_HAND_CURE = "light the keeper by hand on a terminal (`lares pulama light`), then string a hoʻāla lei again: lares lei kui --rite hoala --returns <n>";

const HOALA_INFO = new TextEncoder().encode("lares/pulama/hoala-slot");
const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
const unhex = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, "hex"));
const HEX64 = /^[0-9a-f]{64}$/;
const saltOf = (lei: string, closure: string, n: number): Uint8Array[] => [unhex(lei), new TextEncoder().encode(`${closure}#${n}`)];

export type HoalaRefusal = { readonly refusal: string; readonly detail: string };
const refuse = (refusal: string, detail: string): HoalaRefusal => ({ refusal, detail });

/** THE DEVICE DIRECTORY: the state directory's sibling `device` (in the container, `/pulama/device`, a keeper-only named volume). */
export const hoalaDeviceDir = (state: string): string => join(dirname(state), "device");

/** The keeper's hold on its device keys. Every key file names the public half it opens for. */
export interface HoalaDevice {
  /** Whether the device directory stands and takes a write: a keeper with none strings no hoʻāla lei. */
  seated(): boolean;
  /** Rest one device secret for `pub` (an exclusive create, 0600, synced). */
  put(pub: string, secret: Uint8Array): void;
  /** The secret that opens for `pub`, as fresh bytes the caller zeroes; null where none rests. */
  take(pub: string): Uint8Array | null;
  /** Destroy every device key but `keep`'s: each file overwritten with zeros, synced, then unlinked. Answers the count destroyed. */
  drop(keep?: string): number;
}

export function hoalaDevice(dir: string): HoalaDevice {
  const fileOf = (pub: string): string => join(dir, `hoala-${pub}.key`);
  return {
    seated() { try { accessSync(dir, constants.W_OK | constants.X_OK); return statSync(dir).isDirectory(); } catch { return false; } },
    put(pub, secret) {
      const fd = openSync(fileOf(pub), "wx", 0o600);
      try { writeSync(fd, hex(secret)); fsyncSync(fd); } finally { closeSync(fd); }
    },
    take(pub) {
      if (!HEX64.test(pub)) return null;
      try { const text = readFileSync(fileOf(pub), "utf8").trim(); return HEX64.test(text) ? unhex(text) : null; } catch { return null; }
    },
    drop(keep) {
      let dropped = 0, names: string[] = [];
      try { names = readdirSync(dir); } catch { return 0; }
      for (const name of names) {
        if (!/^hoala-[0-9a-f]{64}\.key$/.test(name) || (keep !== undefined && name === `hoala-${keep}.key`)) continue;
        const path = join(dir, name);
        try {
          const size = statSync(path).size;
          const fd = openSync(path, "r+");
          try { writeSync(fd, Buffer.alloc(size), 0, size, 0); fsyncSync(fd); } finally { closeSync(fd); }
        } catch { /* a file that takes no overwrite still unlinks below */ }
        try { unlinkSync(path); dropped++; } catch { /* a file that stays is named by the next drop */ }
      }
      return dropped;
    },
  };
}

type SignedSlot = SignedPulamaAdmit & { readonly body: HoalaSlotBody };

/** The slot row's shape, read before any key stands (an unlit keeper verifies no signature): null where none rests or it reads no slot. */
export async function hoalaSlotRead(records: SwarmWikiPort): Promise<{ readonly slot: SignedSlot; readonly text: string } | null> {
  const text = await records.read(hoalaSlotTitle());
  if (text === null || text === "") return null;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const s = raw as { body?: Partial<HoalaSlotBody>; signer?: unknown; sig?: unknown } | null;
  const b = s?.body, box = b?.box;
  if (typeof s !== "object" || s === null || typeof s.signer !== "string" || typeof s.sig !== "string" || typeof b !== "object" || b === null) return null;
  if (b.act !== "hoala-slot" || typeof b.lei !== "string" || !HEX64.test(b.lei) || typeof b.to !== "string" || !HEX64.test(b.to) || typeof b.closure !== "string" || !CLOSURE.test(b.closure)) return null;
  if (!Number.isSafeInteger(b.returns) || !Number.isSafeInteger(b.n) || (b.returns as number) < 1 || (b.n as number) < 0 || !Array.isArray(b.faces)) return null;
  if (typeof box !== "object" || box === null || typeof box.e !== "string" || typeof box.n !== "string" || typeof box.c !== "string") return null;
  return { slot: s as SignedSlot, text };
}

/** What `status` names of a standing hoʻāla lei: public counts alone, unverified while the keeper stands unlit. */
export async function hoalaStanding(records: SwarmWikiPort): Promise<{ readonly lei: string; readonly returns: number; readonly left: number; readonly closure: string; readonly faces: readonly number[] } | null> {
  const read = await hoalaSlotRead(records);
  if (read === null) return null;
  const b = read.slot.body;
  if ((await records.read(hoalaUnstrungTitle(b.lei))) !== null) return null;
  return { lei: b.lei, returns: b.returns, left: Math.max(0, b.returns - b.n), closure: b.closure, faces: b.faces.flatMap((f) => (Number.isSafeInteger(f?.ordinal) ? [f.ordinal] : [])).sort((x, y) => x - y) };
}

/** Seal one payload for return `n` to a FRESH device key: the key rests first, the slot row switches, the keys before it die. */
async function sealSlot(records: SwarmWikiPort, by: KukuluSigner, device: HoalaDevice, at: { readonly lei: string; readonly returns: number; readonly n: number; readonly closure: string; readonly payload: VestPayload }): Promise<SignedSlot> {
  const minted = mintSealedBoxRecipient();
  const to = hex(minted.pub);
  const plain = keeperPayloadPack({ node: at.payload.node, faces: at.payload.faces, spent: 0, worn: at.payload.worn });
  try {
    const box = sealToRecipient({ recipientPub: minted.pub, plaintext: plain, info: HOALA_INFO, extraSalt: saltOf(at.lei, at.closure, at.n) });
    const slot = await signPulamaRecord<"hoala-slot">({ act: "hoala-slot", lei: at.lei, returns: at.returns, n: at.n, closure: at.closure, faces: at.payload.faces.map((f) => ({ fcid: f.fcid, ordinal: f.ordinal })), to, box: { e: hex(box.senderEphemeralPub), n: hex(box.aeadNonce), c: hex(box.ciphertext) } }, by) as SignedSlot;
    device.put(to, minted.secret);
    await records.write(hoalaSlotTitle(), JSON.stringify(slot));
    device.drop(to);
    return slot;
  } finally { plain.fill(0); minted.secret.fill(0); }
}

/** Why a lei ended, as the slot's row names it once nothing rests: the next waking reads its refusal off this word. */
type HoalaEnded = "returns-spent" | "unstrung" | "refused" | "superseded";
/** Clear what rests: every device key dies, and the slot's row turns to the bare word of how the lei ended (no key, no box). */
async function destroy(records: SwarmWikiPort, device: HoalaDevice, ended: HoalaEnded, lei: string | null): Promise<void> {
  device.drop();
  if (lei !== null || (await records.read(hoalaSlotTitle())) !== null) await records.write(hoalaSlotTitle(), JSON.stringify({ ended, lei }));
}
/** How the last lei ended, off the slot's row: null where no row rests or it names no ending. */
async function endedOf(records: SwarmWikiPort): Promise<{ readonly ended: string; readonly lei: string | null } | "malformed" | null> {
  const text = await records.read(hoalaSlotTitle());
  if (text === null || text === "") return null;
  try {
    const raw = JSON.parse(text) as { ended?: unknown; lei?: unknown };
    return typeof raw?.ended === "string" ? { ended: raw.ended, lei: typeof raw.lei === "string" ? raw.lei : null } : "malformed";
  } catch { return "malformed"; }
}

/**
 * STRING (the caller proved the hand's route against the lit holder first): rest the lei and its first slot. A lei that stood
 * before ends here (its word rests, its key dies): one hoʻāla lei stands at a time, and the later stringing supersedes.
 */
export async function hoalaString(records: SwarmWikiPort, by: KukuluSigner, device: HoalaDevice, at: {
  readonly returns: number; readonly closure: string; readonly image: string | null; readonly keys: KeeperKeys; readonly worn: number | null;
}): Promise<{ readonly lei: string; readonly returns: number; readonly faces: readonly number[]; readonly supersedes: string | null } | HoalaRefusal> {
  if (!device.seated()) return refuse("hoala-device-unseated", "this keeper mounts no device directory, so no device key rests and no hoʻāla lei strings; raise the keeper on an image and compose file that carry the device volume (`lares rite kukulu`), then string again");
  const before = await hoalaSlotRead(records);
  if (before !== null && (await records.read(hoalaUnstrungTitle(before.slot.body.lei))) === null) await hoalaUnstring(records, device, by, "superseded");
  else device.drop();
  const faces: AdmittedFace[] = at.keys.faces.map((f) => ({ fcid: f.fcid, ordinal: f.ordinal })).sort((x, y) => x.ordinal - y.ordinal);
  const strung = await signPulamaRecord<"hoala-strung">({ act: "hoala-strung", returns: at.returns, closure: at.closure, image: at.image, faces, nonce: randomUUID() }, by);
  const lei = pulamaRecordCid(strung);
  await records.write(hoalaLeiTitle(lei), JSON.stringify(strung));
  await sealSlot(records, by, device, { lei, returns: at.returns, n: 0, closure: at.closure, payload: { node: at.keys.treeKey, faces: at.keys.faces.map((f) => ({ fcid: f.fcid, ordinal: f.ordinal, fck: f.fck, spent: 0 })), spent: 0, worn: at.worn } });
  return { lei, returns: at.returns, faces: faces.map((f) => f.ordinal), supersedes: before?.slot.body.lei ?? null };
}

/**
 * OPEN (an unlit keeper, no route): read the slot against the closure the host reported and open it under the device key. Nothing
 * verifies a signature here (no key stands yet); `hoalaLand` does, once the node key seats. The caller zeroes the payload.
 */
export async function hoalaOpen(records: SwarmWikiPort, device: HoalaDevice, at: { readonly closure: string | null }): Promise<{ readonly slot: SignedSlot; readonly text: string; readonly payload: VestPayload } | HoalaRefusal> {
  const read = await hoalaSlotRead(records);
  if (read === null) {
    // NOTHING RESTS: the row names how the last lei ended (its returns spent, a hand's unstring), or no lei ever stood.
    const ended = await endedOf(records);
    if (ended === null) return refuse("hoala-lei-absent", `no hoʻāla lei stands at this keeper; ${HOALA_HAND_CURE}`);
    if (ended === "malformed") return refuse("hoala-slot-malformed", `the hoʻāla lei's slot reads as no slot; ${HOALA_HAND_CURE}`);
    if (ended.ended === "returns-spent") return refuse("hoala-returns-spent", `the hoʻāla lei${ended.lei !== null ? ` ${ended.lei}` : ""} spent each of its returns, and nothing rests; ${HOALA_HAND_CURE}`);
    if (ended.ended === "unstrung") return refuse("hoala-lei-unstrung", `the hoʻāla lei${ended.lei !== null ? ` ${ended.lei}` : ""} stands unstrung, and nothing rests; ${HOALA_HAND_CURE}`);
    return refuse("hoala-lei-absent", `no hoʻāla lei stands at this keeper (the last one ended: ${ended.ended}); ${HOALA_HAND_CURE}`);
  }
  const b = read.slot.body;
  if ((await records.read(hoalaUnstrungTitle(b.lei))) !== null) { await destroy(records, device, "unstrung", b.lei); return refuse("hoala-lei-unstrung", `the hoʻāla lei ${b.lei} stands unstrung; ${HOALA_HAND_CURE}`); }
  if (b.n >= b.returns) { await destroy(records, device, "returns-spent", b.lei); return refuse("hoala-returns-spent", `the hoʻāla lei ${b.lei} spent each of its ${b.returns} return(s); ${HOALA_HAND_CURE}`); }
  if (at.closure === null) return refuse("closure-unreported", "the host reported no closure for this keeper, so the hoʻāla lei cannot read whether the keeper it licensed stands here; `lares up` reports it, and the stand tries the lei again");
  if (at.closure !== b.closure) return refuse("hoala-closure-moved", `the hoʻāla lei licenses keeper closure ${b.closure}, and this keeper reports ${at.closure}: a keeper whose code moved takes the hand's light (the struck fire); ${HOALA_HAND_CURE}`);
  const secret = device.take(b.to);
  if (secret === null) return refuse("hoala-device-key-absent", `the hoʻāla lei's slot rests here, and this device holds no key that opens it (the device volume moved, or the house came from another machine); ${HOALA_HAND_CURE}`);
  let plain: Uint8Array | null;
  try { plain = openFromSender({ recipientSecret: secret, senderEphemeralPub: unhex(b.box.e), aeadNonce: unhex(b.box.n), ciphertext: unhex(b.box.c), info: HOALA_INFO, extraSalt: saltOf(b.lei, b.closure, b.n) }); } finally { secret.fill(0); }
  if (plain === null) return refuse("hoala-slot-unopened", `the hoʻāla lei's slot opens under no key this device holds; ${HOALA_HAND_CURE}`);
  let payload: VestPayload | null;
  try { payload = keeperPayloadUnpack(plain); } finally { plain.fill(0); }
  if (payload === null) return refuse("hoala-slot-unopened", `the hoʻāla lei's slot carries no payload this keeper reads; ${HOALA_HAND_CURE}`);
  return { slot: read.slot, text: read.text, payload };
}

/**
 * LAND (the node key seated, the faces adopted): verify the slot and its lei under the pūlama's key, CLAIM the return's receipt,
 * then move the slot to the next return (or destroy it at the last). A refusal here leaves the caller to lock the keeper; the
 * respent and unverified readings destroy what rests, since neither half can be trusted again.
 */
export async function hoalaLand(records: SwarmWikiPort, by: KukuluSigner, device: HoalaDevice, at: {
  readonly slot: SignedSlot; readonly text: string; readonly payload: VestPayload; readonly image: string | null; readonly lit: readonly AdmittedFace[];
}): Promise<{ readonly lei: string; readonly n: number; readonly of: number; readonly left: number; readonly receipt: string } | HoalaRefusal> {
  const b = at.slot.body;
  if (verifiedPulamaRecord(at.text, by.key) === null) { await destroy(records, device, "refused", b.lei); return refuse("hoala-slot-unsigned", `the hoʻāla lei's slot carries no signature of this house's keeper; it and its device key stand destroyed; ${HOALA_HAND_CURE}`); }
  const strung = verifiedPulamaRecord(await records.read(hoalaLeiTitle(b.lei)), by.key);
  if (strung === null || strung.body.act !== "hoala-strung" || pulamaRecordCid(strung) !== b.lei || strung.body.returns !== b.returns || strung.body.closure !== b.closure) {
    await destroy(records, device, "refused", b.lei);
    return refuse("hoala-lei-unverified", `no hoʻāla lei this house's keeper signed stands behind the slot; it and its device key stand destroyed; ${HOALA_HAND_CURE}`);
  }
  const n = b.n + 1;
  const receipt = await signPulamaRecord<"hoala-woke">({ act: "hoala-woke", lei: b.lei, n, of: b.returns, slot: pulamaRecordCid(at.slot), closure: b.closure, image: at.image, faces: [...at.lit], nonce: randomUUID() }, by);
  // THE RETURN CLAIMS BEFORE ANYTHING MOVES OR SERVES: a receipt already standing at this count means the slot came back from an older copy.
  if (!(await records.writeNew(hoalaReceiptTitle(b.lei, n), JSON.stringify(receipt)))) {
    await destroy(records, device, "refused", b.lei);
    return refuse("hoala-return-respent", `a receipt already rests for return ${n} of the hoʻāla lei ${b.lei}, so this slot came back from an older copy; it and its device key stand destroyed; ${HOALA_HAND_CURE}`);
  }
  if (n < b.returns) await sealSlot(records, by, device, { lei: b.lei, returns: b.returns, n, closure: b.closure, payload: at.payload });
  else await destroy(records, device, "returns-spent", b.lei);
  return { lei: b.lei, n, of: b.returns, left: b.returns - n, receipt: pulamaRecordCid(receipt) };
}

/**
 * UNSTRING (no route, lit or unlit): destroy the device key and the slot, and rest the unstring's word for the lei that stood.
 * Answers the lei it ended, or null where none stood (stray device keys die all the same).
 */
export async function hoalaUnstring(records: SwarmWikiPort, device: HoalaDevice, by: KukuluSigner | null, ended: "unstrung" | "superseded" = "unstrung"): Promise<{ readonly lei: string | null; readonly keys: number }> {
  const read = await hoalaSlotRead(records);
  const keys = device.drop();
  if (read === null) return { lei: null, keys };
  const lei = read.slot.body.lei;
  await records.write(hoalaSlotTitle(), JSON.stringify({ ended, lei }));
  const word = by !== null ? JSON.stringify(await signPulamaRecord<"hoala-unstrung">({ act: "hoala-unstrung", lei, nonce: randomUUID() }, by)) : JSON.stringify({ act: "hoala-unstrung", lei, unsigned: true });
  await records.writeNew(hoalaUnstrungTitle(lei), word);
  return { lei, keys };
}

export { keeperPayloadDrop as hoalaPayloadDrop };
