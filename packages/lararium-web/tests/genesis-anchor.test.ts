/**
 * genesis-anchor -- the page boots the seed its hearth serves, and checks it against the seed CID the hearth's own
 * arrival descriptor names before it crosses. Both bytes come off the house's origin, so the check reads
 * SELF-CONSISTENCY (pronaos: "the first arrival trusts the lararium's own origin"), never a verification.
 */
import { describe, expect, test } from "vitest";
import { arrivalSeedAnchor, genesisCrossingVerdict, genesisSeedBase, readServedSeed } from "../src/genesis-anchor.js";
// @ts-expect-error the raw import reads the page source as text (vite `?raw`)
import MAIN_SOURCE from "../src/main.ts?raw";

const seedText = JSON.stringify({ format: "lararium-genesis-seed/v1", actorSeed: "a".repeat(64), blobs: {}, tiddlers: {} });
const otherText = JSON.stringify({ format: "lararium-genesis-seed/v1", actorSeed: "b".repeat(64), blobs: {}, tiddlers: {} });
const hex = async (text: string): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const descriptorOf = (seedCid: string): string => JSON.stringify({
  format: "lar-arrival", arrival: "/", mirrors: [],
  routes: [{ kind: "genesis-seed", path: "/genesis/seed.json", seedCid, integrity: "ni:///sha-256;x", cache: "no-store", refusal: "integrity" }],
});

describe("the served seed", () => {
  test("reads the seed bytes at <base>/seed.json and names their sha256 as the seed CID", async () => {
    let asked = "";
    const served = await readServedSeed("/genesis", async (input) => { asked = input; return new Response(seedText); });
    expect(asked).toBe("/genesis/seed.json");
    expect(served.cid).toBe(await hex(seedText));
    expect((served.seed as { actorSeed: string }).actorSeed).toBe("a".repeat(64));
  });

  test("a base with a trailing slash asks the same path", async () => {
    let asked = "";
    await readServedSeed("/genesis/", async (input) => { asked = input; return new Response(seedText); });
    expect(asked).toBe("/genesis/seed.json");
  });

  test("CONTROL: a 404, an HTML page and a non-seed refuse by name", async () => {
    await expect(readServedSeed("/genesis", async () => new Response("no", { status: 404 }))).rejects.toThrow(/genesis-unserved: \/genesis\/seed\.json answered 404/);
    await expect(readServedSeed("/genesis", async () => new Response("<!doctype html>"))).rejects.toThrow(/genesis-unserved: \/genesis\/seed\.json reads as no genesis seed/);
    await expect(readServedSeed("/genesis", async () => new Response(JSON.stringify({ format: "other" })))).rejects.toThrow(/genesis-unserved/);
  });
});

describe("the hearth's own anchor", () => {
  test("asks /.well-known/lar on the relay's own origin and reads the genesis-seed route's CID", async () => {
    let asked = "";
    const anchor = await arrivalSeedAnchor("ws://127.0.0.1:4321/ws", async (input) => { asked = input; return new Response(descriptorOf("c".repeat(64))); });
    expect(asked).toBe("http://127.0.0.1:4321/.well-known/lar");
    expect(anchor).toEqual({ kind: "descriptor", seedCid: "c".repeat(64), at: "http://127.0.0.1:4321/.well-known/lar" });
    let tls = "";
    await arrivalSeedAnchor("wss://hearth.example.test/ws", async (input) => { tls = input; return new Response(descriptorOf("c".repeat(64))); });
    expect(tls).toBe("https://hearth.example.test/.well-known/lar");
  });

  test("CONTROL: a relay origin that answers no descriptor reads missing, never a CID", async () => {
    for (const reply of [async () => new Response("<!doctype html>"), async () => new Response("x", { status: 404 }), async () => { throw new TypeError("cors"); },
      async () => new Response(JSON.stringify({ format: "lar-arrival", arrival: "/", routes: [], mirrors: [] }))]) {
      const anchor = await arrivalSeedAnchor("ws://127.0.0.1:4321/ws", reply);
      expect(anchor.kind).toBe("missing");
    }
  });
});

