/**
 * ARCHIVE-ACROSS-VERSIONS PROBE — does the pinned keyhive open what `0.1.0-alpha.8` wrote?
 *
 * A keyhive Archive and a keyhive event carry NO format tag, so nothing but an attempt answers whether bytes
 * one build wrote open under another. `fixtures/alpha8-archive.fixture.json` holds bytes the PUBLISHED
 * `@keyhive/keyhive@0.1.0-alpha.8` minted (two throwaway probe identities, one document, one member, one sealed
 * chunk; `fixtures/mint-alpha8-archive.mjs` minted it and proved alpha.8 restores its own archive). This probe
 * offers each kind of at-rest byte to the pinned build and reports what it answers:
 *
 *   (A) the joinee's and the founder's Archive      → `new Archive(bytes)` then `tryToKeyhive`
 *   (E) the founder's public events for the joinee  → `ingestEventsBytes`
 *   (C) the sealed chunk                            → `Encrypted.fromBytes`
 *   (K) the joinee's contact card JSON              → `ContactCard.fromJson`
 *
 * CONTROL: an archive the pinned build mints itself, over the same scenario, restores and decrypts — so a
 * refusal in (A) reads as a format difference, never a probe that cannot restore anything.
 *
 * VERDICT: COMPATIBLE only when (A) restores BOTH identities and the restored joinee decrypts the chunk.
 * Exit 0 on COMPATIBLE, 2 on NOT COMPATIBLE, 1 when the probe itself faults (the control fails).
 *
 * Run: pnpm exec tsx packages/lararium-keyhive/probes/archive-across-versions.ts
 */
import { readFileSync } from "node:fs";
import * as KH from "@keyhive/keyhive";

interface Fixture {
  readonly mintedBy: string;
  readonly founderSeedFill: number; readonly joineeSeedFill: number;
  readonly founderId: string; readonly joineeId: string;
  readonly docIdHex: string; readonly plaintext: string;
  readonly encryptedB64: string; readonly joineeCardJson: string;
  readonly publicEventsB64: readonly string[];
  readonly founderArchiveB64: string; readonly joineeArchiveB64: string;
}

export interface ArchiveAcrossVersionsReading {
  readonly mintedBy: string;
  readonly control: "restores-and-decrypts";
  readonly archive: { readonly joinee: string; readonly founder: string };
  readonly events: string;
  readonly ciphertext: string;
  readonly contactCard: string;
  readonly compatible: boolean;
}

const seed = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (fill + i) & 0xff);
const unb64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));
const unhex = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "hex"));
const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
const why = (e: unknown): string => `REFUSED: ${String((e as Error)?.message ?? e).slice(0, 160)}`;
const fresh = (fill: number): Promise<KH.Keyhive> =>
  KH.Keyhive.init(KH.Signer.memorySignerFromBytes(seed(fill)), KH.CiphertextStore.newInMemory(), () => {});
const restore = (bytes: Uint8Array, fill: number): Promise<KH.Keyhive> =>
  new KH.Archive(bytes).tryToKeyhive(KH.CiphertextStore.newInMemory(), KH.Signer.memorySignerFromBytes(seed(fill)), () => {});

/** The fixture's scenario under the pinned build: mint, archive, restore, decrypt. Throws when any step fails. */
async function control(plaintext: string): Promise<void> {
  const founder = await fresh(1), joinee = await fresh(100);
  const joineeId = await founder.receiveContactCard(await joinee.contactCard());
  await joinee.receiveContactCard(await founder.contactCard());
  const docId = await founder.generateDocument([], new KH.ChangeId(seed(0)), []);
  await founder.addMember(joineeId.toIdentifier(), KH.MemberedId.document(docId), KH.Access.fromString("read"), []);
  const sealed = (await founder.tryEncrypt(docId, new KH.ChangeId(seed(50)), [], new TextEncoder().encode(plaintext)))
    .encryptedContent().toBytes();
  const agent = await founder.getAgent(joineeId.toIdentifier());
  if (!agent) throw new Error("control: the founder does not know the joinee it just admitted");
  await joinee.ingestEventsBytes([...(await founder.eventsForAgent(agent)).values()]);
  const back = await restore((await joinee.toArchive()).toBytes(), 100);
  const opened = new TextDecoder().decode(await back.tryDecrypt(new KH.DocumentId(docId.toBytes()), KH.Encrypted.fromBytes(sealed)));
  if (opened !== plaintext) throw new Error("control: the pinned build's own archive did not restore a decrypting identity");
}

export async function readArchiveAcrossVersions(fixturePath: string): Promise<ArchiveAcrossVersionsReading> {
  const fx = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
  await control(fx.plaintext);

  const offer = async (b64: string, fill: number, id: string, decrypt: boolean): Promise<string> => {
    try {
      const kh = await restore(unb64(b64), fill);
      if (hex(kh.whoami.toBytes()) !== id) return "RESTORED a different identity";
      if (!decrypt) return "RESTORED";
      const opened = await kh.tryDecrypt(new KH.DocumentId(unhex(fx.docIdHex)), KH.Encrypted.fromBytes(unb64(fx.encryptedB64)));
      return new TextDecoder().decode(opened) === fx.plaintext ? "RESTORED and decrypts" : "RESTORED, decrypts other bytes";
    } catch (e) { return why(e); }
  };
  const joinee = await offer(fx.joineeArchiveB64, fx.joineeSeedFill, fx.joineeId, true);
  const founder = await offer(fx.founderArchiveB64, fx.founderSeedFill, fx.founderId, false);

  let events: string;
  try {
    const pending = await (await fresh(7)).ingestEventsBytes(fx.publicEventsB64.map(unb64));
    events = `INGESTED ${fx.publicEventsB64.length} event(s), ${pending.length} left pending`;
  } catch (e) { events = why(e); }

  let ciphertext: string;
  try { KH.Encrypted.fromBytes(unb64(fx.encryptedB64)); ciphertext = "PARSES"; } catch (e) { ciphertext = why(e); }
  let contactCard: string;
  try { KH.ContactCard.fromJson(fx.joineeCardJson); contactCard = "PARSES"; } catch (e) { contactCard = why(e); }

  return {
    mintedBy: fx.mintedBy, control: "restores-and-decrypts",
    archive: { joinee, founder }, events, ciphertext, contactCard,
    compatible: joinee === "RESTORED and decrypts" && founder === "RESTORED",
  };
}

export const ALPHA8_ARCHIVE_FIXTURE = new URL("./fixtures/alpha8-archive.fixture.json", import.meta.url).pathname;

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) {
  readArchiveAcrossVersions(ALPHA8_ARCHIVE_FIXTURE).then((r) => {
    console.log(`[probe] fixture minted by ${r.mintedBy}`);
    console.log(`[probe] CONTROL (the pinned build's own archive): ${r.control}`);
    console.log(`[probe] (A) joinee archive : ${r.archive.joinee}`);
    console.log(`[probe] (A) founder archive: ${r.archive.founder}`);
    console.log(`[probe] (E) events         : ${r.events}`);
    console.log(`[probe] (C) sealed chunk   : ${r.ciphertext}`);
    console.log(`[probe] (K) contact card   : ${r.contactCard}`);
    console.log(`[probe] VERDICT: ${r.compatible ? "COMPATIBLE" : "NOT COMPATIBLE"} — the pinned keyhive ${r.compatible ? "opens" : "does not open"} an archive ${r.mintedBy} wrote.`);
    process.exit(r.compatible ? 0 : 2);
  }).catch((e) => { console.error("[probe] FATAL:", e); process.exit(1); });
}
