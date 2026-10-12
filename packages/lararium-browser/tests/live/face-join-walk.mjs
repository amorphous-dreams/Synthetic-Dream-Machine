/**
 * The live admitted-face walk. Run it with the host-owned browser-ci fixture:
 *
 *   export BROWSER_CI_PROJECT=cx-a BROWSER_CI_PORT=5471 BROWSER_CI_IMAGE=lares-browser-ci:cx-a
 *   LIVE_WIKI_NODE_INFO="$(tools/browser-ci.sh info)" \
 *   LARES_URL='http://localhost:4321?relay=ws://localhost:4321/ws&gate=<gate-key>' \
 *   tools/browser-ci.sh qa-admit node packages/lararium-browser/tests/live/face-join-walk.mjs edit
 *
 * Run through `browser-ci.sh qa-admit`; the host answers each fresh profile's key
 * through the one-shot carriage exchange. The QA container never receives Docker access.
 */
import { chromium } from "playwright";
import { AdmitRefused, requestAdmit } from "../../../../tools/browser-ci-admit.mjs";

const base = new URL(process.env.LARES_URL ?? "http://localhost:4321");
const gate = base.searchParams.get("gate");
const nodeInfo = JSON.parse(process.env.LIVE_WIKI_NODE_INFO ?? "null");
const mode = process.argv[2] ?? "edit";
const akiUri = process.env.LIVE_WIKI_AKI_URI
  ?? "lar:///ha.ka.ba/elyncia/characters/primary-characters/lady-aki";
if (!base.searchParams.has("relay") || !gate) {
  throw new Error("live-face-join requires LARES_URL with pinned relay and gate query parameters");
}
if (!nodeInfo?.gateKey || !nodeInfo?.wikiDoc?.url) {
  throw new Error("live-face-join requires LIVE_WIKI_NODE_INFO from `browser-ci.sh info`");
}
if (nodeInfo.gateKey.toLowerCase() !== gate.toLowerCase()) {
  throw new Error(`crossing URL gate ${gate} differs from node info gate ${nodeInfo.gateKey}`);
}
if (!new Set(["edit", "render", "absent"]).has(mode)) {
  throw new Error(`unknown live-face-join mode ${mode}; use render, edit, or absent`);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];
const trace = [];
const page = await browser.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
  if (message.type() === "log" && /\[vessel\]|\[lararium-browser\]|\[dyad\]/.test(message.text())) trace.push(message.text());
});

