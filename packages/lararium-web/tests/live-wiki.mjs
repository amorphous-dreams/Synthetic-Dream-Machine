#!/usr/bin/env node
/**
 * live-wiki — the shore walk: a served page in real Chromium against a standing node.
 *
 * Run each walk through the host driver, which answers every fresh profile's admit request:
 *
 *   info=$(tools/browser-ci.sh info)                       # gateKey, wikiDoc.url
 *   LIVE_WIKI_CROSSING_URL=http://localhost:4321/ LIVE_WIKI_GATE_PUBKEY=<info.gateKey> LIVE_WIKI_NODE_DOC=<info.wikiDoc.url> \
 *     tools/browser-ci.sh qa-admit node packages/lararium-web/tests/live-wiki.mjs <walk>
 *
 *   crossing           rung 0: a wrong pin names the unreachable gate; the right pin stays silent until a
 *                      host-issued admit lands, then shows the proven gate key; the daemon surface summons
 *   render-aki         rung 1: the admitted leaf mounts the node's wiki document, opens Lady Aki (ingested into
 *                      the node's default bag first), and shows her title, the typed field at 2 in the standard
 *                      field editor, an ahu section with its heading and a followed lar: link.
 *                      CONTROL: a title never ingested reads absent by name
 *   edit-aki           rung 2, the page half: 2 -> 3 through the standard field editor, saved and read back; no
 *                      refusal stands on the alert rail; the SAME profile, reloaded, reads 3 from its own store
 *   fresh-profile-aki  rung 2, the far half: a new profile with its own key and admit reads the stored field
 *                      (LIVE_WIKI_EXPECT_LEVEL, default 3)
 *
 * WHERE THE SAVE LANDS. A saved edit lands in the wiki's WORKING layer; canon moves only by a residency move.
 * So the host reads the node AS THE WIKI between walks (`browser-ci.sh get <aki> --recipe lares` reads 3) and
 * reads the canon bag as the control (`browser-ci.sh get <aki> --bag lares` reads 2 until someone promotes it),
 * with a `restart` between. A walk asserts only what its page shows. LIVE_WIKI_TRACE=1 prints the page's vessel
 * console lines after each walk.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { requestAdmit } from "../../../tools/browser-ci-admit.mjs";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be supplied by the standing-vessel fixture`);
  return value;
}

/**
 * The crossing URL: the served origin plus the gate pin. The page derives its relay from the origin that
 * served it, so the walk names no relay.
 */
function withGate(source, gate) {
  const url = new URL(source);
  return `${url.origin}${url.pathname}?gate=${gate}`;
}

/** Load a crossing URL and require the vessel's own page; a refused or foreign answer names itself. */
async function open(page, url) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, `the node serves the vessel page at ${url} (answered ${response?.status()} ${(await response?.text().catch(() => ""))?.slice(0, 80)})`);
  assert.equal(await page.locator("#phases").count(), 1, `the document at ${url} carries the vessel's boot panel`);
}

async function waitForLive(page) {
  await page.waitForFunction(() => {
    const failed = document.querySelector("#status")?.textContent ?? "";
    return failed.startsWith("boot failed:") || [...document.querySelectorAll("#phases .phase")]
      .some((phase) => phase.textContent === "live");
  }, undefined, { timeout: 60_000 });
  const failed = (await page.locator("#status").textContent({ timeout: 500 }).catch(() => "")) ?? "";
  if (failed.startsWith("boot failed:")) throw new Error(`the browser vessel stopped at boot: ${failed}`);
}

async function readConnection(page) {
  return (await page.locator('[data-live-status="connection"]').textContent()) ?? "";
}

