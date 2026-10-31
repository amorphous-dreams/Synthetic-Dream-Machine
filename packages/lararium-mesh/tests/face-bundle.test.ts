/**
 * face-bundle — one face's backup bundle as bytes: a format mark, a slot tree over the routes a person holds,
 * and one sealed body under a key drawn for that bundle alone.
 *
 * The vectors pin what the law promises of the bytes: any one route opens the bundle; one altered bit of the
 * body opens for nobody; another bundle's key opens nothing; two bundles of one body share no key, salt, nonce
 * or identifier; a holder with no route reads the residue and nothing more; the body's shape gives a veil
 * key, a vessel key or a seat no home; and it carries the face's enrolled recovery contact set, or null, and nothing beside.
 *
 * Synthetic names and keys. Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-bundle
 */
import { describe, expect, it, vi } from "vitest";
import { canonicalJsonBytes, hex, utf8Bytes } from "../src/crypto.js";
import { FACE_BUNDLE_BODY_INFO, FACE_BUNDLE_DOMAIN } from "../src/domains.js";
import {
  bindBundleRoutes, bundleMemoryKeypair, encodeFaceBundle, faceBundleBodyBytes, faceBundleMark, faceBundleResidue,
  mintBundleKey, openBundleKey, openFaceBundleBody, readFaceBundle, readFaceBundleBody, sealFaceBundleBody,
  type FaceBundleBody,
} from "../src/face-bundle.js";
import { confirmPaperPin, draftPaperPin, bindSlot, openTreeKey, type SlotSpec } from "../src/keyslot.js";
import { openMemorySection, sealMemorySection } from "../src/memory-section.js";
import { mintPersonaInception } from "../src/persona-kel.js";
import { mintTreeKey } from "../src/tree-key.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { ed25519 } from "@noble/curves/ed25519.js";

// Every bind and every open runs a slot's own key derivation, priced to cost a guesser; the suite waits it out.
vi.setConfig({ testTimeout: 120_000 });

const PASS = { kind: "passphrase", passphrase: "a bundle route for a test" } as const;
const WRONG = { kind: "passphrase", passphrase: "another route entirely" } as const;
const KEY = Uint8Array.from({ length: 32 }, (_, i) => 0x40 ^ i);
const ROOT_SEED = "5e".repeat(32);
const ROOT_KEY = hex(ed25519.getPublicKey(Uint8Array.from({ length: 32 }, () => 0x5e)));

function paperRoute(): { spec: SlotSpec; sheets: readonly string[] } {
  const draft = draftPaperPin({ threshold: 1, count: 1 });
  return { spec: { t: 1, pins: [{ kind: "paper", confirmed: confirmPaperPin(draft, draft.sheets) }] }, sheets: draft.sheets };
}
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");

function bodyFor(bundleKey: Uint8Array): FaceBundleBody {
  const section = sealMemorySection(
    [{ bagId: "lar:///ha.ka.ba/@test/bags/garden-notes", locator: "11".repeat(32), keyVersion: "22".repeat(32), key: KEY }],
    bundleMemoryKeypair(bundleKey).public,
  );
  return {
    root: { signingKey: ROOT_SEED, verifyingKey: ROOT_KEY },
    rosterLine: { handleIndex: 2, verifyingKey: ROOT_KEY },
    anchors: { signerDid: "0xsigner-test", personaKelPrefix: "E-test-prefix" },
    kel: [mintPersonaInception(`0x${ROOT_KEY}`, "ab".repeat(32))],
    names: { petname: "the gardener" },
    faceProofKeys: [{ scope: "0f".repeat(16), secret: "c3".repeat(32) }],
    handleBook: { records: [{ nym: "nym-test", card: null, heads: [], accepted: [], petname: "a friend", recognisedBy: [{ face: ROOT_KEY, petname: "a friend" }] }] },
    recoveryContactSet: {
      recoveryContactSetHash: "9a".repeat(32), threshold: 1,
      recoveryContacts: [{ slot: "contact-a", label: "Recovery-contact-A (unassigned)", recoveryPubKey: "7b".repeat(32), confirmPhrase: "" }],
    },
    memory: { section: b64(section), holds: [{ bagId: "lar:///ha.ka.ba/@test/bags/garden-notes", founding: "11".repeat(32), keyVersion: "22".repeat(32) }] },
  };
}
/** One whole cut: a fresh key, two routes, the body sealed and framed. */
function cut() {
  const bundleKey = mintBundleKey();
  const paper = paperRoute();
  const tree = bindBundleRoutes(bundleKey, [{ t: 1, pins: [PASS] }, paper.spec]);
  const body = bodyFor(bundleKey);
  const bytes = encodeFaceBundle(tree, sealFaceBundleBody(faceBundleBodyBytes(body), bundleKey));
  return { bundleKey, tree, body, bytes, sheets: paper.sheets };
}

