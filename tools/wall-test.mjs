/**
 * wall-test — a test that needs the bubblewrap wall.
 *
 * Locally a host without bubblewrap (or SEAT_WALLS_NO_BWRAP set) skips it. On CI (CI=true) a missing wall FAILS it by name:
 * the runner step installs and proves bubblewrap, so a skip there would read green over an unexercised wall.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { HAVE_BWRAP } from "./seat-walls.mjs";

export function wallTest(name, fn) {
  const onCi = Boolean(process.env.CI);
  return test(name, { skip: !HAVE_BWRAP && !onCi && "no bubblewrap on this host (local run)" }, async (t) => {
    if (!HAVE_BWRAP) assert.fail(`bubblewrap is required on CI and is missing or failed its proof: ${name}`);
    await fn(t);
  });
}
