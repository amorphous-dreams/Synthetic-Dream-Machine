/**
 * capability-probe control: drives the probe page in Chromium and asserts the instrument reads a KNOWN POSITIVE.
 * Run through the compose runner: docker compose -f docker-compose.capability-probe.yml --profile qa run --rm qa
 * Asserts: the report arrives at the server; every group's control-negative reads held; the named probes read granted;
 * a second page of the same context sees connectedPorts 2 with the SAME instance id; killing the owner yields a new
 * instance id and a higher owner epoch that every tab sees; the lifecycle check answers its nonce; the one-tab Web Lock
 * fallback refuses the second tab by name and grants it after the first closes. The passkey probe stays skipped
 * (no authenticator; the control never presses its button). Exit 0 green, 1 red with every red probe named.
 */
import { chromium } from "playwright";

const URL_ = process.env.PROBE_URL ?? "http://localhost:8080";
const MUST_GRANT = [
  "session.sharedworker", "session.sharedworker-module", "session.dedicated-worker", "session.port-chain", "session.locks-cross-context",
  "engine.wasm-sharedworker", "engine.wasm-dedicated-worker", "engine.wasm-instantiatestreaming", "engine.automerge-wasm",
  "persistence.idb-page", "persistence.idb-dedicated-worker", "persistence.idb-sharedworker", "persistence.opfs-contention-dedicated-worker", "persistence.sentinels",
  "custody.ed25519", "custody.aes-gcm", "wire.websocket-echo", "wire.subprotocol-carriage",
];
const red = [];
const check = (ok, what) => { console.log(`${ok ? "green" : "RED  "} ${what}`); if (!ok) red.push(what); };
const stage = async (name, fn) => { try { await fn(); } catch (e) { check(false, `${name}: ${e.message.split("\n")[0]}`); } };
const report = (page) => page.evaluate(() => window.__probe.report);
const waitReport = (page, pred, ms) => page.waitForFunction(`(() => { const r = window.__probe.report; return !!r && (${pred})(r); })()`, null, { timeout: ms });
const runPage = async (page) => { await page.goto(URL_); await page.locator("#run").click(); await waitReport(page, "r => r.kind === 'probe' && r.partial === false", 240000); return report(page); };

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext();
let r1 = null, r2 = null;
const page1 = await ctx.newPage();

await stage("first run", async () => {
  r1 = await runPage(page1);
  const byId = Object.fromEntries(Object.values(r1.groups).flat().map((p) => [p.id, p]));
  for (const [g, v] of Object.entries(r1.summary.controls)) check(v === "held", `${g}.control-negative: ${v}`);
  check(Object.keys(r1.summary.controls).length === 7, `seven groups carry a negative control (${Object.keys(r1.summary.controls).length})`);
  for (const id of MUST_GRANT) check(byId[id]?.verdict === "granted", `${id} reads granted${byId[id]?.verdict === "granted" ? "" : ` (got ${byId[id]?.verdict}: ${byId[id]?.detail})`}`);
  check(byId["custody.passkey-prf"]?.verdict === "skipped", "custody.passkey-prf reads skipped");
  check(r1.sharedWorker?.connectedPorts === 1, `first page sees connectedPorts 1 (${r1.sharedWorker?.connectedPorts})`);
  check(typeof r1.sharedWorker?.ownerEpoch === "number", `report carries an owner epoch (${r1.sharedWorker?.ownerEpoch})`);
  const list = await (await fetch(`${URL_}/reports`)).json();
  let finals = 0;
  for (const name of list) { const j = await (await fetch(`${URL_}/reports/${name}`)).json(); if (j.kind === "probe" && j.partial === false && j.tab === r1.tab) finals++; }
  check(finals === 1 && list.every((n) => /^\d+-[0-9a-f]{12}\.json$/.test(n)), `the final report arrived at the server under a counted, digested name (${list.join(", ")})`);
});

const page2 = await ctx.newPage();
await stage("second tab", async () => {
  r2 = await runPage(page2);
  check(r2.sharedWorker?.connectedPorts === 2, `second page sees connectedPorts 2 (${r2.sharedWorker?.connectedPorts})`);
  check(r2.sharedWorker?.instanceId === r1.sharedWorker?.instanceId, "second page sees the SAME worker instance id");
});

await stage("owner death", async () => {
  await page1.locator("#kill").click();
  await waitReport(page1, "r => r.kind === 'owner-death'", 60000);
  const d = await report(page1);
  check(d.instanceChanged === true, `killed owner is replaced by a new instance (${d.before.instanceId} -> ${d.after.instanceId})`);
  check(d.epochAdvanced === true, `owner epoch advanced (${d.before.ownerEpoch} -> ${d.after.ownerEpoch})`);
  await page2.waitForFunction("window.__probe && document.getElementById('status') !== null", null, { timeout: 5000 });
  await page2.waitForFunction(() => document.querySelector("#json") !== null, null, { timeout: 5000 });
  await page2.locator("#lifecycle").click();
  await waitReport(page2, "r => r.kind === 'lifecycle'", 30000);
  const l = await report(page2);
  check(l.ownerChanges?.some((c) => c.replaced) === true, "the other tab reconnected to the new owner by itself");
  check(l.nonces?.at(-1)?.final?.startsWith("replied"), `lifecycle nonce answered (${l.nonces?.at(-1)?.final})`);
  check(l.instanceChanged === true, "lifecycle check reports the worker instance changed since the first run");
});

await stage("one-tab lock fallback", async () => {
  const a = await ctx.newPage(), b = await ctx.newPage();
  await a.goto(`${URL_}/?owner=tab`); await b.goto(`${URL_}/?owner=tab`);
  await a.locator("#lock-take").click(); await waitReport(a, "r => r.stage === 'take'", 10000);
  check((await report(a)).groups["tab-lock"][0].verdict === "granted", "tab A takes the exclusive lock");
  await b.locator("#lock-try").click(); await waitReport(b, "r => r.stage === 'try'", 10000);
  const t = (await report(b)).groups["tab-lock"][0];
  check(t.verdict === "refused", `tab B's ifAvailable request is refused (${t.detail})`);
  await b.locator("#lock-wait").click(); await waitReport(b, "r => r.stage === 'wait-pending'", 10000);
  await a.close();
  await waitReport(b, "r => r.stage === 'wait-acquired'", 20000);
  check(true, "tab B acquires the lock after tab A closes");
});

await browser.close();
console.log(red.length ? `\nCONTROL RED (${red.length}):\n  ${red.join("\n  ")}` : "\nCONTROL GREEN");
process.exit(red.length ? 1 : 0);
