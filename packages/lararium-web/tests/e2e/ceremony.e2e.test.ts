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
 *   K3 RED      THE CONSOLE DOOR AND THE RESET, on two tabs of one origin (browser-vessel-lift#/the-console-door, #/the-reset):
 *               `lares("help")` from the page's console lists the page's and the vessel's rows, and `lares("vessel", "read")`
 *               names the veil's standing and its key; `lares("vessel", "reset")` burns nothing by itself and paints the reset
 *               ask; the ceremony's wrong words burn nothing (the key reads unchanged); its typed confirmation returns BOTH
 *               tabs to a fresh anon floor under a NEW key, with no word from either tab. CONTROL: the door refuses a host
 *               shim verb by name, and a word past a verb's path refuses `usage`.
 *   K4 RED      THE RESET CEREMONY BURNS ONLY FOR AN ASK A PAGE OF THIS ORIGIN RAISED: the ceremony document opened at
 *               `#reset=<id>` for an id no page raised (a bare link from anywhere) refuses `reset-unasked` and paints no form;
 *               an ask the page raised and the person withdrew ("not now") refuses the same way; the vessel keeps its key.
 *               CONTROL: a fresh ask the page raised and still shows stands the ceremony's form, its typed words burn the
 *               place (a new key), and the burned id then refuses too.
 *   K5 RED      A CEREMONY WINDOW THAT OUTLIVES THE BURN STALLS NO BOOT: the reset ceremony reached by plain navigation in a tab
 *               with history (`window.close()` shuts no such window) keeps the unregistered broker alive; the reloaded page loads
 *               uncontrolled and its `register()` revives that registration with no second `activate`. The page asks the
 *               worker to claim and boots to `live` under a new key. CONTROL: the ceremony's window still stands open after the
 *               burn (the instrument held the condition), and the booted page stands controlled.
 *   K6 RED      THE CONFIRM GATE (browser-vessel-lift#/the-confirm-gate), on a founded browser whose vessel stands LOCKED (a
 *               fresh tab whose unlock nobody answers): the page's own control and the console door raise ONE reset ask; its
 *               ceremony asks a passphrase (a password field, no typed-phrase prompt); the typed phrase alone and a wrong
 *               passphrase each refuse `no-slot-opens`, the place stays sealed with its face, and the form still stands; the
 *               right passphrase burns the place and the tab boots at a fresh anon floor under a new key. At that bare floor
 *               the ceremony asks the typed phrase, and the phrase alone burns. No console line of any page or worker, no
 *               door answer and no ask record carries a byte typed into the gate. CONTROL: the locked tab's own door read
 *               the place sealed and its session not unlocked while the gate answered.
 *   K6b RED     THE CEREMONY REFUSES AN OPENER: a script of the page that opens the ceremony document itself, WITHOUT
 *               `noopener`, holds a handle to a same-origin window and could read its field. The ceremony refuses
 *               `ceremony-has-opener` before it paints any field, for a reset ask and for a vessel ask alike; what a person
 *               types then reaches no field the opener reads. CONTROL: the same ask, opened by the page's own button (no
 *               opener), stands its form.
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
    const spy = { count: 0, hits: [] as string[], detail: [] as string[], kinds: {} as Record<string, number>, passwordFields: 0, notices: 0 };
    (window as unknown as { __larSpy: typeof spy }).__larSpy = spy;
    const ring: string[] = [];
    const hexOf = (b: Uint8Array): string => { let s = ""; for (const x of b) s += x.toString(16).padStart(2, "0"); return s; };
    const scan = (where: string, data: unknown): void => {
      spy.count++;
      const t = (data as { t?: unknown } | null)?.t;
      if (typeof t === "string") spy.kinds[`${where}:${t}`] = (spy.kinds[`${where}:${t}`] ?? 0) + 1;
      ring.push(`${where}:${typeof t === "string" ? t : typeof data}`); if (ring.length > 16) ring.shift();
      const seen = new Set<unknown>();
      // DIAGNOSTIC (redacted): a hit records the message's kind, the key path and the string around the route with the
      // route itself replaced, so a CI log names the carrying line and never the route.
      const redact = (s: string): string => s.split(needle).join("«ROUTE»").split(hexNeedle).join("«ROUTE-HEX»");
      const describe = (path: string, s: string): string => {
        const at = Math.max(s.indexOf(needle), s.indexOf(hexNeedle));
        return JSON.stringify({ before: ring.slice(0, -1), where, t: typeof t === "string" ? t : null, path, keys: data && typeof data === "object" ? Object.keys(data as object) : typeof data, len: s.length,
          around: redact(s.slice(Math.max(0, at - 400), at + needle.length + hexNeedle.length + 400)) });
      };
      const walk = (v: unknown, depth: number, path = "$"): void => {
        if (depth > 14 || v === null || v === undefined) return;
        if (typeof v === "string") { if (v.includes(needle) || v.includes(hexNeedle)) { spy.hits.push(`${where}: a string`); spy.detail.push(describe(path, v)); } return; }
        if (typeof v !== "object" || seen.has(v)) return;
        seen.add(v);
        if (v instanceof ArrayBuffer) { if (v.byteLength < 1 << 20 && hexOf(new Uint8Array(v)).includes(hexNeedle)) spy.hits.push(`${where}: a buffer`); return; }
        if (ArrayBuffer.isView(v)) { if (v.byteLength < 1 << 20 && hexOf(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)).includes(hexNeedle)) spy.hits.push(`${where}: a view`); return; }
        for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k], depth + 1, `${path}.${k}`);
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
  type Spy = { count: number; hits: string[]; detail: string[]; kinds: Record<string, number>; passwordFields: number; notices: number };
  const readSpy = () => page.evaluate(() => (window as unknown as { __larSpy: Spy }).__larSpy);
  const reads: Spy[] = [];
  /** The spy's verdict on one load, read as the load lands. */
  const judge = (i: number, spy: Spy): void => {
    // CONTROL: a live instrument — the spy read the vessel's asks and the page's own hand of each ceremony's port.
    assert.ok(spy.count > 0 && (spy.kinds["worker-in:ask"] ?? 0) >= 1, `load ${i}: the spy read the vessel's ask (${JSON.stringify(spy.kinds)})`);
    if (spy.hits.length) console.log(`[K2-diag] load ${i} hits (redacted): ${spy.detail.join("\n")}\n[K2-diag] kinds ${JSON.stringify(spy.kinds)}`);
    assert.deepEqual(spy.hits, [], `load ${i}: no route byte crossed the page's thread — ${spy.detail.join(" | ")}`);
    assert.equal(spy.passwordFields, 0, `load ${i}: the page stood no password field`);
    assert.equal(spy.kinds["worker-out:answer"], undefined, `load ${i}: the page posted no answer to the vessel`);
    assert.ok((spy.kinds["worker-out:ceremony:port"] ?? 0) >= 1 && (spy.kinds["broker-out:ceremony:offer"] ?? 0) >= 1, `load ${i}: the spy read the page's port hand-offs (${JSON.stringify(spy.kinds)})`);
    assert.ok(spy.notices >= 1, `load ${i}: the spy saw the ask's notice`);
  };
  try {
    // FOUND: the founding act asks for a face through the page's own door (the identity panel's button; a bare arrival stands
    // a veil floor and asks nothing, and no URL selects a founding). The tap stashes the ask for one boot and the page boots
    // again; the vessel then asks bind-first, and the ceremony takes the first passphrase.
    await page.goto(`${baseUrl}/`);
    await live(page);
    await Promise.all([page.waitForEvent("load"), page.locator("#found-face").click()]);
    assert.equal(new URL(page.url()).search, "", "the founding act leaves the address bar alone");
    await live(page);
    reads.push(await readSpy());
    judge(0, reads[0]!);
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
    judge(1, reads[1]!);

    const key = signed.key.replace(/^0x/, "");
    const publicKey = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(key, "hex").toString("base64url") }, format: "jwk" });
    assert.ok(verify(null, Buffer.from(bytes), publicKey, Buffer.from(signed.signature.replace(/^0x/, ""), "hex")), "the ward act's signature verifies under the key it names");

    assert.ok((reads[1]!.kinds["worker-in:ask"] ?? 0) >= 2, "the second load asked twice (the unlock, the ward act)");
    assert.deepEqual(faults, [], "no page error through the founding, the unlock and the ward act");
  } finally { await context.close(); }
});

