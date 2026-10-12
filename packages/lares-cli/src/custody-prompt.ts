/**
 * custody-prompt — THE TTY GATHERER for the vessel's key custody: the one place a human route is read.
 *
 * A credential (a passphrase, or the sheets of a paper pin) comes from a TTY prompt ALONE. No flag, no environment
 * variable and no stdin pipe carries one, and nothing here echoes one. With no TTY every gatherer refuses BY NAME
 * (`CredentialTtyRefusal`) and says how to run the verb attached; a non-interactive test harness founds through
 * `tools/seed-test-custody.mjs`, which names its route in the open and refuses a root that carries no
 * `.lar-test-scratch` marker (written only by `tools/test-scratch-marker.mjs` at stage time).
 *
 * Meme: lar:///ha.ka.ba/lares/cli/vessel-door
 */

import { stdout } from "node:process";
import {
  confirmHeldPaper, confirmPaperPin, draftPaperPin,
  type Credential, type SlotSpec, type PinSpec,
} from "@lararium/mesh";
import { canPromptSecret, promptLine, promptSecret, promptSecretConfirmed } from "./prompt-secret.js";

/** The refusal of a verb that needs a credential and has no TTY to read one from. */
export class CredentialTtyRefusal extends Error {
  override readonly name = "CredentialTtyRefusal";
  constructor(readonly verb: string, readonly how: string) {
    super(
      `${verb} reads its credential from a TTY and none stands: no flag, environment variable or pipe carries one. ${how}`,
    );
  }
}

/** The container recipe a refusal names: the founding runs attached to a pseudo-terminal. */
export const CONTAINER_FOUND_HOW =
  "In the container run it attached: `tools/lares-container.sh found` from a terminal (the shim runs " +
  "`docker compose --profile offline run --rm offline vessel found …`); " +
  "`-T`, a pipe or a detached `up` has no TTY.";

/** Refuse by name unless a TTY stands on both ends. */
export function requireTty(verb: string, how = "Run it in an interactive terminal."): void {
  if (!canPromptSecret()) throw new CredentialTtyRefusal(verb, how);
}

const say = (line = ""): void => { stdout.write(`${line}\n`); };

type Route = "passphrase" | "paper";

async function askRoute(question: string, allowBoth: boolean): Promise<readonly Route[]> {
  const menu = allowBoth ? "[p]assphrase, [s]heet (paper pin), [b]oth" : "[p]assphrase or [s]heet (paper pin)";
  for (let i = 0; i < 3; i++) {
    const a = (await promptLine(`${question} ${menu} (p): `)).trim().toLowerCase();
    if (a === "" || a.startsWith("p")) return ["passphrase"];
    if (a.startsWith("s")) return ["paper"];
    if (allowBoth && a.startsWith("b")) return ["passphrase", "paper"];
    say("  (choose one of the letters shown)");
  }
  throw new Error("no route chosen after three tries");
}

/** Read the sheets of a paper pin, one line each, hidden; a blank line ends the list. */
async function readSheets(label: string): Promise<string[]> {
  const sheets: string[] = [];
  for (;;) {
    const line = (await promptSecret(`${label} sheet ${sheets.length + 1} (blank line when done): `)).trim();
    if (line === "") break;
    sheets.push(line);
  }
  return sheets;
}

/** One credential, read hidden: a passphrase, or the sheets of a held paper pin. */
async function readCredential(route: Route): Promise<Credential> {
  if (route === "passphrase") return { kind: "passphrase", passphrase: await promptSecret("passphrase: ") };
  return { kind: "paper", sheets: await readSheets("paper") };
}

/**
 * The credentials that open the VK. One credential per pass; a slot of several pins asks for more. Refuses with no TTY.
 * Nothing read here is stored beyond the returned array, which the caller hands to `unlockCustody` and drops.
 */
