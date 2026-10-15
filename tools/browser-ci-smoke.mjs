/**
 * browser-ci smoke: the page the node serves boots a vessel in the runner's Chromium.
 * Run through the runner: `tools/browser-ci.sh qa node tools/browser-ci-smoke.mjs`.
 *
 * Two named refusals, each with exit 1:
 *   InsecureContext  the page reads isSecureContext !== true (a browser withholds Web Locks and crypto.subtle there)
 *   VesselNotLive    the vessel panel's status row never reads "live — …"; the row's own text prints
 * `join` mode (`tools/browser-ci.sh qa-join node tools/browser-ci-smoke.mjs join`): after the page boots, join the
 * node's face through the fleet-join door over the join exchange (the node offers, the page mints its request, the
 * node answers), paste the answer, and wait on DOM state. It prints `joined: …` with the status row when the vessel
 * reboots live on the face the answer named, else a named stop and exit 1:
 *   JoinRefused      the host or the page refused a leg of the exchange
 *   JoinNotTaken     the page's admit line or status row names a refusal; the page's own text prints
 * A timeout (SMOKE_TIMEOUT_MS, default 60000) only bounds the wait; the verdict reads DOM state.
 */
import { chromium } from "playwright";
import { joinThroughPage, pasteAnswer, JoinRefused } from "./browser-ci-join.mjs";

const URL_ = process.env.LARES_URL ?? "http://localhost:4321";
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS ?? 60000);

const statusRow = async (page) =>
  ((await page.locator(".row:has(> .k:text-is(\"status\")) > .v").first().textContent({ timeout: 1000 }).catch(() => null)) ?? "").trim();
const admitLine = async (page) => ((await page.locator("#admit-status").textContent({ timeout: 1000 }).catch(() => null)) ?? "").trim();

/** Join the node's face through the page's paste door, and report what the page did with the answer. */
async function join(page) {
  const params = new URL(URL_).searchParams;
  if (!params.has("relay") || !params.get("gate")) {
    console.error(`JoinNeedsCrossing: LARES_URL must pin ?relay=<ws url>&gate=<gate key> (browser-ci.sh info names both); got ${URL_}`);
    return 1;
  }
  const key = (await page.locator("#vessel-key").innerText()).trim();
  let answer;
  try { ({ answer } = await joinThroughPage(page, { timeoutMs: TIMEOUT })); }
  catch (e) { if (e instanceof JoinRefused) { console.error(`${e.message} (device=${key})`); return 1; } throw e; }
  await page.evaluate(() => { globalThis.__smokeBeforeLand = true; });
  await pasteAnswer(page, answer);
  // A landed answer stashes the admit it carries and RELOADS the page; a refused paste names itself in the admit line and stays.
  // Each poll reads afresh and survives the context swap; the marker set above is gone once the page reloaded.
  const deadline = Date.now() + TIMEOUT;
  let reloaded = false, line = "";
  while (Date.now() < deadline && !reloaded) {
    reloaded = (await page.evaluate(() => globalThis.__smokeBeforeLand !== true).catch(() => false));
    if (!reloaded) {
      line = await admitLine(page);
      if (line.startsWith("\u2717")) { console.error(`JoinNotTaken: device=${key} admit-line="${line}"`); return 1; }
      await page.waitForTimeout(250);
    }
  }
  if (!reloaded) { console.error(`JoinNotTaken: device=${key} the page never re-entered boot; admit-line="${line}"`); return 1; }
  let row = "";
  while (Date.now() < deadline) {
    row = await statusRow(page);
    if (row.startsWith("live") || row.includes("boot failed:")) break;
    await page.waitForTimeout(250);
  }
  if (!row.startsWith("live")) { console.error(`JoinNotTaken: device=${key} status="${row}"`); return 1; }
  // The face the page persisted must match the one the answer's device edge named (the join TOOK, beyond a bare landing).
  const edge = answer.edge;
  const joined = await page.evaluate(async () => {
    const db = await new Promise((ok, no) => { const r = indexedDB.open("lares:vessel"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
    try {
      if (!db.objectStoreNames.contains("bootstrap")) return null;
      return await new Promise((ok, no) => { const r = db.transaction("bootstrap", "readonly").objectStore("bootstrap").get("social-bootstrap"); r.onsuccess = () => ok(r.result ?? null); r.onerror = () => no(r.error); });
    } finally { db.close(); }
  }).catch(() => null);
  const faceJoined = joined?.personaKelPrefix === edge.personaKelPrefix && joined?.signerDid === edge.signerDid;
  if (!faceJoined) { console.error(`JoinNotTaken: device=${key} status="${row}" the page persisted no face binding matching the answer`); for (const t of trace) console.error(t); return 1; }
  // The connection row (a page build that paints one) reads connected or names a refusal; a build without it reports none.
  const connection = async () => ((await page.locator('[data-live-status="connection"]').textContent({ timeout: 500 }).catch(() => null)) ?? "").trim();
  const graceEnd = Date.now() + 5000;
  let conn = "";
  while (Date.now() < deadline) {
    conn = await connection();
    if (/^connected/.test(conn) || /gate-unreachable|disconnected|refus|denied/i.test(conn)) break;
    if (conn === "" && Date.now() > graceEnd) break;
    await page.waitForTimeout(250);
  }
  if (/^connected/.test(conn)) { console.log(`joined: device=${key} status="${row}" face=joined connection="${conn}"`); return 0; }
  if (conn === "") { console.log(`joined: device=${key} status="${row}" face=joined connection=unreported (this page build paints no connection row)`); return 0; }
  console.error(`JoinNotTaken: device=${key} status="${row}" connection="${conn}"`);
  return 1;
}

const trace = [];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
let code = 0;
try {
  const page = await browser.newPage();
  page.on("console", (m) => { if (/\[vessel\]|\[face-join\]|\[lararium-browser\]|\[dyad\]/.test(m.text())) trace.push(m.text()); });
  await page.goto(URL_, { waitUntil: "domcontentloaded" });
  const secure = await page.evaluate(() => globalThis.isSecureContext);
  if (secure !== true) {
    console.error(`InsecureContext: ${URL_} reads isSecureContext=${String(secure)}`);
    code = 1;
  } else {
    // The arrival page may reload under us; each poll reads the row afresh and survives a context swap.
    const deadline = Date.now() + TIMEOUT;
    let row = "";
    while (Date.now() < deadline) {
      row = ((await page.locator(".row:has(> .k:text-is(\"status\")) > .v").first().textContent({ timeout: 1000 }).catch(() => null)) ?? "").trim();
      if (row.startsWith("live") || row.includes("boot failed:")) break;
      await page.waitForTimeout(250);
    }
    if (!row.startsWith("live")) {
      console.error(`VesselNotLive: status row reads "${row}"`);
      code = 1;
    } else {
      console.log(`live: ${URL_} isSecureContext=true status="${row}"`);
      if (process.argv[2] === "join") code = await join(page);
    }
  }
} finally {
  await browser.close();
}
process.exit(code);
