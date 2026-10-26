/**
 * found-route — the ONE harness helper every CLI test founding passes through (a vitest setup file).
 *
 * A founding seals custody from birth and refuses without a human route; the CLI gathers that route from a TTY
 * in production, and no flag or env var carries one. A test has no TTY, so this installs a fixed test passphrase
 * as the founding route for every suite. The passphrase guards nothing: every founding runs under a scratch root.
 */
import { seatFaceRoute } from "@lararium/node";
import { setFoundingRoute } from "../../src/commands/found.js";

export const TEST_PASSPHRASE = "test-founding-passphrase";
setFoundingRoute(async () => [{ t: 1, pins: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] }]);

// A new face asks its own route as well; the suites answer it with the same test passphrase.
seatFaceRoute(async () => [{ t: 1, pins: [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }] }]);
