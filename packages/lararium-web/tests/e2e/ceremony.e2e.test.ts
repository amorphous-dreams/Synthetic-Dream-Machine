/**
 * e2e/ceremony — THE CLEAN CEREMONY DOCUMENT TAKES THE SECRET, AND THE SURFACE PAGE NEVER HOLDS IT (browser-vessel-lift#/the-slices,
 * slice 1b; the operator's ruling, 2026-11-05: "Approve").
 *
 * One WALK BUILD of the Pronaos (`LAR_WALK_DOOR=1 vite build` into a scratch dir: only that build carries the walk's ward act),
 * served on the loopback, driven by a real Chromium. The harness answers every ask as a person would: it presses the page's
 * button and types the published test route into the ceremony document's own form (`browser-test-custody`).
 *
 *   K1 RED      at the floor, with no secret held, the ceremony document and its broker answer; the document's response
 *               carries its policy (no inline script, no eval, `frame-ancestors 'none'`), and a same-origin frame of it
 *               stands blocked (its document never reaches the framer).
 *   K2 RED      a page-thread spy on every message the page sends or hears (its workers, its ports, its service worker,
 *               its window) and every DOM input reads no byte of the route while a fresh vessel founds (bind-first), reloads
 *               and unlocks, and signs one ward act, and the page never stands a password field. The ward act's signature
 *               verifies under the key it names. CONTROL: the spy read the vessel's asks and the page's own port hand-offs,
 *               so a zero reads from a live instrument; the barrier for each claim is the far side's own answer (the phase
 *               `live`, the ward act's signature).
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createPublicKey, verify } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Page } from "playwright";
import { armTestCustody, TEST_PASSPHRASE } from "../../../lararium-node/probes/browser-test-custody.js";

const root = resolve(import.meta.dirname, "../../../..");
const port = Number(process.env.LAR_WEB_CEREMONY_PORT ?? 5447);
const baseUrl = `http://127.0.0.1:${port}`;
const vite = resolve(root, "packages/lararium-web/node_modules/vite/bin/vite.js");
const WAIT = 90_000;
let walkOut = "";
let preview: ReturnType<typeof spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

beforeAll(async () => {
  walkOut = mkdtempSync(resolve(tmpdir(), "lar-ceremony-walk-"));
  execFileSync(process.execPath, [vite, "build", "--outDir", walkOut, "--emptyOutDir"],
    { cwd: resolve(root, "packages/lararium-web"), env: { ...process.env, LAR_WALK_DOOR: "1" }, stdio: "ignore" });
  preview = spawn(process.execPath, [vite, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--outDir", walkOut],
    { cwd: resolve(root, "packages/lararium-web"), stdio: "ignore" });
  let last: unknown;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(baseUrl)).ok) { last = undefined; break; } } catch (error) { last = error; }
    await new Promise((r) => setTimeout(r, 125));
  }
  assert.equal(last, undefined, `the walk build's preview did not open on ${baseUrl}`);
  // A port another process holds answers with ITS build: the preview this test spawned must still stand (strictPort exits).
  assert.equal(preview.exitCode, null, `the walk build's own preview stands on ${baseUrl} (another process holds the port?)`);
  browser = await chromium.launch({ headless: true });
}, 300_000);
afterAll(async () => { await browser?.close(); preview?.kill("SIGTERM"); if (walkOut) rmSync(walkOut, { recursive: true, force: true }); });

const live = (page: Page) => page.waitForFunction(() => [...document.querySelectorAll("#phases .phase")].some((p) => p.textContent === "live"), undefined, { timeout: WAIT });

test("K1 RED — at the floor the ceremony document and its broker answer, the document carries its policy, and a frame of it stands blocked", { timeout: 120_000 }, async () => {
  const doc = await fetch(`${baseUrl}/ceremony.html`);
  assert.equal(doc.status, 200);
  const policy = doc.headers.get("content-security-policy") ?? "";
  assert.match(policy, /frame-ancestors 'none'/, `the ceremony's response forbids framing (policy: ${policy || "none"})`);
  assert.match(policy, /script-src 'self'(;|$)/);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
  const html = await doc.text();
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="[^"]*script-src 'self';/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, "the document holds no inline script");
  const broker = await fetch(`${baseUrl}/ceremony-broker.js`);
  assert.equal(broker.status, 200);
  assert.match(broker.headers.get("content-type") ?? "", /javascript/);
  assert.match(await broker.text(), /ceremony:claim/);

  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/manifest.webmanifest`);
    const framed = await page.evaluate(async () => {
      const frame = document.createElement("iframe");
      frame.src = "/ceremony.html#ask=0f8fad5b-d9cb-469f-a165-70867728950e";
      const loaded = Promise.race([new Promise((r) => { frame.onload = r; }), new Promise((r) => setTimeout(r, 5_000))]);
      document.body.append(frame);
      await loaded;
      await new Promise((r) => setTimeout(r, 300));
      return { reached: frame.contentDocument !== null, form: frame.contentDocument?.querySelector("#ceremony-form") !== null && frame.contentDocument?.querySelector("#ceremony-form") !== undefined };
    });
    assert.deepEqual(framed, { reached: false, form: false }, "a same-origin frame of the ceremony stands blocked by its policy");
  } finally { await context.close(); }
});

test("K2 RED — the page's thread holds no route byte while a vessel founds, unlocks and signs a ward act through the ceremony", { timeout: 300_000 }, async () => {
  const context = await browser.newContext();
  await armTestCustody(context, "ceremony");
  const needle = TEST_PASSPHRASE;
  const hexNeedle = Buffer.from(TEST_PASSPHRASE, "utf8").toString("hex");
  // THE SPY, on the surface page alone (the ceremony document is where the secret belongs).
  await context.addInitScript(({ needle, hexNeedle }) => {
    if (location.pathname !== "/") return;
    const spy = { count: 0, hits: [] as string[], kinds: {} as Record<string, number>, passwordFields: 0, notices: 0 };
    (window as unknown as { __larSpy: typeof spy }).__larSpy = spy;
    const hexOf = (b: Uint8Array): string => { let s = ""; for (const x of b) s += x.toString(16).padStart(2, "0"); return s; };
    const scan = (where: string, data: unknown): void => {
      spy.count++;
      const t = (data as { t?: unknown } | null)?.t;
      if (typeof t === "string") spy.kinds[`${where}:${t}`] = (spy.kinds[`${where}:${t}`] ?? 0) + 1;
      const seen = new Set<unknown>();
      const walk = (v: unknown, depth: number): void => {
        if (depth > 14 || v === null || v === undefined) return;
        if (typeof v === "string") { if (v.includes(needle) || v.includes(hexNeedle)) spy.hits.push(`${where}: a string`); return; }
        if (typeof v !== "object" || seen.has(v)) return;
        seen.add(v);
        if (v instanceof ArrayBuffer) { if (v.byteLength < 1 << 20 && hexOf(new Uint8Array(v)).includes(hexNeedle)) spy.hits.push(`${where}: a buffer`); return; }
        if (ArrayBuffer.isView(v)) { if (v.byteLength < 1 << 20 && hexOf(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)).includes(hexNeedle)) spy.hits.push(`${where}: a view`); return; }
        for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k], depth + 1);
      };
      walk(data, 0);
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, opts?: WorkerOptions) { super(url, opts); this.addEventListener("message", (e) => scan("worker-in", e.data)); }
      override postMessage(m: unknown, t?: unknown): void { scan("worker-out", m); super.postMessage(m, t as Transferable[]); }
    };
    const portPost = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function (this: MessagePort, m: unknown, t?: unknown) { scan("port-out", m); return portPost.call(this, m, t as Transferable[]); };
    const swPost = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function (this: ServiceWorker, m: unknown, t?: unknown) { scan("broker-out", m); return swPost.call(this, m, t as Transferable[]); };
    navigator.serviceWorker?.addEventListener("message", (e) => scan("broker-in", e.data));
    window.addEventListener("message", (e) => scan("window-in", e.data), true);
    document.addEventListener("input", (e) => scan("dom-input", (e.target as HTMLInputElement | null)?.value), true);
    new MutationObserver(() => {
      spy.passwordFields = Math.max(spy.passwordFields, document.querySelectorAll('input[type="password"]').length);
      spy.notices = Math.max(spy.notices, document.querySelectorAll(".ceremony-ask").length);
    }).observe(document, { childList: true, subtree: true });
  }, { needle, hexNeedle });

  const page = await context.newPage();
  const faults: string[] = [];
  page.on("pageerror", (e) => faults.push(`[page] ${e.message}`));
  const logs: string[] = [];
  context.on("console", (m) => { if (!/Global assignment detected/.test(m.text())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
  page.on("worker", (w) => w.on("console", (m) => { if (!/Global assignment detected/.test(m.text())) logs.push(`[worker ${w.url().split("/").pop()}] ${m.text().slice(0, 300)}`); }));
  type Spy = { count: number; hits: string[]; kinds: Record<string, number>; passwordFields: number; notices: number };
  const readSpy = () => page.evaluate(() => (window as unknown as { __larSpy: Spy }).__larSpy);
  const reads: Spy[] = [];
  try {
    // FOUND: a fresh vessel asks bind-first; the ceremony takes the first passphrase.
    await page.goto(baseUrl);
    await live(page);
    reads.push(await readSpy());
    // UNLOCK: a reload stands a sealed vessel at its floor, and it asks its unlock through the ceremony.
    await page.reload();
    await live(page);
    // WARD: one ward act, its passphrase asked through the ceremony; the barrier is the act's own signature.
    const bytes = [0x6c, 0x61, 0x72, 0x3a, 0x77, 0x61, 0x72, 0x64];
    await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>)["__larWalkWardAct"] === "function", undefined, { timeout: WAIT });
    const signed = await Promise.race([
      page.evaluate((b) => (window as unknown as { __larWalkWardAct: (b: number[]) => Promise<{ key: string; signature: string }> }).__larWalkWardAct(b), bytes),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`the ward act answered nothing within 90 s; the last logs:\n${logs.slice(-40).join("\n")}`)), WAIT)),
    ]);
    reads.push(await readSpy());

    const key = signed.key.replace(/^0x/, "");
    const publicKey = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(key, "hex").toString("base64url") }, format: "jwk" });
    assert.ok(verify(null, Buffer.from(bytes), publicKey, Buffer.from(signed.signature.replace(/^0x/, ""), "hex")), "the ward act's signature verifies under the key it names");

    for (const [i, spy] of reads.entries()) {
      // CONTROL: a live instrument — the spy read the vessel's asks and the page's own hand of each ceremony's port.
      assert.ok(spy.count > 0 && (spy.kinds["worker-in:ask"] ?? 0) >= 1, `load ${i}: the spy read the vessel's ask (${JSON.stringify(spy.kinds)})`);
      assert.ok((spy.kinds["worker-out:ceremony:port"] ?? 0) >= 1 && (spy.kinds["broker-out:ceremony:offer"] ?? 0) >= 1, `load ${i}: the spy read the page's port hand-offs (${JSON.stringify(spy.kinds)})`);
      assert.ok(spy.notices >= 1, `load ${i}: the spy saw the ask's notice`);
      assert.deepEqual(spy.hits, [], `load ${i}: no route byte crossed the page's thread`);
      assert.equal(spy.passwordFields, 0, `load ${i}: the page stood no password field`);
      assert.equal(spy.kinds["worker-out:answer"], undefined, `load ${i}: the page posted no answer to the vessel`);
    }
    assert.ok((reads[1]!.kinds["worker-in:ask"] ?? 0) >= 2, "the second load asked twice (the unlock, the ward act)");
    assert.deepEqual(faults, [], "no page error through the founding, the unlock and the ward act");
  } finally { await context.close(); }
});
