#!/usr/bin/env node
/**
 * lararium CLI — minimal dev/diagnostic tool.
 * Usage: lararium <command> [args]
 *   resolve <uri>          Resolve a lar:/// URI
 *   carrier <uri>          Read and validate a carrier
 *   boot                   Compile boot artifact
 *   receipt                Compile boot receipt
 */

import { readCarrier, compileBootArtifact } from "./node-host.js";
import { resolveLarUri, compileBootReceipt } from "@lararium/core";

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case "resolve": {
    const uri = args[0];
    if (!uri) { console.error("Usage: lararium resolve <uri>"); process.exit(1); }
    console.log(JSON.stringify(resolveLarUri(uri), null, 2));
    break;
  }
  case "carrier": {
    const uri = args[0];
    if (!uri) { console.error("Usage: lararium carrier <uri>"); process.exit(1); }
    console.log(JSON.stringify(readCarrier(uri), null, 2));
    break;
  }
  case "boot": {
    console.log(JSON.stringify(compileBootArtifact(), null, 2));
    break;
  }
  case "receipt": {
    compileBootReceipt(compileBootArtifact()).then((receipt) => {
      console.log(JSON.stringify(receipt, null, 2));
    });
    break;
  }
  default:
    console.error("Unknown command:", cmd);
    console.error("Commands: resolve, carrier, boot, receipt");
    process.exit(1);
}