type Answer = { ok: boolean; data?: { entries?: { verb: string; holder: string }[]; vessel?: { standing?: string; vessel?: { did: string } | null; absent?: string }; page?: { asks: { kind: string }[]; tab: string }; askId?: string }; error?: { code: string; message: string } };
const lares = (page: Page, ...argv: string[]): Promise<Answer> => page.evaluate((words) => (window as unknown as { lares: (...a: string[]) => Promise<Answer> }).lares(...words), argv);
/** The veil key this tab's vessel reads, once its session stands admitted on the lit vessel. */
const keyOf = async (page: Page): Promise<string> => {
  for (let i = 0; i < 360; i++) {
    const read = await lares(page, "vessel", "read").catch(() => null);
    const did = read?.data?.vessel?.vessel?.did;
    if (typeof did === "string") return did;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the tab's vessel named no key within 90 s: ${JSON.stringify(await lares(page, "vessel", "read").catch((e: unknown) => String(e)))}`);
};

test("K3 RED — the console door reads the vessel, and the reset ceremony's typed words return every tab to a fresh anon floor", { timeout: 300_000 }, async () => {
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    const faults: string[] = [];
    first.on("pageerror", (e) => faults.push(`[first] ${e.message}`));
    await first.goto(`${baseUrl}/`);
    await live(first);
    const second = await context.newPage();
    second.on("pageerror", (e) => faults.push(`[second] ${e.message}`));
    await second.goto(`${baseUrl}/`);

    // THE DOOR: help lists both holders' rows, and the read names the veil.
    const help = await lares(first, "help");
    assert.deepEqual(help.data?.entries?.map((e) => `${e.holder}:${e.verb}`), ["page:help", "vessel:vault status", "page:vessel read", "page:vessel reset"]);
    const before = await keyOf(first);
    assert.equal(await keyOf(second), before, "two tabs of one origin read one vessel's key");
    assert.equal((await lares(first, "vessel", "read")).data?.vessel?.standing, "lit");
    // CONTROL: a host shim verb refuses by name, and a word past a path refuses usage.
    assert.equal((await lares(first, "up")).error?.code, "host-shim-verb");
    assert.equal((await lares(first, "vault", "status", "a-word")).error?.code, "usage");

    // THE RESET ASK: the door's own call burns nothing and paints the ask; the read names it.
    const asked = await lares(first, "vessel", "reset");
    assert.equal(asked.ok, true);
    assert.deepEqual((await lares(first, "vessel", "read")).data?.page?.asks.map((a) => a.kind), ["reset"]);
    assert.equal(await keyOf(first), before, "the door's call burned nothing");
    const [rite] = await Promise.all([context.waitForEvent("page"), first.locator(".ceremony-ask[data-ask=\"reset\"] button.ceremony-open").first().click()]);
    await rite.waitForSelector("#ceremony-form:not([hidden])", { timeout: WAIT });
    assert.equal(await rite.evaluate(() => window.opener), null, "the reset ceremony's window carries no opener");
    // WRONG WORDS burn nothing.
    await rite.locator("#ceremony-pass").fill("reset");
    await rite.locator("#ceremony-go").click();
    await rite.waitForFunction(() => document.getElementById("ceremony-state")?.textContent?.includes("nothing burned"), undefined, { timeout: WAIT });
    assert.equal(await keyOf(first), before, "wrong words burned nothing");
    // THE TYPED CONFIRMATION burns the place, and both tabs boot afresh.
    await rite.locator("#ceremony-pass").fill("reset this browser");
    await Promise.all([first.waitForEvent("load", { timeout: WAIT }), second.waitForEvent("load", { timeout: WAIT }), rite.locator("#ceremony-go").click()]);
    const after = await keyOf(first);
    assert.notEqual(after, before, "the reset burned the place: the vessel stands under a new veil key");
    assert.equal(await keyOf(second), after, "the second tab stands on the same fresh floor");
    assert.deepEqual((await lares(first, "vessel", "read")).data?.page?.asks, [], "no ask stands after the reset");
    assert.deepEqual(faults, [], "no page error through the door and the reset");
  } finally { await context.close(); }
});

