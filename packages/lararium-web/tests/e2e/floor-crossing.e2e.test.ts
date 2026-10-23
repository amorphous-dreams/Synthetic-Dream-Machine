/**
 * e2e/floor-crossing — a fresh browser device stands at the floor, and a face joined to it crosses the hearth's
 * sovereign gate. A real Chromium opens the page a staged hearth serves, at the URL the hearth's own banner prints.
 *
 * Browser devices stand at the floor (operator ruling, 2026-10-16): each begins as an anonymous capability stack, and
 * the person decides which faces to join to it. So:
 *
 *   F1 — the banner hands a URL with no gate key: the relay, and the hearth's floor card in the fragment
 *   F2 — a fresh device boots faceless and names it: at the floor, no face joined, no sovereign session
 *   F3 — CONTROL: before the cabal releases a floor, the porch answers the faceless device with no release, and the page
 *        names it (the floor is a name the reader brings, so a private Nexus is no different from an open one)
 *   F4 — once the hearth's cabal releases its floor (promote open, then release, over the genesis floor manifest), a fresh
 *        faceless device reads the floor off the porch and VERIFIES it whole: the lineage re-derives the AID, the head
 *        release seals as a seat of its epoch, and every blob hashes to its CID
 *   F5 — once the person joins a face (the fleet-join door, the full pin inside the root's signature), the device
 *        crosses the hearth's sovereign gate under that face's scoped key, and the gate it proved is the pinned one
 *   F6 — the joined face reads and verifies the same floor
 *
 * The node's own read decides each step through the page's DOM state; a timeout only bounds a wait.
 */
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { foundStagedHearth, openStaged, stageDir, type LarInstance } from "../../../../tests/harness/instance.js";
import { mintStagedNexusKey } from "../../../../tests/harness/vessel-key.js";
// The published test route answers the custody form a fresh vessel raises (a harness door; never a person's passphrase).
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const WEB_ROOT = join(REPO, "packages/lararium-web/dist");
const RECORD = join(REPO, ".pronaos-build/pronaos-artifact.json");
const WAIT = 120_000;

let hearth: LarInstance | null = null;
let browser: Browser | null = null;
let scratch = "";
let bannerUrl = "";
const contexts: BrowserContext[] = [];
const consoles = new Map<Page, string[]>();

/** A fresh device: a context of its own, so no store, key or join carries over from another. */
async function freshDevice(): Promise<Page> {
  const context = await browser!.newContext();
  await armTestCustody(context, "floor-crossing");
  contexts.push(context);
  const page = await context.newPage();
  const lines: string[] = [];
  consoles.set(page, lines);
  page.on("console", (m) => { lines.push(m.text()); });
  page.on("pageerror", (e) => { lines.push(`[pageerror] ${e.message}`); });
  return page;
}

const tail = (page: Page): string => (consoles.get(page) ?? []).filter((l) => !l.startsWith("Warning: Global assignment")).slice(-120).join("\n");

/** Wait for the vessel panel's status row to read live; a boot failure names itself. */
async function awaitLive(page: Page): Promise<void> {
  const row = await page.waitForFunction(() => {
    // The panel repaints whole once the vessel stands: its status row is the one keyed `status`.
    const rows = [...document.querySelectorAll("#vessel .row")];
    const t = rows.find((r) => r.querySelector(".k")?.textContent === "status")?.querySelector(".v")?.textContent ?? "";
    return t.startsWith("live") || t.startsWith("boot failed") ? t : false;
  }, undefined, { timeout: WAIT }).then((h) => h.jsonValue()).catch(() => "never live");
  const phases = row === "never live" ? await page.locator("#phases").innerText().catch(() => "") : "";
  expect(row, `phases: ${phases.replace(/\n/g, " · ")}\n${tail(page)}\n--- hearth ---\n${hearth?.bootLog().slice(-3000)}`).toMatch(/^live/);
}

/** The floor read's outcome as the page paints it: verified, or the named reason it is not. */
async function floorOutcome(page: Page): Promise<string> {
  return page.waitForFunction(() => {
    const panel = document.querySelector("#floor")?.textContent ?? "";
    if (panel.includes("verified floor")) return "verified";
    const status = document.querySelector("#floor-status")?.textContent ?? "";
    return status.startsWith("✗") ? status : false;
  }, undefined, { timeout: WAIT }).then((h) => h.jsonValue() as Promise<string>).catch(() => "no outcome");
}

