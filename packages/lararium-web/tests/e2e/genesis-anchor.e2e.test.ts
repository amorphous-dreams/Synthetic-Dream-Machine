/**
 * e2e/genesis-anchor — the page boots the seed its hearth serves, and refuses the crossing by name when that seed's CID
 * differs from the one the hearth's own arrival descriptor names. A real Chromium opens the page a staged hearth serves,
 * at the URL the hearth's banner prints.
 *
 *   G1 — CONTROL: the served seed and the descriptor agree, and the page stands live with no mismatch line
 *   G2 — a served `seed.json` that differs from the descriptor's seed CID (a stale or half-written serve, stood in here by
 *        a route that hands the page another seed) refuses BEFORE the crossing: the vessel's status row and the console
 *        read `genesis-mismatch: page <served cid> · hearth <descriptor cid>`, naming the anchor it compared against
 *
 * Both sides come off the house's own origin, so the check reads self-consistency (pronaos: the first arrival trusts
 * the lararium's own origin), and the refusal says so.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { openStaged, type LarInstance } from "../../../../tests/harness/instance.js";
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const WAIT = 120_000;
const SEED_BYTES = readFileSync(join(REPO, "genesis/seed.json"));
const HEARTH_CID = createHash("sha256").update(SEED_BYTES).digest("hex");
const seed = JSON.parse(SEED_BYTES.toString("utf8")) as { actorSeed: string };
/** Another seed: the same shape under another actor, as a stale bake on one side would read. */
const OTHER_BYTES = Buffer.from(JSON.stringify({ ...seed, actorSeed: createHash("sha256").update("another bake").digest("hex") }));
const OTHER_CID = createHash("sha256").update(OTHER_BYTES).digest("hex");

let hearth: LarInstance | null = null;
let browser: Browser | null = null;
let bannerUrl = "";
const contexts: BrowserContext[] = [];
const consoles = new Map<Page, string[]>();

async function freshDevice(): Promise<Page> {
  const context = await browser!.newContext();
  await armTestCustody(context, "genesis-anchor");
  contexts.push(context);
  const page = await context.newPage();
  const lines: string[] = [];
  consoles.set(page, lines);
  page.on("console", (m) => { lines.push(m.text()); });
  page.on("pageerror", (e) => { lines.push(`[pageerror] ${e.message}`); });
  return page;
}

const tail = (page: Page): string => (consoles.get(page) ?? []).slice(-80).join("\n");

/** The vessel's status row once it reads an outcome: live, a boot failure, or a named genesis refusal. */
async function statusOutcome(page: Page): Promise<string> {
  return page.waitForFunction(() => {
    const t = document.querySelector("#status")?.textContent ?? "";
    const rows = [...document.querySelectorAll("#vessel .row")];
    const live = rows.find((r) => r.querySelector(".k")?.textContent === "status")?.querySelector(".v")?.textContent ?? "";
    for (const s of [t, live]) if (s.startsWith("live") || s.startsWith("boot failed") || s.startsWith("genesis-")) return s;
    return false;
  }, undefined, { timeout: WAIT }).then((h) => h.jsonValue() as Promise<string>).catch(() => "no outcome");
}

beforeAll(async () => {
  hearth = await openStaged({
    tag: "genesis-anchor",
    daemonEnv: { LAR_PRONAOS_WEB_ROOT: join(REPO, "packages/lararium-web/dist"), LAR_PRONAOS_ARTIFACT_RECORD: join(REPO, ".pronaos-build/pronaos-artifact.json") },
  });
  const deadline = performance.now() + WAIT;
  for (;;) {
    bannerUrl = /^\[lararium\] {3}(https?:\/\/\S+) {3}\(/m.exec(hearth.bootLog())?.[1] ?? "";
    if (bannerUrl || performance.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true, ...(process.env["LAR_CHROMIUM"] ? { executablePath: process.env["LAR_CHROMIUM"] } : {}) });
}, 600_000);

afterAll(async () => {
  for (const c of contexts) await c.close().catch(() => undefined);
  await browser?.close();
  await hearth?.stop();
});

describe("the page checks the seed it boots against the hearth's own descriptor", () => {
  test("G1 — CONTROL: equal seeds cross as today", async () => {
    expect(bannerUrl, hearth?.bootLog().slice(-2000)).not.toBe("");
    const device = await freshDevice();
    await device.goto(bannerUrl);
    expect(await statusOutcome(device), tail(device)).toMatch(/^live/);
    expect(tail(device)).not.toMatch(/genesis-mismatch/);
  });

  test("G2 — a served seed whose CID differs from the descriptor's refuses the crossing by name", async () => {
    const device = await freshDevice();
    await device.route("**/genesis/seed.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: OTHER_BYTES }));
    await device.goto(bannerUrl);
    const outcome = await statusOutcome(device);
    expect(outcome, tail(device)).toMatch(new RegExp(`^genesis-mismatch: page ${OTHER_CID} · hearth ${HEARTH_CID}`));
    expect(outcome).toMatch(/self-consistency against the hearth's arrival descriptor https?:\/\/\S+\/\.well-known\/lar/);
    expect(tail(device)).toContain(`genesis-mismatch: page ${OTHER_CID} · hearth ${HEARTH_CID}`);
    // Refused BEFORE the crossing: the page never dialled the relay.
    expect(tail(device)).not.toMatch(/\[vessel\] CROSSING →/);
  });
});