test("K4 RED — the reset ceremony burns only for an ask a page of this origin raised and still shows: a bare link and a withdrawn ask refuse reset-unasked", { timeout: 300_000 }, async () => {
  const context = await browser.newContext();
  /** Open the ceremony document at a reset ask's id, as a link from anywhere would, and read how it stands. */
  const standAt = async (askId: string): Promise<{ refusal: string | null; formHidden: boolean; state: string }> => {
    const rite = await context.newPage();
    await rite.goto(`${baseUrl}/ceremony.html#reset=${askId}`);
    await rite.waitForFunction(() => document.body.dataset["refusal"] !== undefined || document.getElementById("ceremony-form")?.hidden === false, undefined, { timeout: WAIT });
    const read = await rite.evaluate(() => ({ refusal: document.body.dataset["refusal"] ?? null, formHidden: document.getElementById("ceremony-form")?.hidden === true, state: document.getElementById("ceremony-state")?.textContent ?? "" }));
    await rite.close();
    return read;
  };
  try {
    const page = await context.newPage();
    const faults: string[] = [];
    page.on("pageerror", (e) => faults.push(e.message));
    await page.goto(`${baseUrl}/`);
    await live(page);
    const before = await keyOf(page);
    // A BARE LINK: an id no page raised. The ceremony paints no form, so no typed phrase can burn anything.
    const bare = await standAt("0f8fad5b-d9cb-469f-a165-70867728950e");
    assert.deepEqual({ refusal: bare.refusal, formHidden: bare.formHidden }, { refusal: "reset-unasked", formHidden: true }, `a ceremony no page asked for refuses by name (it said: ${bare.state})`);
    // A WITHDRAWN ASK: the page raised it and the person pressed "not now". Its id no longer stands.
    const asked = await lares(page, "vessel", "reset");
    const askId = asked.data?.askId ?? "";
    assert.match(askId, /^[0-9a-f-]{36}$/);
    await page.locator(".ceremony-ask[data-ask=\"reset\"] button.ceremony-withdraw").click();
    assert.equal((await standAt(askId)).refusal, "reset-unasked", "a withdrawn ask's id stands no ceremony");
    assert.equal(await keyOf(page), before, "neither refusal burned anything: the vessel keeps its key");
    // CONTROL: the same page raises a fresh ask, the ceremony stands its form for that id, and its typed words burn the place.
    const again = (await lares(page, "vessel", "reset")).data?.askId ?? "";
    assert.notEqual(again, askId);
    const [rite] = await Promise.all([context.waitForEvent("page"), page.locator(".ceremony-ask[data-ask=\"reset\"] button.ceremony-open").first().click()]);
    await rite.waitForSelector("#ceremony-form:not([hidden])", { timeout: WAIT });
    assert.equal(new URL(rite.url()).hash, `#reset=${again}`);
    assert.equal(await rite.evaluate(() => document.body.dataset["refusal"] ?? null), null, "an ask the page raised and still shows stands its ceremony");
    await rite.locator("#ceremony-pass").fill("reset this browser");
    await Promise.all([page.waitForEvent("load", { timeout: WAIT }), rite.locator("#ceremony-go").click()]);
    assert.notEqual(await keyOf(page), before, "the raised ask's ceremony burned the place: the vessel stands under a new key");
    // The burned ask's id stands no second ceremony.
    assert.equal((await standAt(again)).refusal, "reset-unasked", "a burned ask's id stands no ceremony again");
    assert.deepEqual(faults, [], "no page error through the refusals and the burn");
  } finally { await context.close(); }
});