/** The genesis floor manifest's bytes, copied beside the run, and the approval file the seat signs over them. */
function floorFiles(): { manifestFile: string; approvalFile: string } {
  const seed = JSON.parse(readFileSync(join(REPO, "genesis/seed.json"), "utf8")) as { tiddlers: Record<string, { tiddler: { cid?: string } }> };
  const manifestCid = seed.tiddlers["lar:///ha.ka.ba/bags/oracle/genesis-cid-floor"]?.tiddler.cid;
  expect(manifestCid, "the genesis seed names no floor manifest").toMatch(/^[0-9a-f]{64}$/);
  const manifestFile = join(scratch, "floor-manifest.json");
  copyFileSync(join(REPO, "genesis/cas", manifestCid!), manifestFile);
  return { manifestFile, approvalFile: join(scratch, "floor-approval.json") };
}

/**
 * The seat signs the manifest's exact bytes BEFORE the vessel stands: `nexus promote open` reads the sealed seat rows, which a
 * standing vessel's key session owns, so the approval rides the founding rite and only the release (a store verb) waits for the
 * live hearth.
 */
async function approveGenesisFloor(cli: (args: readonly string[]) => Promise<{ code: number; stdout: string; stderr: string }>): Promise<void> {
  const { manifestFile, approvalFile } = floorFiles();
  const opened = await cli(["nexus", "promote", "open", manifestFile, "--purpose", "floor-release", "--surface", "floor-release", "--class", "high-impact", "--out", approvalFile]);
  expect(opened.code, `${opened.stderr}\n${opened.stdout}`).toBe(0);
}

/** The hearth's cabal seals the release over the approval it signed at founding. */
async function releaseGenesisFloor(): Promise<void> {
  const { manifestFile, approvalFile } = floorFiles();
  const released = await hearth!.cli(["nexus", "release", manifestFile, "--approval", approvalFile]);
  expect(released.code, `${released.stderr}\n${released.stdout}`).toBe(0);
}

/** The crossing row's standing (`data-standing`) and the gate key a verified crossing proved (`data-gate-key`). */
async function crossing(page: Page): Promise<{ standing: string | null; gateKey: string | null; text: string }> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-live-status="connection"]');
    return { standing: el?.getAttribute("data-standing") ?? null, gateKey: el?.getAttribute("data-gate-key") ?? null, text: el?.textContent ?? "" };
  });
}

/** Wait until the crossing row reads `standing`; answer what it read last. */
async function awaitStanding(page: Page, standing: string): Promise<{ standing: string | null; gateKey: string | null; text: string }> {
  await page.waitForFunction((want) => document.querySelector('[data-live-status="connection"]')?.getAttribute("data-standing") === want, standing, { timeout: WAIT }).catch(() => null);
  return crossing(page);
}

