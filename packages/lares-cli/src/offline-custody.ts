/**
 * offline-custody — THE KEY SESSION OF A COMMAND THAT ACTS WITH NO VESSEL STANDING.
 *
 * A vessel's private rows rest sealed under its vessel key. A standing vessel holds that key after `lares vault
 * unlock` and runs a routed verb against what it opened. A command that acts in its own process (a founding, a
 * persona act with the vessel stopped, a read of a sealed row) holds no key until a person presents a route, so this
 * module seats a holder for the command and opens it AT THE FIRST SEALED ROW the command touches: a command that
 * touches none asks nobody anything.
 *
 * ── ONE ROUTE: A TERMINAL ───────────────────────────────────────────────────────────────────────
 * The credential comes from a TTY prompt alone (`custody-prompt`): no flag, environment variable or pipe carries
 * one. With no terminal the session refuses by name and says where to run the command. The key lives in this
 * process for the command's own act and leaves with it; nothing about the session touches disk.
 *
 * ── NEVER BESIDE A STANDING VESSEL ──────────────────────────────────────────────────────────────
 * One key session opens a vessel's rows. Where a vessel's custody door answers at the socket, this session
 * refuses by name and opens nothing: a locked vessel names `lares vault unlock`, and an unlocked one already
 * holds the session, so a command's sealed act rides its custody door (`sealed-act-door`). A command that
 * reached this refusal read a sealed row in its own process beside a standing vessel, which no command may.
 *
 * ── THE TEST ROUTE ──────────────────────────────────────────────────────────────────────────────
 * A root that carries the harness's scratch marker (`.lar-test-scratch`, written only by
 * `tools/test-scratch-marker.mjs` at stage time) opens under the PUBLISHED test passphrase, and says so on stderr.
 * That passphrase opens only a tree some harness bound to it: a tree a person founded answers it `no-slot-opens`.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  FsCustodyIo, makeCustodyHolder, seatCustodyWhenNeeded, vesselCustodyHomes, type CustodyHolder,
} from "@lararium/node";
import { gatherCredentials } from "./custody-prompt.js";
import { canPromptSecret } from "./prompt-secret.js";

/** The marker a harness writes at a root it staged. */
export const TEST_SCRATCH_MARKER = ".lar-test-scratch";
/** The published test route (`tools/test-custody-route.mjs` carries the same string; a test holds the two together). */
export const TEST_ROUTE_PASSPHRASE = "test-founding-passphrase";

/** The session that could not open: no terminal to ask on, no tree to open, or no route that opens it. */
export class OfflineCustodyRefused extends Error {
  override readonly name = "OfflineCustodyRefused";
  constructor(detail: string) {
    super(`this command reads rows sealed under the vessel key, and the key did not open: ${detail}`);
  }
}

/** Whether `LAR_ROOT` names a root a harness staged. */
export function testScratchRoot(env: NodeJS.ProcessEnv = process.env): boolean {
  const root = env["LAR_ROOT"];
  return !!root && existsSync(join(root, TEST_SCRATCH_MARKER));
}

function refusal(reading: string): OfflineCustodyRefused {
  switch (reading) {
    case "tree-absent":     return new OfflineCustodyRefused("no custody stands at this root (a founding seals custody from birth: `lares vessel found`).");
    case "attempts-spent":  return new OfflineCustodyRefused("three routes failed in this run; run the command again.");
    case "root-unopenable": return new OfflineCustodyRefused("the vessel key opened and the custody root did not; recover the custody root from a backup.");
    default:                return new OfflineCustodyRefused(`the slot tree reads ${reading}.`);
  }
}

/** Open `holder` for this command: the test route under a staged root, else a terminal prompt, up to the holder's bound. */
export async function openOfflineCustody(holder: CustodyHolder): Promise<void> {
  // ONE KEY SESSION PER VESSEL. A custody door that answers names a standing vessel: it holds the session, or
  // rests locked until a person opens it. Either way this process opens none beside it.
  // (The door's module loads here, at the first sealed row, so seating a session reaches for no socket.)
  const { vesselStanding } = await import("./custody-door.js");
  const standing = await vesselStanding();
  if (standing.reading === "vessel") {
    throw new OfflineCustodyRefused(standing.unlocked
      ? "a vessel stands on this store and holds the key session, and this command read a sealed row in its own process beside it. " +
        "A sealed act rides the vessel's custody door; this command took another road, which the build refuses. Stop the vessel to run it alone."
      : "a vessel stands on this store and rests locked. Open it with `lares vault unlock`, then run the command again.");
  }
  if (standing.reading === "silent") {
    throw new OfflineCustodyRefused("something holds this store's socket and gives no answer, so no second key session opens beside it. Check `lares vessel read`, then run the command again.");
  }
  if (testScratchRoot()) {
    process.stderr.write("[custody] TEST SCRATCH ROOT: opening the vessel key under the published test route\n");
    const route = [{ kind: "passphrase" as const, passphrase: TEST_ROUTE_PASSPHRASE }];
    const u = await holder.unlock(route);
    if (u.reading === "opens" || u.reading === "already-unlocked") { await holder.unlockFaces(route); return; }
    throw u.reading === "no-slot-opens"
      ? new OfflineCustodyRefused("this staged root's custody answers no test route; it was bound to another.")
      : refusal(u.reading);
  }
  if (!canPromptSecret()) {
    throw new OfflineCustodyRefused(
      "no terminal stands to ask for a route (no flag, environment variable or pipe carries one). Run the command on a terminal, " +
      "or stand the vessel, run `lares vault unlock`, and run it again so the vessel answers it.",
    );
  }
  process.stdout.write("This command opens rows sealed under the vessel key.\n");
  for (;;) {
    const typed = await gatherCredentials("this command");
    const u = await holder.unlock(typed);
    // The typed credential tries every face tree too (`--all`): a face it does not fit stays shut and costs nothing.
    if (u.reading === "opens" || u.reading === "already-unlocked") { await holder.unlockFaces(typed); return; }
    if (u.reading !== "no-slot-opens") throw refusal(u.reading);
    if (u.attemptsLeft <= 0) throw refusal("attempts-spent");
    process.stdout.write(`  no slot opens under that route; ${u.attemptsLeft} attempt(s) left.\n`);
  }
}

/** Seat this command's own holder. Nothing opens, and no home is read, until a sealed row is first asked for. */
export function seatOfflineCustody(): void {
  seatCustodyWhenNeeded(() => {
    const homes = vesselCustodyHomes();
    return makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  }, openOfflineCustody);
}
