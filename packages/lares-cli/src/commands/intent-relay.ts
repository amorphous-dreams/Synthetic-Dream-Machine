/** The relay's operator switch and public admission key. */
import type { ParsedArgs } from "../parse-args.js";
import { helpLines } from "../command-help.js";
import { refuseUsage } from "../render.js";
import { storeVerb, StoreDoorRefusal } from "../store-door.js";

export async function cmdIntentRelay(args: ParsedArgs): Promise<number> {
  const action = args.positional[0];
  if (action !== "enable" && action !== "disable" && action !== "status" && action !== "rotate") return refuseUsage(args, "intent-relay", helpLines("intent-relay"));
  try {
    const raw = args.options["face"];
    if (args.flags["face"] !== undefined || (raw !== undefined && (!/^(?:0|[1-9][0-9]*)$/.test(raw) || !Number.isSafeInteger(Number(raw))))) throw new Error("face-malformed: --face needs a whole persona index");
    const { output } = await storeVerb(`intent-relay-${action}`, raw === undefined ? {} : { face: Number(raw) });
    if (args.flags["json"] === true) console.log(JSON.stringify(output));
    else if (output["refused"]) console.error(`[lares intent-relay] refused: ${output["refused"]}`);
    else console.log(JSON.stringify(output));
    return output["refused"] ? 1 : 0;
  } catch (error) {
    if (error instanceof StoreDoorRefusal || error instanceof Error) { console.error(`[lares intent-relay] refused: ${error.message}`); return 1; }
    throw error;
  }
}
