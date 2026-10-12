/**
 * The live admitted-face walk. Run it with the host-owned browser-ci fixture:
 *
 *   BROWSER_CI_PROJECT=cx-a BROWSER_CI_PORT=5471 BROWSER_CI_IMAGE=lares-browser-ci:cx-a \
 *   LARES_URL='http://localhost:4321?relay=ws://localhost:4321/ws&gate=<gate-key>' \
 *   tools/browser-ci.sh qa node packages/lararium-browser/tests/live/face-join-walk.mjs
 *
 * The host reads JOINEE_KEY from stdout, runs `browser-ci.sh admit --fragment <key>`,
 * then writes that one fragment line to this process's stdin. The QA container never
 * receives the Docker socket or issues an admission.
 */
import { createInterface } from "node:readline";
import { chromium } from "playwright";

const base = new URL(process.env.LARES_URL ?? "http://localhost:4321");
const gate = base.searchParams.get("gate");
if (!base.searchParams.has("relay") || !gate) {
  throw new Error("live-face-join requires LARES_URL with pinned relay and gate query parameters");
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

const readFragment = async () => {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const line = await new Promise((resolve, reject) => {
    input.once("line", resolve);
    input.once("close", () => reject(new Error("host closed stdin before carrying the admit fragment")));
  });
  input.close();
  return line.trim();
};

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
  console.log(`JOINEE_KEY=${key}`);
  console.log("HOST_ACTION=issue browser-ci.sh admit --fragment for this key, then write its #admit= line to stdin");

  const fragment = await readFragment();
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

  const projection = await page.locator("#projection").evaluate((element) =>
    element.shadowRoot?.querySelector(".lar-projection")?.textContent ?? "");
  const workerErrors = errors.filter((line) => /\[wiki-worker\] error/i.test(line));
  const result = {
    origin: base.origin,
    relay: base.searchParams.get("relay"),
    gate,
    deviceKey: key,
    faceJoin: {
      matchedAdmit: faceJoined,
      personaGroupDocIdHex: joinedFace?.personaGroupDocIdHex ?? null,
      personaKelPrefix: joinedFace?.personaKelPrefix ?? null,
      signerDid: joinedFace?.signerDid ?? null,
      personaUrl: joinedFace?.personaUrl ?? null,
    },
    renderedAki: /Lady Aki/.test(projection),
    projectionExcerpt: projection.slice(0, 180),
    trace,
    consoleErrors: errors,
  };
  console.log(JSON.stringify(result));
  if (!faceJoined) throw new Error("admitted browser did not persist the face binding carried by the node");
  if (!result.renderedAki) throw new Error("admitted face joined, but the mounted browser wiki did not render Lady Aki");
  if (workerErrors.length) throw new Error(`wiki worker errors: ${workerErrors.join(" | ")}`);
} finally {
  await browser.close();
}
