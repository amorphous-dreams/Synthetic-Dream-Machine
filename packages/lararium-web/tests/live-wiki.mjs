#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { requestAdmit } from "../../../tools/browser-ci-admit.mjs";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be supplied by the standing-vessel fixture`);
  return value;
}

function withGate(source, gate) {
  const url = new URL(source);
  url.searchParams.set("gate", gate);
  return url.href;
}

async function waitForLive(page) {
  try {
    await page.waitForFunction(() => [...document.querySelectorAll("#phases .phase")]
      .some((phase) => phase.textContent === "live"), undefined, { timeout: 60_000 });
  } catch (error) {
    const phases = (await page.locator("#phases").innerText().catch(() => "(missing)"));
    const status = (await page.locator("#status").textContent().catch(() => "(missing)"));
    const connection = (await page.locator('[data-live-status="connection"]').textContent().catch(() => "(missing)"));
    throw new Error(`${String(error)}; url=${page.url()}; title=${await page.title()}; phases=${phases}; status=${status}; connection=${connection}`);
  }
}

async function readConnection(page) {
  return (await page.locator('[data-live-status="connection"]').textContent()) ?? "";
}

async function admit(page, vesselUrl, gatePubKey) {
  await page.goto(withGate(vesselUrl, gatePubKey), { waitUntil: "domcontentloaded" });
  await waitForLive(page);
  const connectionBeforeAdmit = await readConnection(page);
  assert.match(connectionBeforeAdmit, /authenticating|gate pinned/i,
    "the unvouched leaf holds the crossing door without a refusal verdict");
  assert.doesNotMatch(connectionBeforeAdmit, /connected.*gate/i,
    "missing VOUCH keeps the crossing silent before the carried admit is entered");

  const browserKey = (await page.locator("#vessel-key").textContent())?.trim();
  assert.match(browserKey ?? "", /^[0-9a-f]{64}$/, "the page prints the joinee key for the host admit door");
  const carriage = (await requestAdmit(browserKey, { timeoutMs: 60_000 })).trim();
  assert.match(carriage, /^#admit=\S+/,
    "the host fixture supplies the node-issued admit carriage to the QA runner");
  await page.locator("#admit-paste").fill(carriage);
  await page.locator("#admit-apply").click();
  await page.waitForFunction(() => {
    const failed = document.querySelector("#status")?.textContent ?? "";
    return failed.startsWith("boot failed:") || [...document.querySelectorAll("#phases .phase")]
      .some((phase) => phase.textContent === "live");
  }, undefined, { timeout: 20_000 });
  const bootStatus = (await page.locator("#status").textContent()) ?? "";
  if (bootStatus.startsWith("boot failed:")) throw new Error(`browser admit stop: ${bootStatus}`);
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-live-status="connection"]')?.textContent ?? "";
    return text.includes("connected — gate");
  }, undefined, { timeout: 60_000 });
}