test("K5 RED — a ceremony window that outlives the reset's burn stalls no boot: the reloaded page asks the revived broker to claim and stands live", { timeout: 300_000 }, async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const faults: string[] = [];
    page.on("pageerror", (e) => faults.push(e.message));
    await page.goto(`${baseUrl}/`);
    await live(page);
    const before = await keyOf(page);
    const askId = (await lares(page, "vessel", "reset")).data?.askId ?? "";
    assert.match(askId, /^[0-9a-f-]{36}$/);
    // The ceremony reached by PLAIN NAVIGATION, in a tab that already holds history: no script opened it, so its own
    // `window.close()` after the burn shuts nothing and the window keeps the unregistered broker alive.
    const rite = await context.newPage();
    await rite.goto(`${baseUrl}/manifest.webmanifest`);
    await rite.goto(`${baseUrl}/ceremony.html#reset=${askId}`);
    await rite.waitForSelector("#ceremony-form:not([hidden])", { timeout: WAIT });
    await rite.locator("#ceremony-pass").fill("reset this browser");
    await Promise.all([page.waitForEvent("load", { timeout: WAIT }), rite.locator("#ceremony-go").click()]);
    await live(page);
    assert.notEqual(await keyOf(page), before, "the burn landed and the page booted afresh under a new key");
    // CONTROL: the condition held (the ceremony's window outlived the burn), and the booted page stands controlled.
    assert.equal(rite.isClosed(), false, "the ceremony's window outlived the burn");
    assert.equal(await page.evaluate(() => navigator.serviceWorker.controller !== null), true, "the booted page stands under its broker");
    assert.deepEqual(faults, [], "no page error through the burn and the boot");
  } finally { await context.close(); }
});

