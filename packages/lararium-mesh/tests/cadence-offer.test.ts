/**
 * cadence-offer — the engine cadence's offer lineage: `prev`-linked offers signed by t of the inception's holders,
 * release-denies under the same threshold, and the one window fold a device's gate reads. The offer and deny
 * shapes stand as the subject, field by field, beside the cadence inception's own suite.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { cidV1Sha256, hex } from "../src/crypto.js";
import {
  cadenceInceptionBytes, cadenceInceptionDigest, cadenceInceptionImage, cadenceNextDigest,
  type CadenceInception,
} from "../src/cadence-lineage.js";
import {
  cadenceOfferBody, cadenceOfferBytes, cadenceOfferDigest, cadenceReleaseDenyBody, cadenceReleaseDenyBytes,
  engineWindow, readCadenceOffer, readCadenceReleaseDeny, verifyCadenceOffer, verifyCadenceReleaseDeny,
  type CadenceOfferBody, type CadenceReleaseDenyBody, type SignedCadenceOffer, type SignedCadenceReleaseDeny,
} from "../src/cadence-offer.js";

const seedOf = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const keyOf = async (n: number): Promise<string> => hex(await ed.getPublicKeyAsync(seedOf(n)));
const holder = async (n: number) => ({ key: await keyOf(n), next: cadenceNextDigest(await keyOf(n + 1)) });
const signOf = async (n: number, bytes: Uint8Array) => ({ signer: await keyOf(n), sig: hex(await ed.signAsync(bytes, seedOf(n))) });
const engineOf = (name: string): string => cidV1Sha256(new TextEncoder().encode(`engine:${name}`));

/** Three hearths under t = 2: seeds 101, 111, 121. */
async function inceptionOf(seeds: readonly number[], t: number): Promise<CadenceInception> {
  const image = cadenceInceptionImage(await Promise.all(seeds.map(holder)), t);
  const bytes = cadenceInceptionBytes(image);
  return { image, signatures: await Promise.all(seeds.map((s) => signOf(s, bytes))) };
}
const signOffer = async (body: CadenceOfferBody, seeds: readonly number[]): Promise<SignedCadenceOffer> =>
  ({ body, signatures: await Promise.all(seeds.map((s) => signOf(s, cadenceOfferBytes(body)))) });
const signDeny = async (body: CadenceReleaseDenyBody, seeds: readonly number[]): Promise<SignedCadenceReleaseDeny> =>
  ({ body, signatures: await Promise.all(seeds.map((s) => signOf(s, cadenceReleaseDenyBytes(body)))) });

/** A chain of offers, one engine each, every offer naming `k`; returns the offers in order and the head digest. */
async function chainOf(inception: CadenceInception, engines: readonly string[], k: number, seeds: readonly number[]) {
  const at = cadenceInceptionDigest(inception.image);
  const offers: SignedCadenceOffer[] = [];
  let prev: string | null = null;
  for (const e of engines) {
    const body = cadenceOfferBody({ inception: at, prev, engine: engineOf(e), k });
    offers.push(await signOffer(body, seeds));
    prev = cadenceOfferDigest(body);
  }
  return { offers, head: prev as string };
}

const SEEDS = [101, 111, 121] as const;