async function withBrowser(run) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("[wiki-worker] error")) errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`[page] ${error.message}`));
  try {
    await run(page, errors);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function crossing() {
  const vesselUrl = required("LIVE_WIKI_CROSSING_URL");
  const gatePubKey = required("LIVE_WIKI_GATE_PUBKEY");
  await withBrowser(async (page) => {
    await page.goto(withGate(vesselUrl, "00".repeat(32)), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (document.querySelector('[data-live-status="connection"]')?.textContent ?? "")
      .startsWith("gate-unreachable — "), undefined, { timeout: 60_000 });
    const refusal = await readConnection(page);
    assert.match(refusal, /^gate-unreachable — .+/, "a wrong pin names the local unreachable gate without inventing a peer verdict");
    console.log(`wrong-pin OK — local ${refusal}`);
  });

  await withBrowser(async (page, errors) => {
    await page.goto(withGate(vesselUrl, gatePubKey));
    await waitForLive(page);
    await admit(page, vesselUrl, gatePubKey);
    assert.match(await readConnection(page), /connected — gate/i, "admitted browser shows the authenticated gate session");
    const origin = new URL(page.url()).origin;
    const displayedOrigin = await page.locator("#vessel .row").filter({ hasText: "origin" }).innerText();
    const displayedRelay = await page.locator("#vessel .row").filter({ hasText: "relay" }).innerText();
    assert.ok(displayedOrigin.includes(origin), "the served page names its actual origin");
    assert.ok(displayedRelay.includes(new URL(origin).host), "the page names its actual relay host");
    await page.locator("#summon-daemon").click();
    await page.waitForFunction(() => document.querySelector("#projection")?.shadowRoot
      ?.querySelector(".lar-projection")?.textContent?.includes("daemon · Working Surface") ?? false,
      undefined, { timeout: 30_000 });
    console.log("daemon summon OK — the daemon worker projected its working surface in Chromium");
    assert.deepEqual(errors, [], "crossing emits zero [wiki-worker] error lines");
    console.log(`crossing OK — served ${origin}; authenticated peer shown in the live status`);
  });
}

async function renderAki() {
  const vesselUrl = required("LIVE_WIKI_CROSSING_URL");
  const gatePubKey = required("LIVE_WIKI_GATE_PUBKEY");
  const expectedTitle = process.env.LAR_AKI_TITLE ?? "Lady Aki";
  const expectAbsent = process.env.LAR_EXPECT_AKI_ABSENT === "1";
  await withBrowser(async (page, errors) => {
    await admit(page, vesselUrl, gatePubKey);
    const wiki = page.locator("#projection");
    const search = wiki.locator('input[type="search"]');
    await search.fill(expectedTitle);
    await wiki.locator("button").filter({ hasText: "matches" }).first().click();
    const dropdown = wiki.locator(".tc-search-drop-down");
    await dropdown.waitFor({ state: "visible", timeout: 30_000 });

    if (expectAbsent) {
      await page.waitForFunction((title) => {
        const host = document.querySelector("#projection");
        const dropdown = host?.shadowRoot?.querySelector(".tc-search-drop-down");
        const content = dropdown?.textContent?.trim() ?? "";
        return dropdown !== null && !dropdown.hidden && content.length > 0 && !content.includes(title);
      }, expectedTitle, { timeout: 20_000 });
      assert.deepEqual(errors, [], "missing-carrier control emits zero [wiki-worker] error lines");
      console.log("render-aki negative control OK — omitted bag leaves Lady Aki absent");
      return;
    }

    await dropdown.getByText(expectedTitle, { exact: true }).click();
    await page.waitForFunction(() => {
      const text = document.querySelector("#projection")?.shadowRoot?.querySelector(".lar-projection")?.textContent ?? "";
      return text.includes("Lady Aki") && text.includes("Level:") && text.includes("Origin");
    }, undefined, { timeout: 30_000 });
    const result = await wiki.evaluate((host) => {
      const projection = host.shadowRoot.querySelector(".lar-projection");
      return {
        text: projection?.textContent ?? "",
        headings: [...(projection?.querySelectorAll("h1, h2, h3, h4") ?? [])].map((heading) => heading.textContent?.trim() ?? ""),
        links: [...(projection?.querySelectorAll("a") ?? [])].map((link) => ({ href: link.getAttribute("href"), text: link.textContent })),
      };
    });
    assert.match(result.text, /Lady Aki/);
    assert.match(result.text, /Level:\s*2/);
    assert.ok(result.headings.some((heading) => heading.startsWith("Origin")), "Aki's ahu section renders as a heading");
    assert.ok(result.links.some((link) => link.href && link.text?.includes("grandmother-spider")),
      "Aki's lar link renders as a navigable wiki anchor");
    await wiki.locator(".lar-projection").getByRole("button", { name: /edit/i }).click();
    const levelField = wiki.locator("tr.tc-edit-field").filter({ hasText: "sdm-character-level" })
      .locator("input.tc-edit-fieldeditor");
    assert.equal(await levelField.inputValue(), "2", "the typed TW5 field reads 2 in the standard editor");
    await wiki.locator(".lar-projection").getByRole("button", { name: /cancel/i }).click();
    const akiLink = wiki.locator("a").filter({ hasText: "grandmother-spider" }).first();
    await akiLink.click();
    await page.waitForFunction((title) => {
      const text = document.querySelector("#projection")?.shadowRoot?.querySelector(".lar-projection")?.textContent ?? "";
      return text.includes(title);
    }, "grandmother-spider", { timeout: 30_000 });
    assert.deepEqual(errors, [], "Aki render emits zero [wiki-worker] error lines");
    console.log("render-aki OK — Lady Aki title, level 2, ahu section, and followed lar link rendered");
  });
}

async function editAki() {
  const vesselUrl = required("LIVE_WIKI_CROSSING_URL");
  const gatePubKey = required("LIVE_WIKI_GATE_PUBKEY");
  await withBrowser(async (page, errors) => {
    await admit(page, vesselUrl, gatePubKey);
    await openAki(page);
    const wiki = page.locator("#projection");
    await wiki.locator(".lar-projection").getByRole("button", { name: /edit/i }).click();
    const fieldRow = wiki.locator("tr.tc-edit-field").filter({ hasText: "sdm-character-level" });
    const level = fieldRow.locator("input.tc-edit-fieldeditor");
    await level.waitFor({ state: "visible", timeout: 20_000 });
    assert.equal(await level.inputValue(), "2", "the typed TW5 field begins at 2");
    await level.fill("3");
    await wiki.locator('button[title="Confirm changes to this tiddler"]').click();
    await wiki.locator(".lar-projection").getByRole("button", { name: /edit/i }).click();
    assert.equal(await fieldRow.locator("input.tc-edit-fieldeditor").inputValue(), "3",
      "the TW5 editor reads back the changed typed field");
    assert.deepEqual(errors, [], "editing Aki emits zero page or wiki-worker errors");
    console.log("edit-aki page save OK — typed sdm-character-level changed from 2 to 3");
  });
}

async function openAki(page) {
  const wiki = page.locator("#projection");
  const search = wiki.locator('input[type="search"]');
  await search.fill("Lady Aki");
  await wiki.locator("button").filter({ hasText: "matches" }).first().click();
  const dropdown = wiki.locator(".tc-search-drop-down");
  await dropdown.waitFor({ state: "visible", timeout: 30_000 });
  await dropdown.getByText("Lady Aki", { exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#projection")?.shadowRoot
    ?.querySelector(".lar-projection")?.textContent?.includes("Lady Aki") ?? false, undefined, { timeout: 30_000 });
}

async function freshProfileAki() {
  const vesselUrl = required("LIVE_WIKI_CROSSING_URL");
  const gatePubKey = required("LIVE_WIKI_GATE_PUBKEY");
  await withBrowser(async (page, errors) => {
    await admit(page, vesselUrl, gatePubKey);
    await openAki(page);
    const fields = page.locator("#projection tr.tc-edit-field").filter({ hasText: "sdm-character-level" });
    await page.locator("#projection .lar-projection").getByRole("button", { name: /edit/i }).click();
    const value = await fields.locator("input.tc-edit-fieldeditor").inputValue();
    assert.equal(value, "3", "a fresh browser profile reads the stored typed field at 3");
    assert.deepEqual(errors, [], "fresh-profile read emits zero page or wiki-worker errors");
    console.log("fresh-profile-aki OK — newly admitted profile reads typed level 3");
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