type Vault = { ok: boolean; data?: { custody?: { place?: { reading?: string }; faces?: unknown[] }; door?: { unlocked?: boolean; standing?: string } } };
const vault = (page: Page): Promise<Vault> => lares(page, "vault", "status") as Promise<Vault>;

test("K6 RED — the confirm gate: a locked, founded browser's reset asks its passphrase, a wrong one burns nothing, the right one burns; a bare floor takes the typed phrase", { timeout: 300_000 }, async () => {
  const context = await browser.newContext();
  const lines: string[] = [];
  context.on("console", (m) => lines.push(m.text()));
  context.on("page", (p) => p.on("worker", (w) => w.on("console", (m) => lines.push(m.text()))));
  const faults: string[] = [];
  const wrongGuess = "a wrong but secret guess";
  /** Type one answer into the reset ceremony and wait for the gate's refusal by name. */
  const refusedBy = async (rite: Page, typed: string): Promise<string> => {
    await rite.evaluate(() => { delete document.body.dataset["gate"]; });
    await rite.locator("#ceremony-pass").fill(typed);
    await rite.locator("#ceremony-go").click();
    await rite.waitForFunction(() => document.body.dataset["gate"] !== undefined, undefined, { timeout: WAIT });
    return rite.evaluate(() => document.body.dataset["gate"] ?? "");
  };
  try {
    // FOUND a face through the ceremony (this tab alone answers with the published test route), then leave: the vessel locks.
    const founder = await context.newPage();
    founder.on("pageerror", (e) => faults.push(`[founder] ${e.message}`));
    await armTestCustody(founder, "gate");
    await founder.goto(`${baseUrl}/`);
    await live(founder);
    await Promise.all([founder.waitForEvent("load"), founder.locator("#found-face").click()]);
    await live(founder);
    const founded = await keyOf(founder);
    assert.equal((await vault(founder)).data?.custody?.place?.reading, "sealed", "the founding bound this browser's first passphrase");
    await founder.close();

    // A FRESH TAB nobody unlocks: the vessel asks its unlock and stands locked.
    const page = await context.newPage();
    page.on("pageerror", (e) => faults.push(`[page] ${e.message}`));
    await page.goto(`${baseUrl}/`);
    await page.waitForSelector(".ceremony-ask[data-ask=\"unlock\"]", { timeout: WAIT });
    const locked = await vault(page);
    // CONTROL: the place rests sealed and this tab's session holds no unlock.
    assert.deepEqual({ place: locked.data?.custody?.place?.reading, unlocked: locked.data?.door?.unlocked, faces: locked.data?.custody?.faces?.length }, { place: "sealed", unlocked: false, faces: 1 });

    // ONE ASK, TWO DOORS: the page's own control raises it, and the console door answers the standing ask's id.
    await page.locator("#reset-vessel").click();
    await page.waitForSelector(".ceremony-ask[data-ask=\"reset\"]", { timeout: WAIT });
    const askId = await page.locator(".ceremony-ask[data-ask=\"reset\"]").getAttribute("data-ask-id") ?? "";
    const asked = await lares(page, "vessel", "reset");
    assert.equal(asked.data?.askId, askId, "the console door answers the ask the page's control raised");
    assert.equal(await page.locator(".ceremony-ask[data-ask=\"reset\"]").count(), 1);
    assert.doesNotMatch(JSON.stringify(asked), /sealed|locked|unlocked/, "the door's answer names no custody standing");
    const record = await page.evaluate((id) => localStorage.getItem(`lares:reset-ask:${id}`), askId);
    assert.equal(record, "raised", "the ask record names the ask and nothing else");

    // K6b — THE CEREMONY REFUSES AN OPENER. A script of the page opens the ceremony itself, without `noopener`, so it holds
    // a handle to a same-origin window. The ceremony names the refusal and paints no field; what gets typed reaches nothing
    // the opener reads. (The harness types the published test route; no line prints it.)
    for (const hash of [`#reset=${askId}`, "#ask=0f8fad5b-d9cb-469f-a165-70867728950e"]) {
      const [held] = await Promise.all([context.waitForEvent("page"), page.evaluate((h) => { (window as unknown as { __larHeld: Window | null }).__larHeld = window.open(`/ceremony.html${h}`, "_blank"); }, hash)]);
      await held.waitForFunction(() => document.body.dataset["refusal"] !== undefined || document.getElementById("ceremony-form")?.hidden === false, undefined, { timeout: WAIT });
      const stood = await held.evaluate(() => ({ refusal: document.body.dataset["refusal"] ?? null, formHidden: document.getElementById("ceremony-form")?.hidden === true, opener: window.opener !== null }));
      // The person types anyway, wherever a field would take it.
      await held.evaluate((typed) => { const field = document.getElementById("ceremony-pass") as HTMLInputElement | null; const form = document.getElementById("ceremony-form"); if (field && form && !form.hidden) field.value = typed; }, TEST_PASSPHRASE);
      const pageRead = await page.evaluate(() => { const w = (window as unknown as { __larHeld: Window | null }).__larHeld; try { return (w?.document.getElementById("ceremony-pass") as HTMLInputElement | null)?.value ?? ""; } catch { return ""; } });
      assert.equal(stood.opener, true, `CONTROL: the window the page's script opened carries its opener (${hash.slice(0, 6)})`);
      assert.equal(pageRead === TEST_PASSPHRASE, false, `K6b: the opener read what was typed into the ceremony's field (${hash.slice(0, 6)})`);
      assert.deepEqual({ refusal: stood.refusal, formHidden: stood.formHidden }, { refusal: "ceremony-has-opener", formHidden: true }, `K6b: a ceremony with an opener refuses by name and paints no field (${hash.slice(0, 6)})`);
      await held.close();
    }
    assert.equal((await vault(page)).data?.custody?.place?.reading, "sealed", "the refused ceremonies burned nothing");

    const [rite] = await Promise.all([context.waitForEvent("page"), page.locator(".ceremony-ask[data-ask=\"reset\"] button.ceremony-open").first().click()]);
    rite.on("pageerror", (e) => faults.push(`[rite] ${e.message}`));
    await rite.waitForSelector("#ceremony-form:not([hidden])", { timeout: WAIT });
    assert.deepEqual(await rite.evaluate(() => ({ demand: (document.getElementById("ceremony-form") as HTMLFormElement).dataset["demand"], type: (document.getElementById("ceremony-pass") as HTMLInputElement).type })),
      { demand: "passphrase", type: "password" }, "custody stands, so the gate asks a passphrase");
    console.log(`[K6-walk] the ask: ${await rite.locator("#ceremony-label").innerText()}`);

    // THE TYPED PHRASE ALONE, then A WRONG PASSPHRASE: each refuses by name, the form stands, and nothing burned.
    assert.equal(await refusedBy(rite, "reset this browser"), "no-slot-opens");
    assert.equal(await refusedBy(rite, wrongGuess), "no-slot-opens");
    console.log(`[K6-walk] the refusal: ${await rite.locator("#ceremony-state").innerText()}`);
    assert.equal(await rite.locator("#ceremony-form").isVisible(), true, "the ask still stands after a wrong passphrase");
    const still = await vault(page);
    assert.deepEqual({ place: still.data?.custody?.place?.reading, faces: still.data?.custody?.faces?.length }, { place: "sealed", faces: 1 }, "two refusals burned nothing: the place rests sealed with its face");
    assert.equal(await page.locator(".ceremony-ask[data-ask=\"reset\"]").count(), 1, "the page still shows the ask");

    // THE RIGHT PASSPHRASE burns the place, and the tab boots afresh at an anon floor.
    await rite.locator("#ceremony-pass").fill(TEST_PASSPHRASE);
    await Promise.all([page.waitForEvent("load", { timeout: WAIT }), rite.locator("#ceremony-go").click()]);
    await live(page);
    const floor = await keyOf(page);
    assert.notEqual(floor, founded, "the burn landed: the vessel stands under a new veil key");
    const bare = await vault(page);
    assert.deepEqual({ place: bare.data?.custody?.place?.reading, faces: bare.data?.custody?.faces }, { place: "clear", faces: [] }, "the fresh floor holds no custody and no face");
    console.log(`[K6-walk] the post-reset boot: ${JSON.stringify({ standing: bare.data?.door?.standing, place: bare.data?.custody?.place, faces: bare.data?.custody?.faces, key: floor })}`);

    // A BARE FLOOR takes the typed phrase: the console door raises the ask, and the phrase alone burns.
    const again = (await lares(page, "vessel", "reset")).data?.askId ?? "";
    const [second] = await Promise.all([context.waitForEvent("page"), page.locator(".ceremony-ask[data-ask=\"reset\"] button.ceremony-open").first().click()]);
    await second.waitForSelector("#ceremony-form:not([hidden])", { timeout: WAIT });
    assert.equal(new URL(second.url()).hash, `#reset=${again}`);
    assert.deepEqual(await second.evaluate(() => ({ demand: (document.getElementById("ceremony-form") as HTMLFormElement).dataset["demand"], type: (document.getElementById("ceremony-pass") as HTMLInputElement).type })),
      { demand: "typed-phrase", type: "text" }, "no custody stands, so the gate asks the typed phrase");
    assert.equal(await refusedBy(second, "reset"), "gate-words-differ");
    await second.locator("#ceremony-pass").fill("reset this browser");
    await Promise.all([page.waitForEvent("load", { timeout: WAIT }), second.locator("#ceremony-go").click()]);
    await live(page);
    assert.notEqual(await keyOf(page), floor, "the typed phrase burned the bare floor: a new key again");

    // NO SECRET IN ANY LINE: every page's and worker's console, across the founding, both gates and both burns.
    for (const secret of [TEST_PASSPHRASE, wrongGuess]) assert.equal(lines.filter((l) => l.includes(secret)).length, 0, "no console line carries a byte typed into the gate");
    assert.ok(lines.length > 0, "CONTROL: the console instrument read lines");
    assert.deepEqual(faults, [], "no page error through the gate and the burns");
  } finally { await context.close(); }
});