describe("the cadence offer", () => {
  test("one body {kind, inception, prev, engine, k}; it reads back whole and its digest names its bytes", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const at = cadenceInceptionDigest(inception.image);
    const body = cadenceOfferBody({ inception: at, prev: null, engine: engineOf("a"), k: 2 });
    expect(Object.keys(body).sort()).toEqual(["engine", "inception", "k", "kind", "prev"]);
    expect(readCadenceOffer(JSON.parse(JSON.stringify(await signOffer(body, [101, 111]))))?.body).toEqual(body);
    expect(cadenceOfferDigest(body)).toMatch(/^[0-9a-f]{64}$/);
    // CONTROL: another k moves the digest.
    expect(cadenceOfferDigest(cadenceOfferBody({ inception: at, prev: null, engine: engineOf("a"), k: 3 }))).not.toBe(cadenceOfferDigest(body));
  });

  test("the reader refuses every other shape", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const at = cadenceInceptionDigest(inception.image);
    const body = cadenceOfferBody({ inception: at, prev: null, engine: engineOf("a"), k: 2 });
    const bad: unknown[] = [
      { ...body, extra: 1 }, { ...body, kind: "cadence-inception" }, { ...body, k: -1 }, { ...body, k: 1.5 },
      { ...body, engine: "not-a-cid" }, { ...body, prev: "abc" }, { ...body, inception: at.toUpperCase() },
    ];
    for (const b of bad) expect(readCadenceOffer({ body: b, signatures: [] }), JSON.stringify(b)).toBeNull();
    expect(() => cadenceOfferBody({ inception: at, prev: null, engine: "x", k: 2 })).toThrow(/cadence-offer-malformed/);
  });

  test("t of the inception's holders sign it: under-threshold, foreign, doubled or forged signatures refuse", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const body = cadenceOfferBody({ inception: cadenceInceptionDigest(inception.image), prev: null, engine: engineOf("a"), k: 2 });
    const bytes = cadenceOfferBytes(body);
    const [s1, s2] = [await signOf(101, bytes), await signOf(111, bytes)];
    expect(verifyCadenceOffer(inception, { body, signatures: [s1, s2] })).toBeNull();
    expect(verifyCadenceOffer(inception, { body, signatures: [s1] })).toBe("cadence-offer-unsigned");
    expect(verifyCadenceOffer(inception, { body, signatures: [] })).toBe("cadence-offer-unsigned");
    expect(verifyCadenceOffer(inception, { body, signatures: [s1, s1] })).toBe("cadence-offer-foreign-signer");
    expect(verifyCadenceOffer(inception, { body, signatures: [s1, await signOf(131, bytes)] })).toBe("cadence-offer-foreign-signer");
    const other = cadenceOfferBody({ ...body, k: 5 });
    expect(verifyCadenceOffer(inception, { body, signatures: [s1, await signOf(111, cadenceOfferBytes(other))] })).toBe("cadence-offer-unsigned");
  });

  test("an offer naming another inception refuses", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const foreign = await inceptionOf([141, 151], 1);
    const body = cadenceOfferBody({ inception: cadenceInceptionDigest(foreign.image), prev: null, engine: engineOf("a"), k: 2 });
    expect(verifyCadenceOffer(inception, await signOffer(body, [101, 111]))).toBe("cadence-offer-foreign-inception");
  });
});

describe("the release-deny", () => {
  test("one body {kind, inception, prev, engine} under the same t of holders; it never verifies as an offer", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const at = cadenceInceptionDigest(inception.image);
    const body = cadenceReleaseDenyBody({ inception: at, prev: null, engine: engineOf("a") });
    expect(Object.keys(body).sort()).toEqual(["engine", "inception", "kind", "prev"]);
    const deny = await signDeny(body, [101, 111]);
    expect(readCadenceReleaseDeny(JSON.parse(JSON.stringify(deny)))?.body).toEqual(body);
    expect(verifyCadenceReleaseDeny(inception, deny)).toBeNull();
    expect(verifyCadenceReleaseDeny(inception, await signDeny(body, [101]))).toBe("cadence-release-deny-unsigned");
    // Domain separation: the deny's bytes never read as an offer's, and an offer never reads as a deny.
    expect(readCadenceOffer(deny)).toBeNull();
    const offer = await signOffer(cadenceOfferBody({ inception: at, prev: null, engine: engineOf("a"), k: 1 }), [101, 111]);
    expect(readCadenceReleaseDeny(offer)).toBeNull();
  });
});