describe("a bundle opens under any one route a person bound", () => {
  it("CONTROL: the passphrase and the paper sheet each open the one bundle key, and the body reads back whole", () => {
    const made = cut();
    const read = readFaceBundle(made.bytes);
    expect(read.reading).toBe("readable");
    if (read.reading !== "readable") return;
    for (const credential of [PASS, { kind: "paper", sheets: made.sheets } as const]) {
      const opened = openBundleKey(read.tree, [credential]);
      expect(opened.reading).toBe("opens");
      if (opened.reading !== "opens") continue;
      expect(hex(opened.bundleKey)).toBe(hex(made.bundleKey));
      const plain = openFaceBundleBody(read.sealedBody, opened.bundleKey);
      expect(plain).not.toBeNull();
      expect(readFaceBundleBody(plain!)).toEqual(JSON.parse(JSON.stringify(made.body)));
    }
  });

  it("a route that opens no slot reads `no-slot-opens`, apart from a malformed file", () => {
    const made = cut();
    const read = readFaceBundle(made.bytes);
    expect(read.reading === "readable" && openBundleKey(read.tree, [WRONG]).reading).toBe("no-slot-opens");
  });

  it("the format mark reads as the first eight bytes of SHA-256 over the format's name, and leads the file", () => {
    const made = cut();
    expect(hex(faceBundleMark())).toBe(hex(sha256(utf8Bytes(FACE_BUNDLE_DOMAIN)).slice(0, 8)));
    expect(hex(made.bytes.subarray(0, 8))).toBe(hex(faceBundleMark()));
  });
});

describe("authenticated encryption covers the whole inner body", () => {
  it("one altered bit anywhere in the sealed body opens for nobody", () => {
    const made = cut();
    const read = readFaceBundle(made.bytes);
    if (read.reading !== "readable") throw new Error("setup");
    const whole = openFaceBundleBody(read.sealedBody, made.bundleKey);
    expect(whole).not.toBeNull();
    // The nonce, the first ciphertext byte, a middle byte, and the tag's last byte.
    for (const at of [0, 24, 24 + Math.floor((read.sealedBody.length - 24) / 2), read.sealedBody.length - 1]) {
      const bent = Uint8Array.from(read.sealedBody);
      bent[at] = bent[at]! ^ 0x01;
      // THE ENCODING MOVED: the probe changed the bytes it hands in.
      expect(hex(bent)).not.toBe(hex(read.sealedBody));
      expect(openFaceBundleBody(bent, made.bundleKey)).toBeNull();
    }
  });

  it("another bundle's key opens nothing, and a body moved under another bundle's tree opens for nobody", () => {
    const a = cut();
    const b = cut();
    const readA = readFaceBundle(a.bytes);
    const readB = readFaceBundle(b.bytes);
    if (readA.reading !== "readable" || readB.reading !== "readable") throw new Error("setup");
    expect(openFaceBundleBody(readA.sealedBody, b.bundleKey)).toBeNull();
    // A second key's write: bundle B's tree framed over bundle A's body opens B's key and never A's body.
    const spliced = readFaceBundle(encodeFaceBundle(readB.tree, readA.sealedBody));
    if (spliced.reading !== "readable") throw new Error("setup");
    const opened = openBundleKey(spliced.tree, [PASS]);
    expect(opened.reading).toBe("opens");
    expect(opened.reading === "opens" && openFaceBundleBody(spliced.sealedBody, opened.bundleKey)).toBeNull();
  });

  it("the body key and the memory pair's secret half each differ from the bundle key and from one another", () => {
    const made = cut();
    const pair = bundleMemoryKeypair(made.bundleKey);
    expect(hex(pair.secret)).not.toBe(hex(made.bundleKey));
    // The body does not open under the pair's secret half, nor the section under the bundle key itself.
    const read = readFaceBundle(made.bytes);
    if (read.reading !== "readable") throw new Error("setup");
    expect(openFaceBundleBody(read.sealedBody, pair.secret)).toBeNull();
    const section = Uint8Array.from(Buffer.from(made.body.memory.section, "base64"));
    expect(openMemorySection(section, made.bundleKey)).toBeNull();
    // CONTROL: the pair the bundle key derives opens the section, and the same key derives the same pair.
    const entries = openMemorySection(section, bundleMemoryKeypair(made.bundleKey).secret);
    expect(entries).toHaveLength(1);
    expect(hex(entries![0]!.key)).toBe(hex(KEY));
  });
});

