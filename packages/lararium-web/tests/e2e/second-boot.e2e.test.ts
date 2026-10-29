/**
 * e2e/second-boot — A BROWSER VESSEL THAT STANDS AGAIN WRITES NOTHING NEW INTO ITS STORE.
 *
 * Three boots of one browser vessel on one origin (a reload each). The law the pin reads: a boot adds no content
 * head to any Document the store holds, mints no Document, and leaves no durable sync row for a peer that will not
 * return. Compaction is maintenance and stays lawful: the pin reads each Document's HEADS (what the chunks load
 * to), never the chunk keys. A returning peer's sync rows stand lawful.
 *
 * The readings come off the real IndexedDB rows of the vessel's repo and daemon stores: every `documents` row
 * carries `[documentId, kind, id]`; `snapshot` and `incremental` chunks load to one Automerge document whose heads
 * are read here, `sync-state` rows name the peer storage id they rest for.
 *
 *   B1 — CONTROL: a saved edit between boots moves a Document's heads (the instrument reads a real write)
 *   B2 — the second and third boot hold every Document's heads, mint no Document, and add no peer row for a peer
 *        the second boot did not already hold
 *
 * The stand reads quiescence by its own event: two consecutive readings of the store that agree, taken after the
 * page reports live.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, test } from "vitest";
import { resolve } from "node:path";
import { chromium } from "playwright";
import * as A from "@automerge/automerge";
// The published test route answers the custody form a fresh vessel raises (a harness door; never a person's passphrase).
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";

const root = resolve(import.meta.dirname, "../../../..");
const port = Number(process.env.LAR_WEB_SECOND_BOOT_PORT ?? 5421);
const baseUrl = `http://127.0.0.1:${port}`;
let preview: ReturnType<typeof spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

beforeAll(async () => {
  preview = spawn(process.execPath, [
    resolve(root, "packages/lararium-web/node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1",
    "--port", String(port), "--strictPort",
  ], { cwd: resolve(root, "packages/lararium-web"), stdio: "ignore" });
  let last: unknown;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(baseUrl)).ok) { last = undefined; break; } } catch (error) { last = error; }
    await new Promise((r) => setTimeout(r, 125));
  }
  assert.equal(last, undefined, `built Pronaos preview did not open on ${baseUrl}`);
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => { await browser?.close(); preview?.kill("SIGTERM"); });

type Row = { readonly store: string; readonly key: readonly unknown[]; readonly bytes: number[] };
type Page = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>;

/** Every `documents` row of every IndexedDB database this origin holds. */
const dump = (page: Page): Promise<Row[]> => page.evaluate(async () => {
  const out: Array<{ store: string; key: unknown[]; bytes: number[] }> = [];
  for (const { name } of await indexedDB.databases()) {
    if (!name) continue;
    const db = await new Promise<IDBDatabase>((res, rej) => { const o = indexedDB.open(name); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
    try {
      if (!db.objectStoreNames.contains("documents")) continue;
      const rows = await new Promise<Array<{ key: unknown[]; binary: Uint8Array }>>((res, rej) => { const q = db.transaction("documents", "readonly").objectStore("documents").getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
      for (const r of rows) out.push({ store: name, key: r.key, bytes: [...r.binary] });
    } finally { db.close(); }
  }
  return out;
});

interface Reading { readonly heads: Map<string, string>; readonly peers: Set<string> }

/** Heads per Document (store plus document id) and the peer ids the sync rows rest for. */
function read(rows: readonly Row[]): Reading {
  const chunks = new Map<string, { snaps: Uint8Array[]; incs: Uint8Array[] }>();
  const peers = new Set<string>();
  for (const { store, key, bytes } of rows) {
    const [docId, kind, id] = key as [string, string, string];
    const k = `${store}|${docId}`;
    if (kind === "sync-state") { peers.add(String(id)); continue; }
    const c = chunks.get(k) ?? { snaps: [], incs: [] };
    if (kind === "snapshot") c.snaps.push(Uint8Array.from(bytes)); else if (kind === "incremental") c.incs.push(Uint8Array.from(bytes));
    chunks.set(k, c);
  }
  const heads = new Map<string, string>();
  for (const [k, { snaps, incs }] of chunks) {
    let doc = A.init();
    for (const c of [...snaps, ...incs]) doc = A.loadIncremental(doc, c);
    heads.set(k, JSON.stringify(A.getHeads(doc)));
  }
  return { heads, peers };
}

const live = (page: Page) => page.waitForFunction(() => [...document.querySelectorAll("#phases .phase")].some((p) => p.textContent === "live"), undefined, { timeout: 60_000 });

/** The signature a reading settles on: every Document's heads and every peer row. */
const signature = (r: Reading): string => JSON.stringify([[...r.heads].sort(), [...r.peers].sort()]);

/** The store once three readings a second apart agree on heads and peer rows: the boot has finished writing. */
async function settled(page: Page): Promise<Reading> {
  await live(page);
  let now = read(await dump(page));
  let agreed = 0;
  for (let look = 0; look < 60; look++) {
    await page.waitForTimeout(1000);
    const next = read(await dump(page));
    agreed = signature(next) === signature(now) ? agreed + 1 : 0;
    now = next;
    if (agreed >= 3) return now;
  }
  assert.fail("the store never settled inside 60 s");
}

const names = (m: Map<string, string>) => [...m.keys()].sort();

test("B1/B2 — a browser vessel's second and third boot hold every Document's heads, mint none and add no peer row; CONTROL: a saved edit moves heads", { timeout: 300_000 }, async () => {
  const context = await browser.newContext();
  await armTestCustody(context, "second-boot");
  const page = await context.newPage();
  const faults: string[] = [];
  page.on("pageerror", (e) => faults.push(`[page] ${e.message}`));
  try {
    await page.goto(baseUrl);
    const one = await settled(page);

    // CONTROL: a real edit through the page moves a Document's heads.
    const wiki = page.locator("#mirror");
    await wiki.evaluate((host) => (host.shadowRoot!.querySelector('button[title="Create a new tiddler"]') as HTMLElement).click());
    await wiki.locator("input.tc-titlebar").fill("Second Boot Control");
    await wiki.locator("textarea.tc-edit-texteditor-body").fill("the control writes between boots");
    await wiki.locator('button[title="Confirm changes to this tiddler"]').click();
    await page.waitForFunction(() => document.querySelector("#mirror")?.shadowRoot?.querySelector(".lar-mirror")?.textContent?.includes("Second Boot Control") ?? false, undefined, { timeout: 30_000 });
    const edited = await settled(page);
    const moved = [...edited.heads].filter(([k, h]) => one.heads.has(k) && one.heads.get(k) !== h).map(([k]) => k);
    assert.ok(moved.length > 0, "CONTROL: the saved edit moves the heads of a Document the first boot already held");

    await page.reload();
    const two = await settled(page);
    await page.reload();
    const three = await settled(page);

    for (const [label, before, after] of [["boot 2", edited, two], ["boot 3", two, three]] as const) {
      assert.deepEqual(names(after.heads), names(before.heads), `${label} mints no Document and drops none`);
      const drifted = [...after.heads].filter(([k, h]) => before.heads.get(k) !== h).map(([k]) => k);
      assert.deepEqual(drifted, [], `${label} adds no content head to any Document`);
    }
    for (const [label, before, after] of [["boot 2", edited, two], ["boot 3", two, three]] as const) {
      const fresh = [...after.peers].filter((p) => !before.peers.has(p));
      assert.deepEqual(fresh, [], `${label} rests no sync row for a peer the boot before did not already hold`);
    }
    assert.deepEqual(faults, [], "no page error in three boots");
  } finally { await context.close(); }
});
