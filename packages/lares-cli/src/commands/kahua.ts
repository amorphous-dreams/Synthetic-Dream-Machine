/**
 * kahua — the operator's door onto one face's kahua stage: mint its pin, propose, lift and withdraw by hand, read.
 *
 * Each act rides the store door's matching face row (`kahua-mint`, `kahua-propose`, `kahua-lift`, `kahua-withdraw`,
 * `kahua-read`), through the standing vessel's session when one stands, and prints the row's answer as JSON. A lift
 * names its taint list (`--taint none` when every input came from inside the face) and its daemon sources; the row
 * reads the lōkahi cap off the vessel's island and the operator's grant out of sealed custody, and refuses by name.
 * After a root rotation the earlier items read in history alone until the operator's hand `carry`s them (named cids,
 * or `--all`): one root-signed act at the current epoch. An AI seat proposes (`propose`, or the MCP's `kahua_propose`);
 * its session never runs a lift, a withdraw or a carry, and no MCP tool carries.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import type { ParsedArgs } from "../parse-args.js";
import { helpLines } from "../command-help.js";
import { refuseUsage } from "../render.js";
import { storeVerb, StoreDoorRefusal } from "../store-door.js";

const ACTS = new Set(["mint", "propose", "lift", "withdraw", "carry", "list", "get"]);

function faceOf(args: ParsedArgs): { face?: number } {
  const raw = args.options["face"];
  if (args.flags["face"] !== undefined) throw new Error("face-malformed: --face needs a whole persona index");
  if (raw === undefined) return {};
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error("face-malformed: --face needs a whole persona index from 0");
  return { face: Number(raw) };
}

function json(raw: string | undefined, key: string): unknown {
  if (raw === undefined) return undefined;
  try { return JSON.parse(raw) as unknown; }
  catch { throw new Error(`${key}-malformed: --${key} needs JSON`); }
}

function liftArgs(args: ParsedArgs, title: string): Record<string, unknown> {
  const taint = args.options["taint"];
  if (taint === undefined) throw new Error("kahua-act-refused: taint: name --taint (`none` when every input came from inside the face)");
  const parent = args.options["parent"];
  const sources = json(args.options["sources"], "sources"), fields = json(args.options["fields"], "fields");
  return {
    title, text: args.options["text"] ?? "",
    taint: taint === "none" ? [] : taint.split(",").map((t) => t.trim()).filter((t) => t.length > 0),
    ...(sources !== undefined ? { sources } : {}),
    ...(parent !== undefined ? { parent: parent === "none" ? null : parent } : {}),
    ...(args.options["proposal"] !== undefined ? { proposal: args.options["proposal"] } : {}),
    ...(fields !== undefined ? { fields } : {}),
  };
}

export async function cmdKahua(args: ParsedArgs): Promise<number> {
  const [act, target] = args.positional;
  if (!act || !ACTS.has(act)) return refuseUsage(args, "kahua", helpLines("kahua"));
  try {
    const face = faceOf(args);
    const need = (what: string): string => { if (!target) throw new Error(`${act}: name ${what}`); return target; };
    let door: "kahua-mint" | "kahua-propose" | "kahua-lift" | "kahua-withdraw" | "kahua-carry" | "kahua-read";
    let payload: Record<string, unknown>;
    switch (act) {
      case "mint": door = "kahua-mint"; payload = {}; break;
      case "propose": {
        const proposals = json(args.options["proposals"], "proposals");
        if (!Array.isArray(proposals)) throw new Error("kahua-proposal-proposals: name --proposals as a JSON list of {title, revision, text|digest, taint}");
        door = "kahua-propose"; payload = { proposals };
        break;
      }
      case "lift": door = "kahua-lift"; payload = liftArgs(args, need("a title")); break;
      case "withdraw": door = "kahua-withdraw"; payload = { target: need("a revision cid") }; break;
      case "carry": {
        const cids = args.positional.slice(1), all = args.flags["all"] === true;
        if (all === (cids.length > 0)) throw new Error("carry: name the revision cids that keep standing, or --all (never both)");
        door = "kahua-carry"; payload = all ? { all: true } : { cids };
        break;
      }
      case "list": door = "kahua-read"; payload = { action: "list" }; break;
      default: door = "kahua-read"; payload = { action: "get", title: need("a title"), ...(args.flags["history"] === true ? { history: true } : {}) };
    }
    const { output } = await storeVerb(door, { ...face, ...payload });
    console.log(JSON.stringify(output));
    return 0;
  } catch (err) {
    if (err instanceof StoreDoorRefusal || err instanceof Error) { console.error(`[lares kahua] refused: ${err.message}`); return 1; }
    throw err;
  }
}