async function runLiveWalk() {
try {
  await page.goto(base.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll(".row")].find((item) => item.querySelector(".k")?.textContent === "status");
    const status = row?.querySelector(".v")?.textContent ?? document.getElementById("status")?.textContent ?? "";
    return status.startsWith("live") || status.startsWith("boot failed:");
  }, null, { timeout: 60_000 });

  const readStatus = () => page.evaluate(() => {
    const row = [...document.querySelectorAll(".row")].find((item) => item.querySelector(".k")?.textContent === "status");
    return row?.querySelector(".v")?.textContent ?? document.getElementById("status")?.textContent ?? "";
  });
  const bootStatus = await readStatus();
  if (!bootStatus.startsWith("live")) throw new Error(`fresh vessel failed to boot: ${bootStatus}`);
  const key = (await page.locator("#vessel-key").innerText()).trim();
  if (!/^[0-9a-f]{64}$/i.test(key)) throw new Error(`page printed no device verifying key: ${key}`);
  let fragment;
  try { fragment = await requestAdmit(key); }
  catch (error) {
    if (error instanceof AdmitRefused) throw new Error(error.message);
    throw error;
  }
  if (!fragment.startsWith("#admit=")) throw new Error("host carriage must be the complete #admit= fragment line");
  const admitted = JSON.parse(Buffer.from(fragment.slice("#admit=".length), "base64url").toString("utf8"));
  await page.locator("#admit-paste").fill(fragment);
  await page.locator("#admit-apply").click();
  await page.waitForFunction(() => !location.hash.startsWith("#admit="), null, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll(".row")].find((item) => item.querySelector(".k")?.textContent === "status");
    const status = row?.querySelector(".v")?.textContent ?? document.getElementById("status")?.textContent ?? "";
    return status.startsWith("live") || status.startsWith("boot failed:");
  }, null, { timeout: 60_000 });

  const admittedStatus = await readStatus();
  if (!admittedStatus.startsWith("live")) {
    const result = { origin: base.origin, relay: base.searchParams.get("relay"), gate, deviceKey: key, admittedStatus, trace, consoleErrors: errors };
    console.log(JSON.stringify(result));
    throw new Error(`admitted vessel failed to reboot: ${admittedStatus}`);
  }
  const joinedFace = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("lares:vessel");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      if (!db.objectStoreNames.contains("bootstrap")) return null;
      return await new Promise((resolve, reject) => {
        const request = db.transaction("bootstrap", "readonly").objectStore("bootstrap").get("social-bootstrap");
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
  const faceJoined = joinedFace?.personaGroupDocIdHex === admitted.personaGroupDocIdHex
    && joinedFace?.personaKelPrefix === admitted.personaKelPrefix
    && joinedFace?.signerDid === admitted.signerDid
    && joinedFace?.personaUrl === admitted.personaUrl;
  if (!faceJoined) throw new Error("admitted browser did not persist the face binding carried by the node");

  const connection = page.locator('[data-live-status="connection"]');
  let connectionEvidence = null;
  if (await connection.count()) {
    await page.waitForFunction((expectedGate) => {
      const element = document.querySelector('[data-live-status="connection"]');
      const text = element?.textContent?.trim() ?? "";
      return text.startsWith("connected") && (element?.getAttribute("data-gate-key") ?? "").toLowerCase() === expectedGate.toLowerCase();
    }, nodeInfo.gateKey, { timeout: 60_000 });
    connectionEvidence = await connection.evaluate((element) => ({
      status: element.textContent?.trim() ?? "",
      gateKey: element.getAttribute("data-gate-key"),
      wikiDocUrl: element.getAttribute("data-wiki-doc-url"),
    }));
    if (connectionEvidence.wikiDocUrl !== nodeInfo.wikiDoc.url) {
      throw new Error(`browser mount ${connectionEvidence.wikiDocUrl ?? "(unreported)"} differs from node wikiDoc ${nodeInfo.wikiDoc.url}`);
    }
  }

  const projectionText = () => page.locator("#projection").evaluate((element) =>
    element.shadowRoot?.querySelector(".lar-projection")?.textContent ?? "");
  const projection = page.locator("#projection");
  const openSearch = async () => {
    const advancedSearch = projection.locator('button[title="Advanced search"]');
    if (await advancedSearch.count()) await advancedSearch.click();
    await page.waitForFunction(() => [...(document.querySelector("#projection")?.shadowRoot?.querySelectorAll("button") ?? [])]
      .some((button) => button.textContent?.trim() === "Standard"), null, { timeout: 15_000 });
    const standardTab = await projection.evaluate((element) => {
      const button = [...(element.shadowRoot?.querySelectorAll("button") ?? [])]
        .find((candidate) => candidate.textContent?.trim() === "Standard");
      return button ? { renderId: button.getAttribute("data-lar-rid"), className: button.className } : null;
    });
    if (standardTab?.renderId) {
      await projection.locator(`[data-lar-rid="${standardTab.renderId}"]`).click();
      await page.waitForFunction(() => {
        const tab = [...(document.querySelector("#projection")?.shadowRoot?.querySelectorAll("button") ?? [])]
          .find((button) => button.textContent?.trim() === "Standard");
        return tab?.classList.contains("tc-tab-selected") ?? false;
      }, null, { timeout: 2_000 }).catch(async () => {
        console.log(`STANDARD_SEARCH_TAB=${JSON.stringify({ ...standardTab, result: "click did not select the tab" })}`);
      });
    } else {
      console.log(`STANDARD_SEARCH_TAB=${JSON.stringify(standardTab ?? { result: "button missing" })}`);
    }
    const scopedSearch = projection.locator('[data-tiddler-title="$:/AdvancedSearch"] input').first();
    const search = await scopedSearch.count() ? scopedSearch : projection.locator("input").nth(1);
    await search.waitFor({ state: "visible", timeout: 15_000 }).catch(async () => {
      const debug = await projection.evaluate((element) => ({
        text: element.shadowRoot?.querySelector(".lar-projection")?.textContent?.slice(0, 240) ?? "",
        controls: [...(element.shadowRoot?.querySelectorAll("input,button,a") ?? [])].map((control) => ({
          tag: control.tagName,
          text: control.textContent?.trim().slice(0, 30) ?? "",
          title: control.getAttribute("title"),
          placeholder: control.getAttribute("placeholder"),
          className: typeof control.className === "string" ? control.className : "",
        })),
      }));
      console.log(`SEARCH_SURFACE=${JSON.stringify(debug)}`);
      throw new Error("TW5 search surface exposed no visible search input");
    });
    return search;
  };
  const projectionTextBeforeOpen = await projectionText();
  if (mode === "absent") {
    if (/Lady Aki/i.test(projectionTextBeforeOpen)) throw new Error("absent-carrier control found Lady Aki after recipe removal");
    const search = await openSearch();
    await search.fill(akiUri);
    await page.waitForTimeout(500);
    const namedResult = projection.locator(".tc-search-item, a.tc-tiddlylink").filter({ hasText: akiUri });
    if (await namedResult.count()) throw new Error(`absent-carrier search resolved ${akiUri} after recipe removal`);
    const workerErrors = errors.filter((line) => /\[wiki-worker\] error/i.test(line));
    if (workerErrors.length) throw new Error(`wiki worker errors: ${workerErrors.join(" | ")}`);
    console.log(JSON.stringify({ origin: base.origin, relay: base.searchParams.get("relay"), gate, deviceKey: key,
      faceJoin: { matchedAdmit: faceJoined }, connection: connectionEvidence, wikiDoc: nodeInfo.wikiDoc,
      absentByName: "Lady Aki", trace, consoleErrors: errors }));
    if (!connectionEvidence) throw new Error("served page exposes no connection snapshot at [data-live-status=connection]");
    return;
  }

  const search = await openSearch();
  await search.fill(akiUri);
  await page.waitForTimeout(500);
  const searchResult = projection.locator(".tc-search-item, a.tc-tiddlylink").filter({ hasText: akiUri }).first();
  if (!(await searchResult.count())) {
    const searchProjection = await projectionText();
    const surface = await projection.evaluate((element) => ({
      excerpt: element.shadowRoot?.querySelector(".lar-projection")?.textContent?.slice(0, 800) ?? "",
      tabs: [...(element.shadowRoot?.querySelectorAll("button") ?? [])].map((button) => ({
        text: button.textContent?.trim() ?? "", className: button.className,
      })).filter((button) => ["Standard", "System", "Shadows", "Filter"].includes(button.text)),
      searchValues: [...(element.shadowRoot?.querySelectorAll("input") ?? [])].map((input) => ({
        value: input.value, className: input.className,
      })),
      links: [...(element.shadowRoot?.querySelectorAll("a.tc-tiddlylink") ?? [])].map((link) => link.textContent?.trim()).slice(0, 30),
    }));
    console.log(`AKI_SEARCH=${JSON.stringify({ query: akiUri, resultCount: 0, projectionExcerpt: searchProjection.slice(0, 300), surface })}`);
    throw new Error(`TW5 search found no result named ${akiUri} in the admitted browser wiki`);
  }
  await searchResult.click({ timeout: 15_000 });
  await page.waitForFunction((uri) => {
    const text = document.querySelector("#projection")?.shadowRoot?.querySelector(".lar-projection")?.textContent ?? "";
    return text.includes(uri);
  }, akiUri, { timeout: 30_000 });

  const rendered = await projectionText();
  const renderedAki = /Lady Aki/i.test(rendered);
  if (!renderedAki) throw new Error(`mounted node wiki did not render Lady Aki; projection starts: ${rendered.slice(0, 180)}`);
  if (mode === "render") {
    const workerErrors = errors.filter((line) => /\[wiki-worker\] error/i.test(line));
    if (workerErrors.length) throw new Error(`wiki worker errors: ${workerErrors.join(" | ")}`);
    console.log(JSON.stringify({ origin: base.origin, relay: base.searchParams.get("relay"), gate, deviceKey: key,
      faceJoin: { matchedAdmit: faceJoined }, connection: connectionEvidence, wikiDoc: nodeInfo.wikiDoc,
      renderedAki, projectionExcerpt: rendered.slice(0, 240), trace, consoleErrors: errors }));
    if (!connectionEvidence) throw new Error("served page exposes no connection snapshot at [data-live-status=connection]");
    return;
  }

  const editButton = projection.locator('button[title="Edit this tiddler"]').last();
  await editButton.click({ timeout: 15_000 });
  const fieldSelector = 'input[data-tiddler-field-name="sdm-character-level"], [data-tiddler-field-name="sdm-character-level"] input, input[name="sdm-character-level"], [data-field="sdm-character-level"] input';
  const levelField = projection.locator(
    fieldSelector,
  ).first();
  await levelField.waitFor({ state: "visible", timeout: 15_000 });
  const beforeLevel = await levelField.inputValue();
  if (beforeLevel !== "2") throw new Error(`Aki field started at ${JSON.stringify(beforeLevel)}, expected "2"`);
  await levelField.fill("3");
  await levelField.press("Tab");
  await page.waitForFunction((selector) => {
    const field = document.querySelector("#projection")?.shadowRoot?.querySelector(selector);
    return field && "value" in field && field.value === "3";
  }, fieldSelector, { timeout: 30_000 });
  const browserFieldValue = await levelField.inputValue();
  if (browserFieldValue !== "3") throw new Error(`browser editor reads ${JSON.stringify(browserFieldValue)} after the write`);
  const workerErrors = errors.filter((line) => /\[wiki-worker\] error/i.test(line));
  if (workerErrors.length) throw new Error(`wiki worker errors: ${workerErrors.join(" | ")}`);
  console.log(JSON.stringify({ origin: base.origin, relay: base.searchParams.get("relay"), gate, deviceKey: key,
    faceJoin: { matchedAdmit: faceJoined }, connection: connectionEvidence, wikiDoc: nodeInfo.wikiDoc,
    renderedAki, browserField: { name: "sdm-character-level", before: beforeLevel, after: browserFieldValue },
    trace, consoleErrors: errors }));
  if (!connectionEvidence) throw new Error("served page exposes no connection snapshot at [data-live-status=connection]");
} finally {
  await browser.close();
}
}

await runLiveWalk();
