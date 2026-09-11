/**
 * lazy-resolver — the READ side of the skinny handle rehydrates a body on lazyLoad.
 *
 * A skinny handle stands in the wiki with `_is_skinny`/`textCid` + NO `text`. TW5's
 * `getTiddlerText` fires `dispatchEvent("lazyLoad", title)` for exactly that shape. The
 * resolver answers: pull the body from the corpus CAS by content-address, re-verify
 * cid == sha256(bytes), and splice `text` in through the GUARDED nalu rail (so it never
 * echoes back to the CRDT). A CAS miss, an integrity fault, or a web2 `_canonical_uri`
 * leaves the handle bodyless — the body is never faked.
 */

import { describe, test, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { installLazyResolver, skinnyCid, type CarrierResolver } from "../src/lazy-resolver.js";
import { cidUri } from "@lararium/mesh";
import type { LarTiddlerChange } from "@lararium/mesh";

const cidOf = (s: string) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
const bytesOf = (s: string) => new TextEncoder().encode(s);
const flush = () => new Promise<void>((r) => setImmediate(r));

/** A minimal wiki + $tw.lares stand-in — enough surface for the resolver, no TW5 boot. `config`
 *  carries TW5's registry rows a suite needs (the base64 re-encode reads `contentTypeInfo`). */
function makeFakeEngine(config: { contentTypeInfo?: Record<string, { encoding?: string }> } = {}) {
  const tiddlers = new Map<string, { fields: Record<string, unknown> }>();
  let lazyHandler: ((t: string) => void) | null = null;
  const enqueued: LarTiddlerChange[] = [];

  const wiki = {
    getTiddler: (t: string) => tiddlers.get(t),
    addEventListener: (name: string, fn: (t: string) => void) => { if (name === "lazyLoad") lazyHandler = fn; },
    removeEventListener: (name: string) => { if (name === "lazyLoad") lazyHandler = null; },
  };
  const lares = {
    enqueueNalu: (change: LarTiddlerChange) => {
      enqueued.push(change);
      // Model the guarded drain: the splice lands in the wiki, so a re-fire sees `text`.
      const rec = change.record;
      if (rec) tiddlers.set(change.title, { fields: { ...rec.tiddler } });
    },
  };
  const engine = { $tw: { wiki, lares, config } } as never;

  return {
    engine,
    tiddlers,
    enqueued,
    setTiddler: (fields: Record<string, unknown>) => tiddlers.set(fields["title"] as string, { fields }),
    fireLazyLoad: (t: string) => lazyHandler?.(t),
  };
}

describe("skinnyCid — source discrimination", () => {
  test("textCid wins as the direct CAS key", () => {
    expect(skinnyCid({ textCid: "abc123", _canonical_uri: cidUri("def456") })).toBe("abc123");
  });
  test("a lar cid _canonical_uri yields its hash", () => {
    expect(skinnyCid({ _canonical_uri: cidUri("deadbeef") })).toBe("deadbeef");
  });
  test("a web2 http(s) src yields null — native path owns it", () => {
    expect(skinnyCid({ _canonical_uri: "https://example.org/pic.png" })).toBeNull();
    expect(skinnyCid({ _canonical_uri: "data:image/png;base64,AAAA" })).toBeNull();
  });
  test("no body reference yields null", () => {
    expect(skinnyCid({ title: "x" })).toBeNull();
  });
});

describe("installLazyResolver — rehydrate on lazyLoad", () => {
  test("a skinny handle with textCid pulls + splices its body", async () => {
    const body = "the whole book body that left the CRDT for the cid tier";
    const cid = cidOf(body);
    const { engine, enqueued, setTiddler, fireLazyLoad } = makeFakeEngine();
    setTiddler({ title: "lar:///ha.ka.ba/bags/crossroads/library/book", _is_skinny: "yes", textCid: cid, size: String(body.length) });

    const resolveByCid: CarrierResolver = vi.fn(async (c) => (c === cid ? bytesOf(body) : null));
    installLazyResolver(engine, resolveByCid);

    fireLazyLoad("lar:///ha.ka.ba/bags/crossroads/library/book");
    await flush();

    expect(resolveByCid).toHaveBeenCalledWith(cid);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]!.record?.tiddler.text).toBe(body);
    // the skinny fields survive the splice — the projector still reads the handle at rest (T3)
    expect(enqueued[0]!.record?.tiddler._is_skinny).toBe("yes");
    expect(enqueued[0]!.record?.tiddler.textCid).toBe(cid);
    // the splice never echoes to the CRDT — it rides the crdt-remote (non-tw-local) origin
    expect(enqueued[0]!.origin).toEqual({ kind: "crdt-remote", edgeIsland: "cas-rehydrate" });
  });

  test("a lar-cid _canonical_uri (no textCid) resolves too", async () => {
    const body = "media body under a canonical lar cid uri";
    const cid = cidOf(body);
    const { engine, enqueued, setTiddler, fireLazyLoad } = makeFakeEngine();
    setTiddler({ title: "lar:///ha.ka.ba/bags/crossroads/media/clip", _is_skinny: "yes", _canonical_uri: cidUri(cid) });

    installLazyResolver(engine, async (c) => (c === cid ? bytesOf(body) : null));
    fireLazyLoad("lar:///ha.ka.ba/bags/crossroads/media/clip");
    await flush();

    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]!.record?.tiddler.text).toBe(body);
  });

  test("a web2 _canonical_uri is left to the native path — never resolved", async () => {
    const { engine, enqueued, setTiddler, fireLazyLoad } = makeFakeEngine();
    setTiddler({ title: "lar:///ha.ka.ba/bags/crossroads/media/web2", _is_skinny: "yes", _canonical_uri: "https://example.org/pic.png" });
    const resolveByCid: CarrierResolver = vi.fn(async () => bytesOf("x"));
    installLazyResolver(engine, resolveByCid);

    fireLazyLoad("lar:///ha.ka.ba/bags/crossroads/media/web2");
    await flush();

    expect(resolveByCid).not.toHaveBeenCalled();
    expect(enqueued).toHaveLength(0);
  });

  test("an integrity fault never splices unverified bytes", async () => {
    const cid = cidOf("the-claimed-body");
    const { engine, enqueued, setTiddler, fireLazyLoad } = makeFakeEngine();
    setTiddler({ title: "lar:///ha.ka.ba/bags/crossroads/library/tampered", _is_skinny: "yes", textCid: cid });

    // resolver returns DIFFERENT bytes than the cid names → hash mismatch
    installLazyResolver(engine, async () => bytesOf("a-different-body"));
    fireLazyLoad("lar:///ha.ka.ba/bags/crossroads/library/tampered");
    await flush();

    expect(enqueued).toHaveLength(0);
  });

  test("a CAS miss holds PENDING, and a later re-fire re-tries", async () => {
    const body = "eventually-available body";
    const cid = cidOf(body);
    const { engine, enqueued, setTiddler, fireLazyLoad } = makeFakeEngine();
    setTiddler({ title: "lar:///ha.ka.ba/bags/crossroads/library/pending", _is_skinny: "yes", textCid: cid });

    let present = false;
    installLazyResolver(engine, async (c) => (present && c === cid ? bytesOf(body) : null));

    fireLazyLoad("lar:///ha.ka.ba/bags/crossroads/library/pending");
    await flush();
    expect(enqueued).toHaveLength(0);   // PENDING — the body isn't in the CAS yet

    present = true;
    fireLazyLoad("lar:///ha.ka.ba/bags/crossroads/library/pending");
    await flush();
    expect(enqueued).toHaveLength(1);   // the re-fire resolves it
    expect(enqueued[0]!.record?.tiddler.text).toBe(body);
  });

  test("★ a base64-family pointer splices the RAW bytes re-encoded as base64 — TW5's own `text` for the type ★", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00]);
    const cid = createHash("sha256").update(png).digest("hex");
    const { engine, enqueued, setTiddler, fireLazyLoad } = makeFakeEngine({ contentTypeInfo: { "image/png": { encoding: "base64" } } });
    setTiddler({ title: "lar:///t/photo", _is_skinny: "yes", textCid: cid, type: "image/png", size: String(png.length) });

    installLazyResolver(engine, async (c) => (c === cid ? new Uint8Array(png) : null));
    fireLazyLoad("lar:///t/photo");
    await flush();

    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]!.record?.tiddler.text).toBe(png.toString("base64"));
    // no lar: pointer reaches the VM copy — nothing for the image widget to emit as a dead src
    expect(enqueued[0]!.record?.tiddler._canonical_uri).toBeUndefined();
  });

  test("★ on a BROWSER island a base64-family pointer mints a per-session blob: URL into the VM copy's _canonical_uri — VM only ★", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00]);
    const cid = createHash("sha256").update(png).digest("hex");
    const { engine, enqueued, setTiddler, fireLazyLoad } = makeFakeEngine({ contentTypeInfo: { "image/png": { encoding: "base64" } } });
    setTiddler({ title: "lar:///t/browser-photo", _is_skinny: "yes", textCid: cid, type: "image/png" });

    const minted: Array<{ type: string; size: number }> = [];
    installLazyResolver(engine, async () => new Uint8Array(png), {
      objectUrl: (bytes, type) => { minted.push({ type, size: bytes.length }); return "blob:https://vessel/0000-1111"; },
    });
    fireLazyLoad("lar:///t/browser-photo");
    await flush();

    expect(minted).toEqual([{ type: "image/png", size: png.length }]);
    expect(enqueued).toHaveLength(1);
    const vm = enqueued[0]!.record?.tiddler as Record<string, string>;
    expect(vm._canonical_uri).toMatch(/^blob:/);
    expect(vm.text).toBe(png.toString("base64"));
    // the splice rides the guarded rail — never the CRDT (the blob: URL dies with the session)
    expect(enqueued[0]!.origin).toEqual({ kind: "crdt-remote", edgeIsland: "cas-rehydrate" });
  });

  test("a utf8 pointer (a text/* body under the _lar_cas override) never mints a blob: URL", async () => {
    const body = "plain prose";
    const cid = cidOf(body);
    const { engine, enqueued, setTiddler, fireLazyLoad } = makeFakeEngine({ contentTypeInfo: { "text/plain": { encoding: "utf8" } } });
    setTiddler({ title: "lar:///t/prose", _is_skinny: "yes", textCid: cid, type: "text/plain", _canonical_uri: cidUri(cid) });
    installLazyResolver(engine, async () => bytesOf(body), { objectUrl: () => "blob:never" });
    fireLazyLoad("lar:///t/prose");
    await flush();
    expect(enqueued[0]!.record?.tiddler.text).toBe(body);
    expect(enqueued[0]!.record?.tiddler._canonical_uri).toBe(cidUri(cid));
  });

  test("an already-hydrated tiddler never re-pulls", async () => {
    const { engine, enqueued, setTiddler, fireLazyLoad } = makeFakeEngine();
    setTiddler({ title: "lar:///ha.ka.ba/bags/crossroads/library/warm", _is_skinny: "yes", textCid: cidOf("b"), text: "already here" });
    const resolveByCid: CarrierResolver = vi.fn(async () => bytesOf("b"));
    installLazyResolver(engine, resolveByCid);

    fireLazyLoad("lar:///ha.ka.ba/bags/crossroads/library/warm");
    await flush();

    expect(resolveByCid).not.toHaveBeenCalled();
    expect(enqueued).toHaveLength(0);
  });
});
