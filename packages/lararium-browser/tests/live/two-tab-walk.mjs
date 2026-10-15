import { chromium } from "playwright";

const base = process.env.LARES_URL ?? "http://localhost:4321";
const gate = process.env.LIVE_WIKI_GATE;

const url = new URL(base);
url.searchParams.set("holder", "");
if (process.env.LIVE_WIKI_RELAY === "1") {
  if (!gate) throw new Error("LIVE_WIKI_GATE must carry the node's out-of-band gate key");
  url.searchParams.set("relay", `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}/ws`);
  url.searchParams.set("gate", gate);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext();
const errors = [];
const pageStatus = () => {
  const rows = [...document.querySelectorAll("#vessel .row")];
  return rows.filter((row) => row.querySelector(".k")?.textContent?.trim() === "status")
    .at(-1)?.querySelector(".v")?.textContent?.trim() ?? "";
};
const openPage = async () => {
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
    if (message.text().includes("[vessel]")) console.log(`PAGE ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`request-failed ${request.url()} ${request.failure()?.errorText ?? ""}`));
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll("#vessel .row")];
    const status = rows.filter((row) => row.querySelector(".k")?.textContent?.trim() === "status")
      .at(-1)?.querySelector(".v")?.textContent ?? "";
    return status.startsWith("live") || status.startsWith("boot failed:");
  }, undefined, { timeout: 60_000 });
  const status = await page.evaluate(pageStatus);
  if (!status.startsWith("live")) throw new Error(`VesselNotLive: ${status}; diagnostics=${errors.join(" | ")}`);
  return page;
};

try {
  const first = await openPage();
  const firstKey = (await first.locator("#vessel-key").textContent())?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/i.test(firstKey)) throw new Error(`BrowserKeyMissing: ${firstKey}`);
  console.log(`JOINEE_KEY=${firstKey}`);
  const admitted = Boolean(process.env.LIVE_WIKI_ADMIT);
  if (admitted) {
    await first.locator("#admit-paste").fill(process.env.LIVE_WIKI_ADMIT);
    await first.locator("#admit-apply").click();
    await first.waitForFunction(() => (document.querySelector("#admit-status")?.textContent ?? "").includes("verdict OK"), undefined, { timeout: 30_000 });
  }

  let second;
  try {
    second = await openPage();
  } catch (error) {
    const refusal = error instanceof Error ? error.message : String(error);
    await first.reload({ waitUntil: "domcontentloaded" });
    await first.waitForFunction(() => {
      const rows = [...document.querySelectorAll("#vessel .row")];
      const status = rows.filter((row) => row.querySelector(".k")?.textContent?.trim() === "status")
        .at(-1)?.querySelector(".v")?.textContent ?? "";
      return status.startsWith("live") || status.startsWith("boot failed:");
    }, undefined, { timeout: 60_000 });
    const reloadStatus = await first.evaluate(pageStatus);
    console.log(JSON.stringify({
      tabs: 2,
      sharedHolder: false,
      secondTabRefusal: refusal,
      firstTabReloadStatus: reloadStatus,
      akiRendered: (await first.locator("#projection").evaluate((host) => host.shadowRoot?.textContent ?? "")).includes("Lady Aki"),
      wikiWorkerErrors: errors.length,
    }));
    throw new Error("LiveTwoTabFailure: the shared holder did not attach a second tab");
  }
  const secondKey = (await second.locator("#vessel-key").textContent())?.trim() ?? "";
  if (secondKey !== firstKey) throw new Error("SharedIdentityMissing: tabs do not load the same vessel key");

  const held = await first.evaluate(async () => (await navigator.locks.query()).held ?? []);
  const vesselLocks = held.filter((lock) => lock.name === "lares:vessel:lares:vessel");
  if (vesselLocks.length !== 1) throw new Error(`HolderCountMismatch: expected one vessel lock, found ${vesselLocks.length}`);

  const wikiText = async (page) => page.locator("#projection").evaluate((host) => host.shadowRoot?.textContent ?? "");
  const akiBeforeReload = (await wikiText(second)).includes("Lady Aki");
  await second.reload({ waitUntil: "domcontentloaded" });
  await second.waitForFunction(() => {
    const rows = [...document.querySelectorAll("#vessel .row")];
    const status = rows.filter((row) => row.querySelector(".k")?.textContent?.trim() === "status")
      .at(-1)?.querySelector(".v")?.textContent ?? "";
    return status.startsWith("live") || status.startsWith("boot failed:");
  }, undefined, { timeout: 60_000 });
  const statusAfterReload = await second.evaluate(pageStatus);
  if (!statusAfterReload.startsWith("live")) throw new Error(`ReloadNotLive: ${statusAfterReload}`);
  const akiAfterReload = (await wikiText(second)).includes("Lady Aki");
  if (errors.length) throw new Error(`WikiWorkerConsoleErrors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({
    tabs: 2,
    admitted,
    sharedVesselKey: true,
    vesselLockCount: vesselLocks.length,
    akiBeforeReload,
    akiAfterReload,
    statusAfterReload,
    wikiWorkerErrors: errors.length,
  }));
} finally {
  await context.close();
  await browser.close();
}
