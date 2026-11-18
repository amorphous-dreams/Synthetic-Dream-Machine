/**
 * The runner side of the browser-ci JOIN EXCHANGE (see the header of tools/browser-ci.sh).
 *
 * A browser profile joins the node's face through the fleet-join door: the node offers, the page mints a request,
 * the node answers, the page lands the answer. The runner holds no Docker, so the host driver
 * (`browser-ci.sh qa-join …`) carries the node's two acts. One join runs two legs under one fresh id:
 *
 *   requestOffer()            prints `JOIN-OFFER <id>`, waits for `<id>.offer` (or `<id>.refused`)
 *   requestAnswer(id, req)    writes `<id>.request` whole, prints `JOIN-REQUEST <id>`, waits for `<id>.answer`
 *   pageRequest(page, offer)  pastes the offer into the page's door and reads back the request the page minted
 *   joinThroughPage(page)     the three above in order: it answers the node's answer, NOT yet pasted, so the
 *                             caller marks the standing document first and then calls `pasteAnswer`
 *
 * The page's door: `#admit-paste` takes the pasted file, `#admit-apply` applies it, `#admit-status` names the
 * outcome (`✓ request minted …` with the request in the textarea, `✓ answer landed …` before the reload, or `✗ …`).
 * Each wait reads state; `timeoutMs` only bounds it.
 */
import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** The host or the page refused a leg, or no answer came inside the bound. The message names which. */
export class JoinRefused extends Error {
  constructor(message) { super(message); this.name = "JoinRefused"; }
}

const exchangeDir = (dir) => {
  if (!dir) throw new JoinRefused("JoinRefused: BROWSER_CI_EXCHANGE stands unset; run through `browser-ci.sh qa-join`");
  return dir;
};

/** Wait for `<id>.<want>` or `<id>.refused`; answer the parsed JSON of the first, throw on the second. */
async function awaitLeg(dir, id, want, kind, timeoutMs) {
  const read = (name) => readFile(join(dir, name), "utf8").catch(() => null);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const refused = await read(`${id}.refused`);
    if (refused !== null) throw new JoinRefused(`JoinRefused: ${refused.trim()}`);
    const text = await read(`${id}.${want}`);
    if (text !== null) {
      let value;
      try { value = JSON.parse(text); } catch { throw new JoinRefused(`JoinRefused: the host's ${want} does not read as JSON: ${text.slice(0, 80)}`); }
      if (value?.kind !== kind) throw new JoinRefused(`JoinRefused: the host's ${want} names kind ${JSON.stringify(value?.kind)}, not ${kind}`);
      return value;
    }
    if (Date.now() >= deadline) throw new JoinRefused(`JoinRefused: no ${want} from the host for ${id} within ${timeoutMs}ms; did qa-join start the runner?`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Leg one: ask the host for a fresh offer from the node. Answers `{ id, offer }`. */
export async function requestOffer({ dir = process.env.BROWSER_CI_EXCHANGE, timeoutMs = 60_000 } = {}) {
  const at = exchangeDir(dir);
  const id = randomBytes(16).toString("hex");
  console.log(`JOIN-OFFER ${id}`);
  return { id, offer: await awaitLeg(at, id, "offer", "fleet-join-offer", timeoutMs) };
}

/** Leg two: hand the host the request the page minted; answers the node's signed answer. */
export async function requestAnswer(id, request, { dir = process.env.BROWSER_CI_EXCHANGE, timeoutMs = 60_000 } = {}) {
  const at = exchangeDir(dir);
  if (!/^[a-z0-9-]{1,64}$/.test(id)) throw new JoinRefused(`JoinRefused: the join id must be 1-64 lowercase letters, digits or dashes, got "${id}"`);
  if (request?.kind !== "fleet-join-request") throw new JoinRefused(`JoinRefused: the page's request names kind ${JSON.stringify(request?.kind)}, not fleet-join-request`);
  // Written whole: the host reads `<id>.request` only after the line below, and the rename lands it at once.
  await writeFile(join(at, `${id}.request.part`), JSON.stringify(request, null, 2) + "\n", { mode: 0o644 });
  await rename(join(at, `${id}.request.part`), join(at, `${id}.request`));
  console.log(`JOIN-REQUEST ${id}`);
  return awaitLeg(at, id, "answer", "fleet-join-answer", timeoutMs);
}

/** Paste the offer into the page's door; answer the request the page minted, or throw the page's own refusal. */
export async function pageRequest(page, offer, { timeoutMs = 60_000 } = {}) {
  await page.locator("#admit-paste").fill(JSON.stringify(offer, null, 2));
  await page.locator("#admit-apply").click();
  const handle = await page.waitForFunction(() => {
    const status = document.querySelector("#admit-status")?.textContent ?? "";
    if (status.startsWith("✗")) return { refused: status };
    if (!status.startsWith("✓ request minted")) return false;
    return { request: document.querySelector("#admit-paste")?.value ?? "" };
  }, undefined, { timeout: timeoutMs });
  const read = await handle.jsonValue();
  if (read.refused) throw new JoinRefused(`JoinRefused: the page minted no request: ${read.refused}`);
  try { return JSON.parse(read.request); }
  catch { throw new JoinRefused(`JoinRefused: the page's request does not read as JSON: ${read.request.slice(0, 80)}`); }
}

/** Offer, request, answer: the whole exchange short of the landing. Answers `{ offer, request, answer }`. */
export async function joinThroughPage(page, { timeoutMs = 60_000 } = {}) {
  const { id, offer } = await requestOffer({ timeoutMs });
  const request = await pageRequest(page, offer, { timeoutMs });
  const answer = await requestAnswer(id, request, { timeoutMs });
  return { offer, request, answer };
}

/** Paste the answer and apply it: the page lands it, stashes the admit it carries, and reloads into boot. */
export async function pasteAnswer(page, answer) {
  await page.locator("#admit-paste").fill(JSON.stringify(answer, null, 2));
  await page.locator("#admit-apply").click();
}