export async function gatherCredentials(verb: string, opts: { readonly route?: Route } = {}): Promise<Credential[]> {
  requireTty(verb);
  const out: Credential[] = [];
  for (;;) {
    const [route] = opts.route ? [opts.route] : await askRoute("open with", false);
    out.push(await readCredential(route!));
    const more = (await promptLine("another credential for a multi-pin slot? [y/N]: ")).trim().toLowerCase();
    if (!more.startsWith("y")) return out;
  }
}

/** Draft a paper pin, print its sheet(s), and bind it only after every word reads back. */
async function newPaperPin(): Promise<PinSpec> {
  const draft = draftPaperPin({ threshold: 1, count: 1 });
  say();
  say("  PAPER PIN — write these words on paper, in order. They are shown once and kept nowhere:");
  say();
  draft.sheets.forEach((sheet, i) => say(`    sheet ${i + 1}: ${sheet}`));
  say();
  for (let attempt = 0; attempt < 3; attempt++) {
    const typed: string[] = [];
    for (let i = 0; i < draft.sheets.length; i++) typed.push((await promptSecret(`  read sheet ${i + 1} back (hidden): `)).trim());
    try { return { kind: "paper", confirmed: confirmPaperPin(draft, typed) }; }
    catch (err) { say(`  ${(err as Error).message}`); }
  }
  throw new Error("the paper pin did not read back after three tries; nothing was bound");
}

/** One new pin of the chosen route: a passphrase (double entry) or a drafted, read-back paper pin. */
async function newPin(route: Route): Promise<PinSpec> {
  if (route === "passphrase") return { kind: "passphrase", passphrase: await promptSecretConfirmed("new passphrase") };
  return newPaperPin();
}

/** A new slot of one route (threshold 1), for `vault bind`. */
export async function gatherNewSlot(verb: string, route: Route): Promise<SlotSpec> {
  requireTty(verb);
  return { t: 1, pins: [await newPin(route)] };
}

/**
 * The founding route: one slot per chosen route, each opening the VK on its own. Refuses by name with no TTY and names
 * the container recipe.
 */
export async function gatherFoundingRoute(): Promise<SlotSpec[]> {
  requireTty("lares vessel found", CONTAINER_FOUND_HOW);
  say("A founding seals the vessel's custody from birth and binds a HUMAN ROUTE to it.");
  say("Lose every route and the sealed state opens for no one; keep the passphrase or the paper safe.");
  const routes = await askRoute("bind", true);
  const slots: SlotSpec[] = [];
  for (const r of routes) slots.push({ t: 1, pins: [await newPin(r)] });
  return slots;
}

/**
 * For `vault unbind --rotate`: the spec of a slot that STAYS, re-read from the human so the new VK can re-bind it.
 * A passphrase pin re-reads the passphrase; a paper pin re-reads its sheets (`confirmHeldPaper`). The caller proves
 * each spec opens its slot BEFORE any byte moves, so a typo never rotates a vessel into a lockout.
 */
export async function gatherStayingSlot(
  slot: { readonly id: string; readonly t: number; readonly pins: readonly string[] },
): Promise<{ spec: SlotSpec; credentials: Credential[] }> {
  say(`  slot ${slot.id}: re-enter its ${slot.pins.length === 1 ? "route" : `${slot.pins.length} routes`} (${slot.pins.join(" + ")}).`);
  const pins: PinSpec[] = [];
  const credentials: Credential[] = [];
  for (const kind of slot.pins) {
    if (kind === "passphrase") {
      const passphrase = await promptSecret("    passphrase: ");
      pins.push({ kind: "passphrase", passphrase });
      credentials.push({ kind: "passphrase", passphrase });
    } else if (kind === "paper") {
      const sheets = await readSheets("    paper");
      pins.push({ kind: "paper", confirmed: confirmHeldPaper(sheets) });
      credentials.push({ kind: "paper", sheets });
    } else {
      throw new Error(`slot ${slot.id} carries a pin of kind "${kind}" this door cannot re-read`);
    }
  }
  return { spec: { t: slot.t, pins }, credentials };
}
