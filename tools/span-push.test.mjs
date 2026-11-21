// span-push.test — the pinned checks and the one CI read that gate a span push, all through injected hands: no test
// pushes, and none calls the real `gh`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PINS, QUIET_SPANS, spanPush } from "./span-push.mjs";

const TOOL = fileURLToPath(new URL("./span-push.mjs", import.meta.url));

/** Hands that record each call; `pins` maps a pin name to its exit code, `runs` answers every gh read, `changed` names the
 *  paths the push carries over the remote's head (null: the remote head reads unknown). */
function hands({ pins = {}, runs = [], ghError = null, pushStatus = 0, changed = ["tools/land-train.mjs", "bags/lares/x.mem"] } = {}) {
  const calls = [], said = [];
  return {
    calls, said,
    ops: {
      pin: (step) => { calls.push(`pin ${step.name}`); return pins[step.name] ?? 0; },
      gh: (args) => { calls.push(`gh ${args.join(" ")}`); if (ghError) throw ghError; return runs.filter((r) => args.includes(r.status)); },
      changed: (remote, branch) => { calls.push(`changed ${remote} ${branch}`); return changed; },
      push: (remote, branch) => { calls.push(`push ${remote} ${branch}`); return { status: pushStatus, stderr: pushStatus ? "rejected" : "" }; },
      head: () => "0123456789abcdef",
      say: (line) => said.push(line),
    },
  };
}
const pushed = (calls) => calls.filter((c) => c.startsWith("push "));

test("CONTROL: green pins and no run in flight push the branch once, after every pin and the CI read", async () => {
  const h = hands({ runs: [{ status: "completed" }] });
  const { code } = await spanPush({ branch: "feature/span" }, h.ops);
  assert.equal(code, 0);
  assert.deepEqual(pushed(h.calls), ["push origin feature/span"]);
  assert.deepEqual(h.calls.filter((c) => c.startsWith("pin ")), PINS.map((p) => `pin ${p.name}`));
  assert.ok(h.calls.indexOf("push origin feature/span") > h.calls.findLastIndex((c) => c.startsWith("gh ")), "the CI read precedes the push");
  assert.match(h.said.join("\n"), /pushed 0123456789ab/);
});

test("the pins carry the rite walker's self-test, the bcc witness and the evergreen witness", () => {
  assert.deepEqual(PINS.map((p) => [p.cmd, ...p.args].join(" ")), [
    "node --test tools/rite-walk.test.mjs",
    "bash tools/bcc-witness.sh",
    "bash tools/evergreen-boundary-witness.sh",
  ]);
});

test("a red pin refuses by name, runs every pin, and never reads CI or pushes", async () => {
  const h = hands({ pins: { bcc: 1 } });
  const { code } = await spanPush({ branch: "feature/span" }, h.ops);
  assert.equal(code, 1);
  assert.equal(h.calls.filter((c) => c.startsWith("pin ")).length, PINS.length);
  assert.deepEqual(h.calls.filter((c) => c.startsWith("gh ") || c.startsWith("push ")), []);
  assert.match(h.said.join("\n"), /SPAN PUSH REFUSES: bcc \(exit 1\)/);
});

test("a run in flight on the branch refuses (exit 3) and never pushes; every active status reads, not only the newest five", async () => {
  const h = hands({ runs: [{ status: "completed" }, { status: "queued" }, { status: "waiting" }] });
  const { code } = await spanPush({ branch: "feature/span" }, h.ops);
  assert.equal(code, 3);
  assert.deepEqual(pushed(h.calls), []);
  assert.match(h.said.join("\n"), /2 run\(s\) still in flight/);
  for (const status of ["queued", "in_progress", "waiting", "requested", "pending"]) assert.ok(h.calls.some((c) => c.includes(`--branch feature/span --status ${status}`)), `no read of ${status}`);
});

