/**
 * browser-ci smoke: the page the node serves boots a vessel in the runner's Chromium.
 * Run through the runner: `tools/browser-ci.sh qa node tools/browser-ci-smoke.mjs`.
 *
 * Two named refusals, each with exit 1:
 *   InsecureContext  the page reads isSecureContext !== true (a browser withholds Web Locks and crypto.subtle there)
 *   VesselNotLive    the vessel panel's status row never reads "live — …"; the row's own text prints
 * A timeout (SMOKE_TIMEOUT_MS, default 60000) only bounds the wait; the verdict reads DOM state.
 */
import { chromium } from "playwright";

const URL_ = process.env.LARES_URL ?? "http://localhost:4321";
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS ?? 60000);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
let code = 0;
try {
  const page = await browser.newPage();
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
    }
  }
} finally {
  await browser.close();
}
process.exit(code);
