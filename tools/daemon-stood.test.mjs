// A staged daemon is ready for a verb when its verb channel answers, and the daemon says so once on its console. The
// line `phase → live` precedes that: the composition stands, the channel still attaches behind it, so a door driven at
// "live" meets a deaf socket under load (null answers, an unlock racing the daemon's own boot). Every harness that
// stands a daemon waits on the channel's own line, through this one reader.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { daemonStood } from "./daemon-stood.mjs";

const live = "[lararium] phase → live\n";
const channel = "[lararium] uds verb-channel on /tmp/lares-1000/ab12.sock (perms 0600)\n";

test("RED: a log that says live and nothing of the channel has not stood", () => {
  assert.equal(daemonStood(live), false);
});

test("CONTROL: the log that names the channel has stood, a lararium and a herm alike", () => {
  assert.equal(daemonStood(live + channel), true);
  assert.equal(daemonStood("[herm] phase → live\n[herm] uds verb-channel on /tmp/x.sock (perms 0600)\n"), true);
});

test("the four daemon harnesses wait through the reader, never on `phase → live` alone", () => {
  for (const f of ["custody-census-witness.mjs", "vault-backup-door.test.mjs", "vault-restore-door.test.mjs", "custody-door.test.mjs"]) {
    const text = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.match(text, /daemonStood\(/, `${f} waits through daemonStood`);
  }
});