describe("the format mark rides the body's seal as associated data", () => {
  // An INDEPENDENT hand of the same construction: the cipher and the key derivation spelled here, apart from the
  // module's own seal and open. A seal and an open that both dropped the mark would still open each other; neither
  // opens, nor gets opened by, this hand.
  const bodyKey = (bundleKey: Uint8Array): Uint8Array => hkdf(sha256, bundleKey, faceBundleMark(), utf8Bytes(FACE_BUNDLE_BODY_INFO), 32);
  const plain = utf8Bytes("a body's bytes, whatever they hold");

  it("RED: a body the module sealed opens under the mark by an independent hand, and under no other associated data", () => {
    const bundleKey = mintBundleKey();
    const sealed = sealFaceBundleBody(plain, bundleKey);
    const nonce = sealed.subarray(0, 24), ciphertext = sealed.subarray(24);
    expect(hex(xchacha20poly1305(bodyKey(bundleKey), nonce, faceBundleMark()).decrypt(ciphertext))).toBe(hex(plain));
    expect(() => xchacha20poly1305(bodyKey(bundleKey), nonce).decrypt(ciphertext)).toThrow();
    expect(() => xchacha20poly1305(bodyKey(bundleKey), nonce, utf8Bytes("another format")).decrypt(ciphertext)).toThrow();
  });

  it("RED: the module opens a body an independent hand sealed under the mark, and refuses the same body sealed under none or another", () => {
    const bundleKey = mintBundleKey();
    const nonce = Uint8Array.from({ length: 24 }, (_, i) => i + 1);
    const sealedWith = (aad?: Uint8Array): Uint8Array => {
      const ciphertext = (aad ? xchacha20poly1305(bodyKey(bundleKey), nonce, aad) : xchacha20poly1305(bodyKey(bundleKey), nonce)).encrypt(plain);
      const out = new Uint8Array(24 + ciphertext.length);
      out.set(nonce, 0);
      out.set(ciphertext, 24);
      return out;
    };
    // CONTROL: the independent hand builds what the module reads.
    expect(hex(openFaceBundleBody(sealedWith(faceBundleMark()), bundleKey) ?? new Uint8Array())).toBe(hex(plain));
    // THE ENCODING MOVED: each probe hands in other bytes than the control.
    expect(hex(sealedWith())).not.toBe(hex(sealedWith(faceBundleMark())));
    expect(openFaceBundleBody(sealedWith(), bundleKey)).toBeNull();
    expect(openFaceBundleBody(sealedWith(utf8Bytes("another format")), bundleKey)).toBeNull();
  });
});

describe("a malformed file names itself, apart from a route that opens nothing", () => {
  it.each([
    ["no format mark", (bytes: Uint8Array) => { const out = Uint8Array.from(bytes); out[0] = out[0]! ^ 0xff; return out; }],
    ["a file that ends inside its frame", (bytes: Uint8Array) => bytes.slice(0, 10)],
    ["a tree length that runs past the file", (bytes: Uint8Array) => { const out = Uint8Array.from(bytes); new DataView(out.buffer).setUint32(8, out.length, false); return out; }],
    ["a slot tree that reads torn", (bytes: Uint8Array) => { const out = Uint8Array.from(bytes); out[12] = 0x00; return out; }],
    ["an empty file", () => new Uint8Array(0)],
  ])("%s reads `bundle-malformed`", (_name, bend) => {
    const made = cut();
    expect(readFaceBundle(made.bytes).reading).toBe("readable");
    expect(readFaceBundle(bend(made.bytes)).reading).toBe("bundle-malformed");
  });
});