beforeAll(async () => {
  scratch = mkdtempSync(join(stageDir(), "floor-crossing-"));
  hearth = await openStaged({
    tag: "floor-crossing",
    // The face stands at its own hearth's Nexus, so a fleet join certifies the device's face-scoped key there.
    found: async (cli, root) => { await foundStagedHearth(cli, root, "hearth"); await mintStagedNexusKey(root); await approveGenesisFloor(cli); },
    daemonEnv: { LAR_PRONAOS_WEB_ROOT: WEB_ROOT, LAR_PRONAOS_ARTIFACT_RECORD: RECORD },
  });
  // The banner's crossing line names the URL a device opens: `[lararium]   <url>   (<face kind>)`.
  const deadline = performance.now() + WAIT;
  for (;;) {
    bannerUrl = /^\[lararium\] {3}(https?:\/\/\S+) {3}\(/m.exec(hearth.bootLog())?.[1] ?? "";
    if (bannerUrl || performance.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true, ...(process.env["LAR_CHROMIUM"] ? { executablePath: process.env["LAR_CHROMIUM"] } : {}) });
}, 600_000);

afterAll(async () => {
  // What each side said, kept beside the run's scratch for a reader of a red.
  if (scratch) {
    writeFileSync(join(scratch, "hearth.log"), hearth?.bootLog() ?? "");
    [...consoles.values()].forEach((lines, i) => writeFileSync(join(scratch, `device-${i}.log`), lines.join("\n")));
  }
  for (const c of contexts) await c.close().catch(() => undefined);
  await browser?.close();
  await hearth?.stop();
});

describe("a browser device at the floor, then under a joined face", () => {
  test("F1 — the banner hands a URL with no gate key: the relay, and the floor card in the fragment", () => {
    expect(bannerUrl, hearth?.bootLog().slice(-2000)).not.toBe("");
    const url = new URL(bannerUrl);
    expect(url.searchParams.get("relay")).toMatch(/^wss?:\/\/.+\/ws$/);
    expect(url.searchParams.has("gate")).toBe(false);
    expect(new URLSearchParams(url.hash.slice(1)).get("floor")).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  let faceless: Page | null = null;

  test("F2 — a fresh device boots faceless at the floor and names it", async () => {
    await hearth!.cli(["nexus", "posture", "private"]);
    faceless = await freshDevice();
    await faceless.goto(bannerUrl);
    await awaitLive(faceless);
    const at = await awaitStanding(faceless, "floor");
    expect(at.standing, `${at.text}\n${tail(faceless)}`).toBe("floor");
    expect(at.text).toMatch(/no face is joined to this device/);
    expect(at.gateKey).toBeNull();
  });

  test("F3 — CONTROL: before any release the porch answers the faceless device with no release, and the page names it", async () => {
    const read = await floorOutcome(faceless!);
    expect(read, tail(faceless!)).not.toBe("verified");
    expect(read).toMatch(/no-release/);
  });

  test("F4 — after the cabal releases the floor, a fresh faceless device reads it off the porch and verifies it whole, at a private Nexus", async () => {
    await releaseGenesisFloor();
    const device = await freshDevice();
    await device.goto(bannerUrl);
    await awaitLive(device);
    expect(await floorOutcome(device), tail(device)).toBe("verified");
    // The floor reaches no face's documents: no sovereign session stands for a faceless device.
    expect((await crossing(device)).standing).toBe("floor");
  });

  let pinnedGate = "";

  test("F5 — a joined face crosses the hearth's sovereign gate under its own scoped key", async () => {
    const page = faceless!;
    const offerFile = join(scratch, "offer.json"), requestFile = join(scratch, "request.json"), answerFile = join(scratch, "answer.json");
    const offered = await hearth!.cli(["fleet", "join", "offer", "--out", offerFile]);
    expect(offered.code, offered.stderr).toBe(0);
    await page.locator("#admit-paste").fill(readFileSync(offerFile, "utf8"));
    await page.locator("#admit-apply").click();
    const minted = await page.waitForFunction(() => {
      const s = document.querySelector("#admit-status")?.textContent ?? "";
      if (s.startsWith("✗")) return { refused: s };
      return s.startsWith("✓ request minted") ? { request: (document.querySelector("#admit-paste") as HTMLTextAreaElement).value } : false;
    }, undefined, { timeout: WAIT }).then((h) => h.jsonValue() as Promise<{ refused?: string; request?: string }>);
    expect(minted.refused, tail(page)).toBeUndefined();
    writeFileSync(requestFile, minted.request!);
    const relay = new URL(bannerUrl).searchParams.get("relay")!;
    const answered = await hearth!.cli(["fleet", "join", "answer", requestFile, "--sync-url", relay, "--out", answerFile]);
    expect(answered.code, answered.stderr).toBe(0);
    const answer = JSON.parse(readFileSync(answerFile, "utf8")) as { carriage: { gatePin: { signingKey: string; tier: string } } };
    expect(answer.carriage.gatePin.tier).toBe("sovereign");
    pinnedGate = answer.carriage.gatePin.signingKey;
    // The standing hearth's gate binds the device off the issued book the answer noted, with no restart: the answer's
    // refold resweeps its gates.
    await page.evaluate(() => { (globalThis as { __beforeLand?: boolean }).__beforeLand = true; });
    await page.locator("#admit-paste").fill(readFileSync(answerFile, "utf8"));
    await page.locator("#admit-apply").click();
    await page.waitForFunction(() => (globalThis as { __beforeLand?: boolean }).__beforeLand !== true, undefined, { timeout: WAIT, polling: 250 }).catch(() => null);
    await awaitLive(page);
    const at = await awaitStanding(page, "connected");
    expect(at.standing, `${at.text}\n${tail(page)}`).toBe("connected");
    expect(at.gateKey).toBe(pinnedGate);
  });

  test("F6 — the joined face reads and verifies the same floor", async () => {
    expect(await floorOutcome(faceless!), tail(faceless!)).toBe("verified");
  });
});
