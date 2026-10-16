/**
 * `lares fleet join` — one face's fleet takes a new vessel of the same human (`@lararium/node` `commands/fleet-join`).
 *
 *   lares fleet join offer   [--face N] [--out FILE]         on the root holder: the face, its root key, a nonce,
 *                                                            and the scopes the face stands at
 *   lares fleet join request <offer-file> [--out FILE]       on the joining PLACE: its face-scoped keys mint here,
 *                                                            and the join stays pending until its answer lands
 *   lares fleet join answer  <request-file> [--face N] [--out FILE] [--sync-url URL]
 *                                                            on the root holder: the signed answer, with the gate
 *                                                            pin, the canon list and the face's sealed address secret
 *   lares fleet join land    <answer-file>                   on the joining place: the face lands
 *   lares fleet join abandon                                 on the joining place: the pending join leaves
 *
 * THREE FILES BY COURIER, and the order carries the property: the joining vessel mints first, so its private keys
 * mint on it and stay there, and the one secret that crosses (the address secret) crosses sealed to a key its
 * request named. The joinee reads the answer under the root key its kept offer named, so the courier carries that
 * key before the answer exists.
 *
 * `--face N` names which of the root holder's faces the join serves (default 0, the founding face); the answer
 * names the same face its offer named. The index stays local to the root holder: the offer and the answer name the
 * face by its PersonaGroup and root key, so the joining vessel takes no `--face`.
 *
 * The root holder's two acts ride the store door (inside the standing vessel when one stands); the joining
 * vessel's acts run in this process with no vessel standing, as a founding does.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runFleetJoinRequest, runFleetJoinLand, runFleetJoinAbandon, FleetJoinRefused, ownedStore, StoreHeld, larDataDir,
} from "@lararium/node";
import type { ParsedArgs } from "../parse-args.js";
import { refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { storeVerb, StoreDoorRefusal } from "../store-door.js";

function usage(args: ParsedArgs): number {
  return refuseUsage(args, "fleet", helpLines("fleet"));
}

function readJson(path: string | undefined, what: string): unknown {
  if (!path) throw new FleetJoinRefused(`${what}-absent`, `name the ${what} file.`);
  try { return JSON.parse(readFileSync(resolve(path), "utf8")) as unknown; }
  catch { throw new FleetJoinRefused(`${what}-unread`, `${path} does not read as JSON.`); }
}

/** Write the file the next vessel reads, or print it. */
function emitFile(args: ParsedArgs, value: unknown, what: string): void {
  const json = JSON.stringify(value, null, 2);
  const out = args.options["out"];
  if (!out) { process.stdout.write(json + "\n"); return; }
  const at = resolve(out);
  writeFileSync(at, json, "utf8");
  console.log(`[lares fleet join] ${what} written to ${at}`);
}

/** The face a root holder's act names: `--face N`, a whole number from 0, or nothing for the founding face. */
function faceOf(args: ParsedArgs): { face?: number } {
  const raw = args.options["face"];
  // A bare `--face` (or `--no-face`) names no index: it refuses rather than fall back to the founding face.
  if (args.flags["face"] !== undefined) throw new FleetJoinRefused("face-malformed", "--face names a persona index: give it one, as `--face 1`.");
  if (raw === undefined) return {};
  const face = typeof raw === "string" && /^(?:0|[1-9][0-9]{0,5})$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(face)) throw new FleetJoinRefused("face-malformed", `--face names a persona index: a whole number from 0, never ${JSON.stringify(raw)}.`);
  return { face };
}

export async function cmdFleet(args: ParsedArgs): Promise<number> {
  const [group, act, file] = args.positional;
  if (group !== "join" || act === undefined) return usage(args);
  try {
    switch (act) {
      case "offer": {
        const { offer } = (await storeVerb("fleet-join-offer", { ...faceOf(args) })).output as { offer: unknown };
        emitFile(args, offer, "offer");
        console.log("[lares fleet join] carry the offer to the joining vessel: `lares fleet join request <offer-file>`.");
        return 0;
      }
      case "request": {
        const request = await runFleetJoinRequest({ offer: readJson(file, "offer") });
        emitFile(args, request, "request");
        console.log("[lares fleet join] carry the request back to the root holder: `lares fleet join answer <request-file>`.");
        return 0;
      }
      case "answer": {
        const syncUrl = args.options["sync-url"];
        const { answer } = (await storeVerb("fleet-join-answer", { request: readJson(file, "request"), ...faceOf(args), ...(syncUrl ? { syncUrl } : {}) })).output as { answer: unknown };
        emitFile(args, answer, "answer");
        console.log("[lares fleet join] carry the answer to the joining vessel: `lares fleet join land <answer-file>`.");
        return 0;
      }
      case "land": {
        const answer = readJson(file, "answer");
        await ownedStore(larDataDir(), (repo) => runFleetJoinLand({ repo, answer }));
        console.log("[lares fleet join] landed — the face stands on this vessel. Start with: lares vessel stand --with-web");
        return 0;
      }
      case "abandon": {
        const stood = await runFleetJoinAbandon();
        console.log(stood ? "[lares fleet join] the pending join left this vessel." : "[lares fleet join] no join stood pending here.");
        return 0;
      }
      default:
        return usage(args);
    }
  } catch (err) {
    if (err instanceof FleetJoinRefused || err instanceof StoreDoorRefusal) { console.error(`[lares fleet join] refused: ${err.message}`); return 1; }
    if (err instanceof StoreHeld) { console.error("[lares fleet join] refused: StoreHeld: the joining vessel's acts run with no vessel standing — stop it, then run again."); return 1; }
    throw err;
  }
}
