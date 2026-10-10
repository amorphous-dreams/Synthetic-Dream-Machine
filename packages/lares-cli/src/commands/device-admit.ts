/**
 * `lares device-admit` — admit a new vessel into the operator's own PersonaGroup.
 *
 * THE JOINEE MINTS FIRST, and the order carries the property. Admission SIGNS a key the joining vessel
 * already holds; it never issues one. So the private seed is born on the joining device and stays there,
 * only the PUBLIC verifying key crosses, and this call refuses without it. That ordering is what keeps a
 * QR ceremony photograph-inert: the payload names a key whose holder already proved it holds it.
 *
 * ONE OPERATOR'S OWN FLEET, and no further. A second OPERATOR joins a Nexus by carriage contract
 * (`lares nexus accept-carriage` · `lares nexus contract`), which is a different axis entirely — this
 * door binds devices to one persona root, never people to each other.
 *
 * Transport (QR · NFC · LAN) rides whatever channel the operator already trusts; the payload is a file.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DeviceAdmitResult } from "@lararium/node";
import type { ParsedArgs } from "../parse-args.js";
import { storeVerb } from "../store-door.js";

export async function cmdDeviceAdmit(args: ParsedArgs): Promise<number> {
  const joineeKey = args.options["joinee-key"];
  if (!joineeKey) {
    console.error("[lares device-admit] --joinee-key <hex> required — the joining vessel's PUBLIC verifying key.");
    return 2;
  }
  const syncUrl = args.options["sync-url"];
  // ONE STORE DOOR: the edge reads the founder's boards on the store's one holder — inside the standing vessel
  // when one stands, here otherwise — and this process alone writes and prints what the door minted.
  const { payload, carried } = (await storeVerb("device-admit", {
    joineeVerifyingKey: joineeKey, ...(syncUrl ? { syncUrl } : {}),
  })).output as unknown as DeviceAdmitResult;

  const json = JSON.stringify(carried, null, 2);
  const out = args.options["out"];
  if (out) {
    const at = resolve(out);
    writeFileSync(at, json, "utf8");
    console.log(`[lares device-admit] payload written to ${at}`);
  } else {
    process.stdout.write(json + "\n");
  }

  // The CARRIED form. The payload is a signed capability, so it needs no trusted channel and no
  // reachable issuer: a hostile carrier may WITHHOLD it, never forge it. It rides in the URL FRAGMENT,
  // which browsers do not transmit — so the bytes reach the vessel by whatever the human used (a paste,
  // a QR held up to a screen, a file on a stick) and touch no network on the way.
  //
  // The alternative — a `GET /admit/<key>` the vessel calls — makes the vessel a client PETITIONING an
  // authority for its own admission, and it demands that authority be REACHABLE at the moment of asking.
  // That is a global now, and this house does not have one.
  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  console.log("");
  console.log("[lares device-admit] carry this to the joining vessel — the fragment never leaves the browser:");
  console.log(`  #admit=${b64}`);
  return 0;
}