describe("the engine window", () => {
  test("a chain of four offers under k = 2 holds the engines within two hops of the head", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const { offers, head } = await chainOf(inception, ["a", "b", "c", "d"], 2, [101, 111]);
    const window = engineWindow(inception, offers, [], head);
    expect(window).toEqual({ ok: true, engines: [engineOf("d"), engineOf("c"), engineOf("b")] });
    // The order of the offers handed in moves nothing.
    expect(engineWindow(inception, [...offers].reverse(), [], head)).toEqual(window);
    // CONTROL: the head one hop back reads its own window.
    expect(engineWindow(inception, offers, [], cadenceOfferDigest(offers[2]!.body)))
      .toEqual({ ok: true, engines: [engineOf("c"), engineOf("b"), engineOf("a")] });
  });

  test("k rides the head offer", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const at = cadenceInceptionDigest(inception.image);
    const { offers, head } = await chainOf(inception, ["a", "b", "c"], 2, [101, 111]);
    const narrow = cadenceOfferBody({ inception: at, prev: head, engine: engineOf("d"), k: 0 });
    const all = [...offers, await signOffer(narrow, [111, 121])];
    expect(engineWindow(inception, all, [], cadenceOfferDigest(narrow))).toEqual({ ok: true, engines: [engineOf("d")] });
  });

  test("a release-deny drops its engine mid-window", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const at = cadenceInceptionDigest(inception.image);
    const { offers, head } = await chainOf(inception, ["a", "b", "c", "d"], 2, [101, 111]);
    const deny = await signDeny(cadenceReleaseDenyBody({ inception: at, prev: head, engine: engineOf("c") }), [111, 121]);
    expect(engineWindow(inception, offers, [deny], head)).toEqual({ ok: true, engines: [engineOf("d"), engineOf("b")] });
  });

  test("a broken prev refuses by name", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const { offers, head } = await chainOf(inception, ["a", "b", "c", "d"], 2, [101, 111]);
    // The offer two hops back goes missing: the walk cannot reach the window's edge.
    const missing = offers.filter((_, i) => i !== 2);
    expect(engineWindow(inception, missing, [], head)).toEqual({ ok: false, refusal: "cadence-offer-chain-broken" });
    // A head nobody holds refuses the same way.
    expect(engineWindow(inception, offers, [], "0".repeat(64))).toEqual({ ok: false, refusal: "cadence-offer-chain-broken" });
  });

  test("a forged signature anywhere in the chain refuses", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const { offers, head } = await chainOf(inception, ["a", "b", "c", "d"], 2, [101, 111]);
    const forged = offers.map((o, i) => i !== 3 ? o : { body: o.body, signatures: [o.signatures[0]!, { signer: o.signatures[1]!.signer, sig: o.signatures[0]!.sig }] });
    expect(engineWindow(inception, forged, [], head)).toEqual({ ok: false, refusal: "cadence-offer-unsigned" });
  });

  test("under-threshold signatures refuse", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const { offers, head } = await chainOf(inception, ["a", "b", "c"], 2, [101]);
    expect(engineWindow(inception, offers, [], head)).toEqual({ ok: false, refusal: "cadence-offer-unsigned" });
    const deny = await signDeny(cadenceReleaseDenyBody({ inception: cadenceInceptionDigest(inception.image), prev: null, engine: engineOf("a") }), [121]);
    const signed = await chainOf(inception, ["a", "b"], 2, [101, 111]);
    expect(engineWindow(inception, signed.offers, [deny], signed.head)).toEqual({ ok: false, refusal: "cadence-release-deny-unsigned" });
  });

  test("an offer or deny naming another inception refuses", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const foreign = await inceptionOf([141, 151], 1);
    const { offers, head } = await chainOf(inception, ["a", "b"], 2, [101, 111]);
    const stray = await chainOf(foreign, ["z"], 2, [141]);
    expect(engineWindow(inception, [...offers, ...stray.offers], [], head)).toEqual({ ok: false, refusal: "cadence-offer-foreign-inception" });
    const strayDeny = await signDeny(cadenceReleaseDenyBody({ inception: cadenceInceptionDigest(foreign.image), prev: null, engine: engineOf("a") }), [141]);
    expect(engineWindow(inception, offers, [strayDeny], head)).toEqual({ ok: false, refusal: "cadence-release-deny-foreign-inception" });
  });

  test("an inception its own holders did not sign refuses before any offer reads", async () => {
    const inception = await inceptionOf(SEEDS, 2);
    const { offers, head } = await chainOf(inception, ["a"], 2, [101, 111]);
    const short = { image: inception.image, signatures: inception.signatures.slice(0, 2) };
    expect(engineWindow(short, offers, [], head)).toEqual({ ok: false, refusal: "cadence-short-of-holders" });
  });
});