describe("two bundles share nothing, and a holder with no route reads the residue alone", () => {
  it("two cuts of one face share no key, salt, nonce, slot id or check", () => {
    const a = cut();
    const b = cut();
    expect(hex(a.bundleKey)).not.toBe(hex(b.bundleKey));
    expect(a.tree.keyCheck).not.toBe(b.tree.keyCheck);
    const fields = (made: ReturnType<typeof cut>): string[] => {
      const read = readFaceBundle(made.bytes);
      if (read.reading !== "readable") throw new Error("setup");
      return [
        read.tree.keyCheck, hex(read.sealedBody.subarray(0, 24)),
        ...read.tree.slots.flatMap((s) => [s.id, s.nonce, s.wrappedKey, ...s.pins.flatMap((p) => [p.nonce, p.wrapped, ...(p.kind === "passphrase" ? [p.salt] : [])])]),
      ];
    };
    const inA = new Set(fields(a));
    // CONTROL: the field hunt finds a bundle's own fields.
    expect(inA.size).toBeGreaterThan(8);
    expect(fields(b).filter((f) => inA.has(f))).toEqual([]);
    // Past the eight-byte mark and the tree's JSON punctuation, no 12-byte run of the sealed body repeats.
    const readA = readFaceBundle(a.bytes);
    const readB = readFaceBundle(b.bytes);
    if (readA.reading !== "readable" || readB.reading !== "readable") throw new Error("setup");
    const runs = new Set<string>();
    for (let i = 0; i + 12 <= readA.sealedBody.length; i++) runs.add(hex(readA.sealedBody.subarray(i, i + 12)));
    let shared = 0;
    for (let i = 0; i + 12 <= readB.sealedBody.length; i++) if (runs.has(hex(readB.sealedBody.subarray(i, i + 12)))) shared++;
    expect(shared).toBe(0);
  });

  it("the residue names the length, each slot's pin kinds and its threshold, and no word of the body", () => {
    const made = cut();
    const residue = faceBundleResidue(made.bytes);
    expect(residue).toEqual({ length: made.bytes.length, slots: [{ t: 1, pins: ["passphrase"] }, { t: 1, pins: ["paper"] }] });
    const text = Buffer.from(made.bytes).toString("latin1");
    for (const word of ["garden-notes", "the gardener", ROOT_SEED, ROOT_KEY, "nym-test", "E-test-prefix", "0xsigner-test"]) expect(text.includes(word)).toBe(false);
    // CONTROL: the opened body does carry those words.
    const plain = Buffer.from(faceBundleBodyBytes(made.body)).toString("latin1");
    for (const word of ["garden-notes", "the gardener", ROOT_SEED]) expect(plain.includes(word)).toBe(true);
  });

  it("a slot lifted from a bundle's tree into a vessel's tree opens nothing there", () => {
    const made = cut();
    const vessel = bindSlot(null, mintTreeKey(), { t: 1, pins: [{ kind: "passphrase", passphrase: "the vessel's own route" }] });
    const grafted = { keyCheck: vessel.keyCheck, slots: [...vessel.slots, made.tree.slots[0]!] };
    expect(openTreeKey(grafted, [PASS]).reading).toBe("no-slot-opens");
  });
});

