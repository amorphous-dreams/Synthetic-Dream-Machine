/** One invocation names the face whose intent plane the store holder reads or writes. */
import type { ParsedArgs } from "../parse-args.js";
import { helpLines } from "../command-help.js";
import { refuseUsage } from "../render.js";
import { storeVerb, StoreDoorRefusal } from "../store-door.js";

const acts = new Set(["issue", "show", "ask", "answer", "claim", "takeover", "release", "cancel", "supersede", "release-root"]);
function faceOf(args: ParsedArgs): { face?: number } {
  const raw = args.options["face"];
  if (args.flags["face"] !== undefined) throw new Error("face-malformed: --face needs a whole persona index");
  if (raw === undefined) return {};
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error("face-malformed: --face needs a whole persona index from 0");
  return { face: Number(raw) };
}

export async function cmdIntent(args: ParsedArgs): Promise<number> {
  const [act, target] = args.positional;
  if (!act || !acts.has(act)) return refuseUsage(args, "intent", helpLines("intent"));
  try {
    const face = faceOf(args);
    const root = act === "cancel" || act === "supersede" || act === "release-root";
    const steer = act === "claim" || act === "takeover" || act === "release";
    const door = act === "issue" ? "intent-issue" : act === "show" ? "intent-show" : act === "ask" ? "intent-ask"
      : act === "answer" ? "intent-answer" : root ? "intent-root" : "intent-steer";
    let jsonArgs: unknown;
    if (args.options["args"] !== undefined) {
      try { jsonArgs = JSON.parse(args.options["args"]!); }
      catch { throw new Error("args-malformed: --args needs JSON"); }
    }
    if (act !== "show" && !target) throw new Error(`${act}: name ${act === "issue" ? "a verb" : "an id or CID"}`);
    const payload: Record<string, unknown> = { ...face,
      ...(act === "issue" ? { intentVerb: target } : target ? { target } : {}),
      ...(root || steer ? { action: act } : {}),
      ...(jsonArgs !== undefined ? { args: jsonArgs } : {}),
      ...(args.options["to"] !== undefined ? { to: args.options["to"] } : {}),
      ...(args.options["prefer"] !== undefined ? { prefer: args.options["prefer"] } : {}),
      ...(args.options["class"] !== undefined ? { class: args.options["class"] } : {}),
      ...(args.options["nonce"] !== undefined ? { nonce: args.options["nonce"] } : {}),
      ...(args.options["through"] !== undefined ? { through: args.options["through"] } : {}),
      ...(args.options["executor"] !== undefined ? { executor: args.options["executor"] } : {}),
      ...(args.options["void-at"] !== undefined ? { voidAt: args.options["void-at"] } : {}),
      ...(args.flags["every"] === true ? { every: true } : {}),
      ...(args.flags["deny"] === true ? { deny: true } : {}),
    };
    const { output } = await storeVerb(door as Parameters<typeof storeVerb>[0], payload);
    if (act === "show") {
      if (args.flags["json"] === true) console.log(JSON.stringify(output));
      else {
        const rows = output["rows"] as Array<Record<string, unknown>>;
        for (const row of rows ?? []) console.log(`${row["id"]} ${row["status"]} winner=${row["winner"] ?? "none"} duplicates=${JSON.stringify(row["duplicates"])} void-after-act=${JSON.stringify(row["voidAfterAct"])} outcomes=${row["outcomeCount"]}`);
        console.log(`standing=${output["standing"]} stray-answers=${JSON.stringify(output["strayAnswers"])} refused=${JSON.stringify(output["refused"])}`);
      }
    } else console.log(String(output["id"] ?? output["cid"]));
    return 0;
  } catch (err) {
    if (err instanceof StoreDoorRefusal || err instanceof Error) { console.error(`[lares intent] refused: ${err.message}`); return 1; }
    throw err;
  }
}
