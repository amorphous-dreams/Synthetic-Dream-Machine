#!/usr/bin/env node
/**
 * lararium CLI — minimal dev/diagnostic tool.
 * Usage: lararium <command> [args]
 *   resolve <uri>          Resolve a lar:/// URI
 *   carrier <uri>          Read and validate a carrier
 *   minimal-boot           Compile minimal boot artifact
 *   full-boot              Compile full boot artifact
 *   receipt                Compile minimal boot receipt
 */

import { createLarariumRuntime } from "./node-host.js";
import { resolveLarUri } from "@lararium/core";

const [, , cmd, ...args] = process.argv;

const runtime = createLarariumRuntime({ writeback: false });

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
    console.log(JSON.stringify(runtime.readCarrier(uri), null, 2));
    break;
  }
  case "minimal-boot": {
    const artifact = runtime.compileMinimalBoot();
    console.log(JSON.stringify(artifact, null, 2));
    break;
  }
  case "full-boot": {
    const artifact = runtime.compileFullBoot();
    console.log(JSON.stringify(artifact, null, 2));
    break;
  }
  case "receipt": {
    const artifact = runtime.compileMinimalBoot();
    console.log(JSON.stringify(runtime.compileBootReceipt(artifact), null, 2));
    break;
  }
  default:
    console.error("Unknown command:", cmd);
    console.error("Commands: resolve, carrier, minimal-boot, full-boot, receipt");
    process.exit(1);
}