/** The face binding the vessel persisted, read from its own store. */
async function persistedFace(page) {
  return page.evaluate(async () => {
    const db = await new Promise((ok, no) => { const r = indexedDB.open("lares:vessel"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
    try {
      if (!db.objectStoreNames.contains("bootstrap")) return null;
      return await new Promise((ok, no) => {
        const r = db.transaction("bootstrap", "readonly").objectStore("bootstrap").get("social-bootstrap");
        r.onsuccess = () => ok(r.result ?? null); r.onerror = () => no(r.error);
      });
    } finally { db.close(); }
  });
}

/**
 * Rung 0, as every walk enters: silence before admission, a host-issued admit for THIS profile's key, then the
 * proven gate key and the mounted document, both read as data off the connection row.
 */
async function admit(page, vesselUrl, gatePubKey) {
  await open(page, withGate(vesselUrl, gatePubKey));
  await waitForLive(page);
  // The gate answers an unvouched leaf with silence, and silence has no single face on the page: the row reads
  // pinned or authenticating while the dial stands, and gate-unreachable once the silent socket closes. The
  // invariant holds in all three: no session, no verdict from a peer, no proven gate key.
  const connectionBeforeAdmit = await readConnection(page);
  assert.match(connectionBeforeAdmit, /^(authenticating|gate pinned|gate-unreachable — )/,
    `the unvouched leaf meets silence at the gate (row read "${connectionBeforeAdmit}")`);
  assert.equal(await page.locator('[data-live-status="connection"]').getAttribute("data-gate-key"), null,
    "before admission the row names no proven gate key");

  const browserKey = (await page.locator("#vessel-key").textContent())?.trim();
  assert.match(browserKey ?? "", /^[0-9a-f]{64}$/, "the page prints the joinee key for the host admit door");
  const carriage = (await requestAdmit(browserKey, { timeoutMs: 60_000 })).trim();
  assert.match(carriage, /^#admit=\S+/, "the host fixture supplies the node-issued admit carriage to the QA runner");
  const admitted = JSON.parse(Buffer.from(carriage.slice("#admit=".length), "base64url").toString("utf8"));
  // A taken admit stashes the carriage and RELOADS the page; the marker below dies with the old document, so
  // the walk reads the re-entered boot and never the standing one.
  await page.evaluate(() => { globalThis.__walkBeforeAdmit = true; });
  await page.locator("#admit-paste").fill(carriage);
  await page.locator("#admit-apply").click();
  await page.waitForFunction(() => {
    if (globalThis.__walkBeforeAdmit === true) {
      return (document.querySelector("#admit-status")?.textContent ?? "").startsWith("\u2717");
    }
    const failed = document.querySelector("#status")?.textContent ?? "";
    return failed.startsWith("boot failed:") || [...document.querySelectorAll("#phases .phase")]
      .some((phase) => phase.textContent === "live");
  }, undefined, { timeout: 90_000 });
  const stop = await page.evaluate(() => globalThis.__walkBeforeAdmit === true
    ? document.querySelector("#admit-status")?.textContent ?? ""
    : document.querySelector("#status")?.textContent ?? "");
  if (stop.startsWith("\u2717") || stop.startsWith("boot failed:")) throw new Error(`browser admit stop: ${stop}`);
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-live-status="connection"]')?.textContent ?? "";
    return text.includes("connected — gate");
  }, undefined, { timeout: 60_000 });

  // The admit was TAKEN: the vessel persisted the face binding the carriage named.
  const face = await persistedFace(page);
  assert.equal(face?.personaKelPrefix, admitted.personaKelPrefix, "the vessel persisted the carried persona-KEL prefix");
  assert.equal(face?.signerDid, admitted.signerDid, "the vessel persisted the carried signer");
  assert.equal(face?.personaUrl, admitted.personaUrl, "the vessel persisted the carried persona plane");

  // The row publishes what it proved and what it mounted as data; the walk reads those, never the prose.
  const shown = await page.locator('[data-live-status="connection"]').evaluate((row) => ({
    gateKey: row.getAttribute("data-gate-key"),
    wikiDocUrl: row.getAttribute("data-wiki-doc-url"),
  }));
  assert.equal(shown.gateKey, gatePubKey.toLowerCase(), "the connection row names the gate key the relay proved");
  assert.match(shown.wikiDocUrl ?? "", /^automerge:/, "the connection row names the mounted wiki document");
  const nodeWikiDoc = process.env.LIVE_WIKI_NODE_DOC;
  if (nodeWikiDoc) {
    assert.equal(shown.wikiDocUrl, nodeWikiDoc,
      `the admitted leaf mounts the node's wiki document (leaf ${shown.wikiDocUrl ?? "(unreported)"}, node ${nodeWikiDoc})`);
  }
  return { ...shown, deviceKey: browserKey };
}

/** What the page said while the walk ran: the vessel's own console lines, kept for a failed walk's report. */
const TRACE = /\[vessel\]|\[face-join\]|\[lararium-browser\]|\[browser-genesis\]|\[wiki-worker\]|\[dyad\]|\[daemon/;

async function withBrowser(run) {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const trace = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/\[wiki-worker\] (error|stale-target)|CapabilityRefused|surface-unknown/.test(text)) errors.push(text);
    if (TRACE.test(text) || message.type() === "error") trace.push(`[${message.type()}] ${text}`);
  });
  page.on("pageerror", (error) => errors.push(`[page] ${error.message}`));
  page.on("crash", () => errors.push("[page] the renderer crashed"));
  const printTrace = () => { if (process.env.LIVE_WIKI_TRACE === "1") for (const line of trace.slice(-200)) console.error(line.slice(0, 600)); };
  try {
    await run(page, errors);
    printTrace();
  } catch (error) {
    // A failed walk reports what the page showed and said, so the stop names itself.
    const shown = await page.evaluate(() => ({
      vessel: document.querySelector("#vessel")?.innerText ?? "(no vessel panel)",
      projection: (document.querySelector("#projection")?.shadowRoot?.querySelector(".lar-projection")?.textContent ?? "(no projection)")
        .replace(/\s+/g, " ").slice(0, 1200),
    })).catch((e) => ({ vessel: `(unreadable: ${String(e)})`, projection: "" }));
    console.error(`walk stop — url=${page.url()}\nvessel panel:\n${shown.vessel}\nprojection: ${shown.projection}`);
    printTrace();
    for (const line of errors) console.error(line);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function crossing() {
  const vesselUrl = required("LIVE_WIKI_CROSSING_URL");
  const gatePubKey = required("LIVE_WIKI_GATE_PUBKEY");
  await withBrowser(async (page) => {
    await open(page, withGate(vesselUrl, "00".repeat(32)));
    await page.waitForFunction(() => (document.querySelector('[data-live-status="connection"]')?.textContent ?? "")
      .startsWith("gate-unreachable — "), undefined, { timeout: 90_000 });
    const refusal = await readConnection(page);
    assert.match(refusal, /^gate-unreachable — .+/, "a wrong pin names the local unreachable gate without inventing a peer verdict");
    console.log(`wrong-pin OK — local ${refusal}`);
  });

  await withBrowser(async (page, errors) => {
    const mount = await admit(page, vesselUrl, gatePubKey);
    const origin = new URL(page.url()).origin;
    const rowValue = (label) => page.locator(`#vessel .row:has(> .k:text-is("${label}")) > .v`).innerText();
    assert.equal(await rowValue("origin"), origin, "the served page names its actual origin");
    assert.equal(await rowValue("relay"), `ws://${new URL(origin).host}/ws`, "the page derives its relay from the origin that served it");
    // Both islands booted in real Chromium: the wiki worker painted the projection the admit read, and the
    // daemon worker paints its surface on the summon (a surface whose revisions count from its own start).
    assert.ok(await page.locator("#projection .tc-site-title").count(), "the wiki island painted its page template");
    await page.locator("#summon-daemon").click();
    await page.waitForFunction(() => document.querySelector("#projection")?.shadowRoot
      ?.querySelector(".lar-projection")?.textContent?.includes("daemon · Working Surface") ?? false,
      undefined, { timeout: 30_000 });
    assert.deepEqual(errors, [], "the crossing emits zero page errors, worker errors or refusals");
    console.log(`crossing OK — served ${origin}; device ${mount.deviceKey} admitted; gate ${mount.gateKey} proven; mount ${mount.wikiDocUrl}; wiki and daemon islands both painted`);
  });
}

/** The carrier the node ingested, by the title TiddlyWiki holds it under. */
const AKI = "lar:///ha.ka.ba/elyncia/characters/primary-characters/lady-aki";
/** A sibling carrier the repo holds and no walk ingests: the absent-by-name control. */
const NEVER_INGESTED = "lar:///ha.ka.ba/elyncia/characters/primary-characters/lady-aki-concept-art";
const LEVEL_FIELD = "sdm-character-level";
const FOLLOWED = "lar:///ha.ka.ba/elyncia/concepts/grandmother-spider";

const viewFrame = (page, title) => page.locator(`#projection .tc-tiddler-view-frame[data-tiddler-title="${title}"]`);
const editFrame = (page, title) => page.locator(`#projection .tc-tiddler-edit-frame[data-tiddler-title="Draft of '${title}'"]`);

/** Type a term into TiddlyWiki's sidebar search and open its result dropdown. */
async function search(page, term) {
  const wiki = page.locator("#projection");
  await wiki.locator('input[type="search"]').fill(term);
  await wiki.locator("button").filter({ hasText: "matches" }).first().click();
  const dropdown = wiki.locator(".tc-search-drop-down");
  await dropdown.waitFor({ state: "visible", timeout: 30_000 });
  return dropdown;
}

/** Open Aki through the search a person would use, and wait for her view frame. */
async function openAki(page) {
  const dropdown = await search(page, "lady-aki");
  await dropdown.getByText(AKI, { exact: true }).first().click();
  await viewFrame(page, AKI).waitFor({ state: "visible", timeout: 30_000 });
}

/** Open Aki's draft in the standard edit template and answer the typed field's input. */
async function openLevelEditor(page) {
  await viewFrame(page, AKI).locator('button[title="Edit this tiddler"]').click();
  const level = editFrame(page, AKI).locator("tr.tc-edit-field").filter({ hasText: `${LEVEL_FIELD}:` })
    .locator("input.tc-edit-fieldeditor");
  await level.waitFor({ state: "visible", timeout: 30_000 });
  return level;
}

/** How many unrouted-save refusals the projected page shows on TiddlyWiki's alert rail. */
const unroutedAlerts = (page) => page.locator("#projection .tc-alert").filter({ hasText: "Nothing you save here reaches a bag" }).count();

async function renderAki() {
  const vesselUrl = required("LIVE_WIKI_CROSSING_URL");
  const gatePubKey = required("LIVE_WIKI_GATE_PUBKEY");
  await withBrowser(async (page, errors) => {
    const mount = await admit(page, vesselUrl, gatePubKey);
    await openAki(page);
    const shown = await viewFrame(page, AKI).evaluate((frame) => ({
      title: frame.querySelector(".tc-title")?.textContent?.trim() ?? "",
      sheet: frame.querySelector(".tc-tiddler-body h1")?.textContent?.trim() ?? "",
      ahu: [...frame.querySelectorAll("section.lar-ahu")].map((section) => ({
        uri: section.getAttribute("data-uri"),
        heading: section.querySelector("h1, h2, h3, h4")?.textContent?.trim() ?? "",
      })),
    }));
    assert.equal(shown.title, AKI, "the view frame carries Aki's title");
    assert.equal(shown.sheet, "Lady Aki — Character Sheet", "her sheet's own heading renders");
    const origin = shown.ahu.find((section) => section.uri === `${AKI}#/origin`);
    assert.ok(origin, "the #/origin ahu renders as its own section");
    assert.match(origin.heading, /^Origin/, "the ahu carries its heading");

    const level = await openLevelEditor(page);
    assert.equal(await level.inputValue(), "2", `the typed field ${LEVEL_FIELD} reads 2 in the standard field editor`);
    await editFrame(page, AKI).locator('button[title="Discard changes to this tiddler"]').click();
    await viewFrame(page, AKI).waitFor({ state: "visible", timeout: 30_000 });

    // The followed lar: link — a click on the projected anchor navigates the wiki, never the host page.
    const before = page.url();
    await viewFrame(page, AKI).locator("a.tc-tiddlylink").filter({ hasText: "grandmother-spider" }).first().click();
    const followed = page.locator(`#projection .tc-tiddler-frame[data-tiddler-title="${FOLLOWED}"]`);
    await followed.waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(page.url(), before, "the host page stays where it stood");

    // CONTROL: a title never ingested reads absent by name, in the same wiki that just found Aki.
    const absent = await search(page, "lady-aki-concept-art");
    await page.waitForFunction(() => {
      const root = document.querySelector("#projection")?.shadowRoot;
      const count = [...(root?.querySelectorAll("button") ?? [])].find((b) => /\bmatches\b/.test(b.textContent ?? ""));
      return /^\s*0 matches/.test(count?.textContent ?? "");
    }, undefined, { timeout: 30_000 });
    assert.equal(await absent.getByText(NEVER_INGESTED, { exact: true }).count(), 0, "the never-ingested title has no result row");
    assert.match((await absent.textContent()) ?? "", /No search result/, "TiddlyWiki names the absence");

    assert.deepEqual(errors, [], "the Aki render emits zero page or wiki-worker errors");
    console.log(`render-aki OK — mount ${mount.wikiDocUrl}; title ${shown.title}; ${LEVEL_FIELD}=2; ahu "${origin.heading}"; followed ${FOLLOWED}; control ${NEVER_INGESTED} absent (0 matches)`);
  });
}

async function editAki() {
  const vesselUrl = required("LIVE_WIKI_CROSSING_URL");
  const gatePubKey = required("LIVE_WIKI_GATE_PUBKEY");
  await withBrowser(async (page, errors) => {
    await admit(page, vesselUrl, gatePubKey);
    await openAki(page);
    const level = await openLevelEditor(page);
    assert.equal(await level.inputValue(), "2", "the typed field begins at 2");
    await level.fill("3");
    await editFrame(page, AKI).locator('button[title="Confirm changes to this tiddler"]').click();
    await viewFrame(page, AKI).waitFor({ state: "visible", timeout: 30_000 });
    const reopened = await openLevelEditor(page);
    assert.equal(await reopened.inputValue(), "3", "the standard editor reads back the saved field");
    await editFrame(page, AKI).locator('button[title="Discard changes to this tiddler"]').click();
    await viewFrame(page, AKI).waitFor({ state: "visible", timeout: 30_000 });
    // A save with no bag to land in refuses by name on the alert rail; a save that landed raises nothing.
    assert.equal(await unroutedAlerts(page), 0, "no save stands refused on the alert rail");
    // The save left the wiki island for the working layer. This bounded pause only lets the capture debounce
    // and the store's write settle before the page goes; the reload below carries the verdict.
    await page.waitForTimeout(3_000);

    // The SAME profile, reloaded: the wiki island boots from this vessel's own store and reads the saved field.
    await open(page, withGate(vesselUrl, gatePubKey));
    await waitForLive(page);
    await openAki(page);
    const afterReload = await openLevelEditor(page);
    assert.equal(await afterReload.inputValue(), "3", "the reloaded profile reads the saved field from its own working layer");
    await editFrame(page, AKI).locator('button[title="Discard changes to this tiddler"]').click();
    await viewFrame(page, AKI).waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await unroutedAlerts(page), 0, "the reloaded wiki raises no refusal");
    await page.waitForTimeout(3_000);
    assert.deepEqual(errors, [], "editing Aki emits zero page or wiki-worker errors");
    console.log(`edit-aki OK — ${LEVEL_FIELD} saved 2 -> 3 through the standard field editor; no refusal on the alert rail; the reloaded profile reads 3`);
  });
}

async function freshProfileAki() {
  const vesselUrl = required("LIVE_WIKI_CROSSING_URL");
  const gatePubKey = required("LIVE_WIKI_GATE_PUBKEY");
  const expected = process.env.LIVE_WIKI_EXPECT_LEVEL ?? "3";
  await withBrowser(async (page, errors) => {
    const mount = await admit(page, vesselUrl, gatePubKey);
    await openAki(page);
    const level = await openLevelEditor(page);
    assert.equal(await level.inputValue(), expected, `a fresh browser profile reads the stored typed field at ${expected}`);
    assert.deepEqual(errors, [], "the fresh-profile read emits zero page or wiki-worker errors");
    console.log(`fresh-profile-aki OK — a newly admitted profile (mount ${mount.wikiDocUrl}) reads ${LEVEL_FIELD}=${expected}`);
  });
}

const command = process.argv[2];
if (command === "crossing") await crossing();
else if (command === "render-aki") await renderAki();
else if (command === "edit-aki") await editAki();
else if (command === "fresh-profile-aki") await freshProfileAki();
else {
  console.error("usage: node packages/lararium-web/tests/live-wiki.mjs crossing|render-aki|edit-aki|fresh-profile-aki");
  process.exitCode = 2;
}