describe("the crossing verdict", () => {
  test("equal seed CIDs cross", async () => {
    const cid = await hex(seedText);
    expect(genesisCrossingVerdict(cid, { kind: "descriptor", seedCid: cid, at: "http://h/.well-known/lar" })).toEqual({ kind: "cross" });
  });

  test("RED-SHAPE: a served seed whose CID differs from the descriptor's refuses by name, naming both CIDs and the anchor it read", async () => {
    const page = await hex(otherText), hearth = await hex(seedText);
    const verdict = genesisCrossingVerdict(page, { kind: "descriptor", seedCid: hearth, at: "http://h/.well-known/lar" });
    expect(verdict.kind).toBe("refuse");
    if (verdict.kind !== "refuse") return;
    expect(verdict.text.startsWith(`genesis-mismatch: page ${page} · hearth ${hearth}`)).toBe(true);
    expect(verdict.text).toContain("self-consistency against the hearth's arrival descriptor http://h/.well-known/lar");
    expect(verdict.text).not.toMatch(/verif/);
  });

  test("a missing descriptor on another origin (a dev page dialling a relay elsewhere) crosses uncompared and names itself", () => {
    const verdict = genesisCrossingVerdict("d".repeat(64), { kind: "missing", at: "http://h/.well-known/lar", why: "404" }, { pageOrigin: "http://dev:5173" });
    expect(verdict).toEqual({ kind: "uncompared", text: `arrival-descriptor-missing: http://h/.well-known/lar (404) · page seed ${"d".repeat(64)} crosses uncompared` });
  });

  test("RED: a page the hearth serves itself (same origin) refuses a missing descriptor by name: the Pronaos serves it there, so its absence reads as a fault", () => {
    const verdict = genesisCrossingVerdict("d".repeat(64), { kind: "missing", at: "http://h/.well-known/lar", why: "404" }, { pageOrigin: "http://h" });
    expect(verdict.kind).toBe("refuse");
    if (verdict.kind !== "refuse") return;
    expect(verdict.text.startsWith("arrival-descriptor-missing: http://h/.well-known/lar (404)")).toBe(true);
    expect(verdict.text).toContain("same origin");
    expect(verdict.text).not.toMatch(/verif/);
  });

  test("CONTROL: a same-origin page whose descriptor names its seed crosses clean", async () => {
    const cid = await hex(seedText);
    expect(genesisCrossingVerdict(cid, { kind: "descriptor", seedCid: cid, at: "http://h/.well-known/lar" }, { pageOrigin: "http://h" })).toEqual({ kind: "cross" });
  });
});

describe("the seed comes off the hearth's own /genesis alone: the page reads no genesis key (operator ruling, 2026-11-02)", () => {
  // Query and fragment pass through to the wiki untouched; no URL key may choose the seed, so no link chooses the hashes
  // the page then checks itself against.
  test("RED: the seed base reads the page's own origin and /genesis, whatever the URL carries", () => {
    expect(genesisSeedBase("https://hearth.example")).toBe("https://hearth.example/genesis");
  });

  test("RED: the page source reads no `genesis` query or fragment key", () => {
    expect(String(MAIN_SOURCE)).not.toMatch(/\.get\(\s*["']genesis["']\s*\)/);
    expect(String(MAIN_SOURCE)).not.toMatch(/genesisBaseVerdict/);
  });

  test("CONTROL: R1 holds on the default path: a same-origin page with no descriptor refuses; a cross-origin dev relay warns and crosses", () => {
    expect(genesisCrossingVerdict("d".repeat(64), { kind: "missing", at: "http://h/.well-known/lar", why: "404" }, { pageOrigin: "http://h" }).kind).toBe("refuse");
    expect(genesisCrossingVerdict("d".repeat(64), { kind: "missing", at: "http://relay/.well-known/lar", why: "404" }, { pageOrigin: "http://dev:5173" }).kind).toBe("uncompared");
  });
});