test("RED: a canon-only push to develop or main cancels no run (CI lets the run in flight finish there), so it pushes past runs in flight unread", async () => {
  for (const branch of ["develop", "main"]) {
    const h = hands({ runs: [{ status: "in_progress" }, { status: "queued" }], changed: ["bags/lares/ha.ka.ba/lares/docs/pono/x.mem", "wikis/w/t.tid", "README.md"] });
    const { code } = await spanPush({ branch }, h.ops);
    assert.equal(code, 0);
    assert.deepEqual(pushed(h.calls), [`push origin ${branch}`]);
    assert.deepEqual(h.calls.filter((c) => c.startsWith("gh ")), [], "a canon-only push to the span reads no CI: no run it could cancel");
    assert.ok(h.calls.indexOf(`changed origin ${branch}`) > h.calls.findLastIndex((c) => c.startsWith("pin ")), "the pins run first");
    assert.match(h.said.join("\n"), /ignored paths alone/);
    assert.match(h.said.join("\n"), /doorstep/);
  }
});

test("RED: the spans span-push pushes canon past are exactly the refs whose CI run in flight ci.yml never cancels", () => {
  const ci = readFileSync(fileURLToPath(new URL("../.github/workflows/ci.yml", import.meta.url)), "utf8");
  const cancel = /^concurrency:\n {2}group: .*\n {2}cancel-in-progress: (.*)$/m.exec(ci)?.[1];
  assert.equal(cancel, `\${{ ${QUIET_SPANS.map((b) => `github.ref != 'refs/heads/${b}'`).join(" && ")} }}`, "ci.yml cancels a run in flight on a span span-push pushes canon onto unread");
});

test("RED: a canon-only push to any other branch raises a doorstep run that cancels the one in flight, so it keeps the in-flight refusal", async () => {
  const h = hands({ runs: [{ status: "in_progress" }], changed: ["bags/lares/x.mem"] });
  const { code } = await spanPush({ branch: "feature/span" }, h.ops);
  assert.equal(code, 3);
  assert.deepEqual(pushed(h.calls), []);
});

test("CONTROL: one code path among the ignored ones, or a remote head the checkout cannot read, keeps the in-flight refusal", async () => {
  for (const changed of [["bags/lares/x.mem", "tools/span-push.mjs"], null, []]) {
    const h = hands({ runs: [{ status: "in_progress" }], changed });
    const { code } = await spanPush({ branch: "develop" }, h.ops);
    assert.equal(code, 3, `changed ${JSON.stringify(changed)} pushed past a run in flight`);
    assert.deepEqual(pushed(h.calls), []);
  }
});

test("an unreadable GitHub waits as UNREADABLE (exit 10), never reads as clear, and never pushes", async () => {
  const h = hands({ ghError: Object.assign(new Error("HTTP 502: Bad Gateway"), { stderr: "HTTP 502" }) });
  const { code } = await spanPush({ branch: "feature/span" }, h.ops);
  assert.equal(code, 10);
  assert.deepEqual(pushed(h.calls), []);
  assert.match(h.said.join("\n"), /UNREADABLE/);
});

test("a hard gh failure refuses (exit 5) and never pushes", async () => {
  const h = hands({ ghError: Object.assign(new Error("HTTP 404: Not Found"), { stderr: "HTTP 404" }) });
  const { code } = await spanPush({ branch: "feature/span" }, h.ops);
  assert.equal(code, 5);
  assert.deepEqual(pushed(h.calls), []);
});

test("a rejected push exits 6 and names the rejection", async () => {
  const h = hands({ pushStatus: 1 });
  const { code } = await spanPush({ branch: "feature/span" }, h.ops);
  assert.equal(code, 6);
  assert.match(h.said.join("\n"), /rejected/);
});

test("the CLI wants the branch: no argument exits 2 before any pin, read or push", () => {
  const r = spawnSync(process.execPath, [TOOL], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: span-push\.mjs/);
});
