/**
 * lan-candidates — listen once for LAN candidates and print them.
 *
 *   node packages/lararium-node/dist/scripts/lan-candidates.js [--wait <ms>]
 *
 * Sends the one PTR question for `_lararium._tcp.local` and prints one JSON line per candidate
 * (`{"url":"http://<address>:<port>","instance":"<8 hex>"}`) as each answers. When the wait bound passes it exits
 * 0 if any candidate answered and 3 (`no candidate answered`) otherwise. The bound only bounds the wait: it marks
 * no peer lapsed. A vessel announcing in the same network namespace answers too, so a listener beside a standing
 * vessel reads that vessel's own address among the lines.
 *
 * A candidate names an address to try and grants nothing; the gate key arrives by an admission a human carried
 * (lar:///ha.ka.ba/lararium/mesh/harbor#/lan-discovery).
 */
import { createLanListener, dgramLanSocket } from "../src/lan-discovery.js";

function waitBound(args: readonly string[]): number {
  let wait = 3000;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== "--wait" || i + 1 >= args.length || args[i + 1]!.startsWith("--")) {
      throw new Error("usage: lan-candidates.js [--wait <ms>]");
    }
    const value = Number(args[++i]);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("--wait must be a non-negative integer in milliseconds");
    wait = value;
  }
  return wait;
}

let wait: number;
try {
  wait = waitBound(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const socket = dgramLanSocket();
let heard = 0;
const listener = createLanListener({
  socket,
  onCandidate(candidate) {
    heard++;
    console.log(JSON.stringify(candidate));
  },
});
socket.onError((error) => console.error(`[lararium] LAN discovery socket error: ${error.message}`));
listener.query();
setTimeout(() => {
  listener.close();
  if (heard === 0) console.error("no candidate answered");
  process.exit(heard === 0 ? 3 : 0);
}, wait);
