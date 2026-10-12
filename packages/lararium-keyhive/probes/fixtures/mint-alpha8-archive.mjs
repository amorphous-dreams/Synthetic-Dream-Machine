// mint-alpha8-archive — mints `alpha8-archive.fixture.json` from the PUBLISHED @keyhive/keyhive@0.1.0-alpha.8.
//
// The fixture holds what that version writes at rest for one small scenario (two throwaway probe identities,
// one document, one read member, one sealed chunk): both archives, the founder's public events for the joinee,
// the sealed chunk and the joinee's contact card. `archive-across-versions.ts` offers those bytes to the pinned
// keyhive. The script proves, before it writes, that alpha.8 restores its own archive and decrypts the chunk.
//
// Run (the package never enters the workspace; fetch it into a scratch dir with a scratch npm cache):
//   cd "$(mktemp -d)" && npm_config_cache="$PWD/.npm-cache" npm pack @keyhive/keyhive@0.1.0-alpha.8
//   mkdir kh && tar xzf keyhive-keyhive-0.1.0-alpha.8.tgz -C kh
//   node <repo>/packages/lararium-keyhive/probes/fixtures/mint-alpha8-archive.mjs "$PWD/kh/package" <out.json>
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const pkgDir = process.argv[2], out = process.argv[3];
const require = createRequire(import.meta.url);
let KH;
try { KH = await import(pkgDir + "/pkg-node/keyhive_wasm.js"); } catch (e) { KH = require(pkgDir + "/pkg-node/keyhive_wasm.js"); }
KH = KH.default && KH.default.Keyhive ? KH.default : KH;
const fill = (f) => Uint8Array.from({ length: 32 }, (_, i) => (f + i) & 0xff);
const b64 = (u) => Buffer.from(u).toString("base64");
const hex = (u) => Buffer.from(u).toString("hex");
const PLAINTEXT = "alpha8-archive-fixture — a chunk sealed under 0.1.0-alpha.8";
const mk = (f) => KH.Keyhive.init(KH.Signer.memorySignerFromBytes(fill(f)), KH.CiphertextStore.newInMemory(), () => {});
const founder = await mk(1), joinee = await mk(100);
const card = await joinee.contactCard();
const indiv = await founder.receiveContactCard(card);
await joinee.receiveContactCard(await founder.contactCard());
const doc = await founder.generateDocument([], new KH.ChangeId(fill(0)), []);
const agent = await founder.getAgent(indiv.id);
await founder.addMember(agent, doc.toMembered(), KH.Access.tryFromString("read"), []);
const enc = (await founder.tryEncrypt(doc, new KH.ChangeId(fill(50)), [], new TextEncoder().encode(PLAINTEXT))).encrypted_content().serialize();
const pub = [...(await founder.eventsForAgent(agent)).values()];
await joinee.ingestEventsBytes(pub);
const live = new TextDecoder().decode(await joinee.tryDecrypt(await joinee.getDocument(new KH.DocumentId(doc.doc_id.toBytes())), KH.Encrypted.fromBytes(enc)));
if (live !== PLAINTEXT) throw new Error("alpha.8 live decrypt failed: " + live);
const arch = (k) => (k.toArchive ? k.toArchive() : k.intoArchive());
const fixture = {
  mintedBy: "@keyhive/keyhive@0.1.0-alpha.8",
  note: "Throwaway probe identities (seed byte i = fill+i; founder fill 1, joinee fill 100). The archive bytes carry those identities' prekey secrets and nothing else of worth.",
  founderSeedFill: 1, joineeSeedFill: 100,
  founderId: hex(founder.whoami.bytes), joineeId: hex(joinee.whoami.bytes),
  docIdHex: hex(doc.doc_id.toBytes()),
  plaintext: PLAINTEXT,
  encryptedB64: b64(enc),
  joineeCardJson: card.toJson(),
  publicEventsB64: pub.map(b64),
  founderArchiveB64: b64((await arch(founder)).toBytes()),
  joineeArchiveB64: b64((await arch(joinee)).toBytes()),
};
// alpha.8 self-control: its own archive restores and decrypts under alpha.8.
const back = await new KH.Archive(Buffer.from(fixture.joineeArchiveB64, "base64")).tryToKeyhive(KH.CiphertextStore.newInMemory(), KH.Signer.memorySignerFromBytes(fill(100)), () => {});
const again = new TextDecoder().decode(await back.tryDecrypt(await back.getDocument(new KH.DocumentId(doc.doc_id.toBytes())), KH.Encrypted.fromBytes(enc)));
if (again !== PLAINTEXT) throw new Error("alpha.8 archive self-restore failed");
writeFileSync(out, JSON.stringify(fixture, null, 2) + "\n");
console.log("minted", out, "archive bytes:", Buffer.from(fixture.joineeArchiveB64, "base64").length, "control: alpha.8 self-restore decrypts OK");