describe("the body's shape gives a seat key no home", () => {
  const whole = (): Record<string, unknown> => JSON.parse(JSON.stringify(bodyFor(mintBundleKey()))) as Record<string, unknown>;

  it("CONTROL: a whole body reads back, in one spelling alone", () => {
    const body = whole();
    expect(readFaceBundleBody(canonicalJsonBytes(body))).not.toBeNull();
    // The same body spelled with other spacing reads as no body.
    expect(readFaceBundleBody(utf8Bytes(JSON.stringify(body, null, 1)))).toBeNull();
  });

  it.each([
    ["a veil key beside the root", (b: Record<string, unknown>) => { b["veilKey"] = "aa".repeat(32); }],
    ["a veil archive", (b: Record<string, unknown>) => { b["veilArchive"] = "AAAA"; }],
    ["a vessel face key", (b: Record<string, unknown>) => { b["vesselFaceKey"] = { scope: "0f".repeat(16), secret: "aa".repeat(32) }; }],
    ["a seat claim inside the names", (b: Record<string, unknown>) => { (b["names"] as Record<string, unknown>)["seat"] = true; }],
    ["a chair label inside the names", (b: Record<string, unknown>) => { (b["names"] as Record<string, unknown>)["chair"] = "north"; }],
    ["a veil tag inside the anchors", (b: Record<string, unknown>) => { (b["anchors"] as Record<string, unknown>)["veilTag"] = "tag"; }],
    ["a device edge inside the anchors", (b: Record<string, unknown>) => { (b["anchors"] as Record<string, unknown>)["deviceEdge"] = {}; }],
    ["a key group id inside the anchors", (b: Record<string, unknown>) => { (b["anchors"] as Record<string, unknown>)["personaGroupId"] = "ab"; }],
    ["a second face's root", (b: Record<string, unknown>) => { b["roots"] = [b["root"]]; }],
    ["a bare key inside a holding", (b: Record<string, unknown>) => { ((b["memory"] as { holds: Record<string, unknown>[] }).holds[0]!)["key"] = "aa".repeat(32); }],
    ["a root seed of another width", (b: Record<string, unknown>) => { (b["root"] as Record<string, unknown>)["signingKey"] = "aa".repeat(31); }],
    ["a proof key scope named twice", (b: Record<string, unknown>) => { (b["faceProofKeys"] as unknown[]).push((b["faceProofKeys"] as unknown[])[0]); }],
    ["a key event that reads torn", (b: Record<string, unknown>) => { (b["kel"] as Record<string, unknown>[])[0]!["seq"] = -1; }],
    ["no memory part", (b: Record<string, unknown>) => { delete b["memory"]; }],
    ["a handle-book record with a part the shape does not name", (b: Record<string, unknown>) => { ((b["handleBook"] as { records: Record<string, unknown>[] }).records[0]!)["veilKey"] = "aa".repeat(32); }],
    ["a handle-book record tagged by two faces", (b: Record<string, unknown>) => { ((b["handleBook"] as { records: Record<string, unknown>[] }).records[0]!)["recognisedBy"] = [{ face: "a1".repeat(32), petname: null }, { face: "b2".repeat(32), petname: "other" }]; }],
    ["a handle-book record whose tag carries a stray part", (b: Record<string, unknown>) => { ((b["handleBook"] as { records: Record<string, unknown>[] }).records[0]!)["recognisedBy"] = [{ face: "a1".repeat(32), petname: null, seat: true }]; }],
    ["no recovery-contact-set part", (b: Record<string, unknown>) => { delete b["recoveryContactSet"]; }],
    ["a recovery contact set with a part the shape does not name", (b: Record<string, unknown>) => { (b["recoveryContactSet"] as Record<string, unknown>)["seat"] = true; }],
    ["a recovery contact set whose threshold no quorum meets", (b: Record<string, unknown>) => { (b["recoveryContactSet"] as Record<string, unknown>)["threshold"] = 2; }],
    ["a recovery contact set with no recovery contact", (b: Record<string, unknown>) => { (b["recoveryContactSet"] as Record<string, unknown>)["recoveryContacts"] = []; }],
    ["a recovery contact registration carrying a secret beside its public key", (b: Record<string, unknown>) => { ((b["recoveryContactSet"] as { recoveryContacts: Record<string, unknown>[] }).recoveryContacts[0]!)["seed"] = "aa".repeat(32); }],
    ["a recovery contact registration under a slot no card names", (b: Record<string, unknown>) => { ((b["recoveryContactSet"] as { recoveryContacts: Record<string, unknown>[] }).recoveryContacts[0]!)["slot"] = "recovery-contact-z"; }],
    ["a handle-book record with no cards list", (b: Record<string, unknown>) => { delete ((b["handleBook"] as { records: Record<string, unknown>[] }).records[0]!)["accepted"]; }],
  ])("%s refuses the body", (_name, bend) => {
    const body = whole();
    bend(body);
    expect(readFaceBundleBody(canonicalJsonBytes(body))).toBeNull();
  });

  it("CONTROL: a body whose log commits no recovery contact set carries null there, and reads back", () => {
    const body = whole();
    body["recoveryContactSet"] = null;
    expect(readFaceBundleBody(canonicalJsonBytes(body))?.recoveryContactSet).toBeNull();
  });

  it("the sealer refuses a body that reads as no body, and seals nothing", () => {
    const body = { ...bodyFor(mintBundleKey()), veilKey: "aa".repeat(32) } as unknown as FaceBundleBody;
    expect(() => faceBundleBodyBytes(body)).toThrow(/no bundle body/);
  });
});
