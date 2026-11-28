import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERDICT_KIND } from "./bench-gate.mjs";
import { floorCommand, gate, houseRoot, parseArgs, redeclareUnbaked, verdictPath } from "./floor-gate.mjs";

const BASE = "b".repeat(40), HEAD = "a".repeat(40), TREE = "c".repeat(40), MOVED = "d".repeat(40);
const PLAN = [
  { name: "merge-develop", stop: true, check: "merge" },
  { name: "build", stop: true, cmd: "pnpm", args: ["build"], cwd: "." },
  { name: "redeclare-unbaked", stop: true, check: "unbaked" },
  { name: "commit-build", stop: true, check: "commit" },
  { name: "witnesses-fast", cmd: "bash", args: ["tools/witness-all.sh", "--fast"], cwd: "." },
  { name: "touched-lares-cli", cmd: "npx", args: ["vitest", "run", "tests/x.test.ts"], cwd: "packages/lares-cli" },
];

/** A fake spawn over a planted repo: git reads answer from the state; every call lands in `calls`; `red` names steps that exit 3. */
function fakeRepo({ red = [], developAfter = BASE, pushStatus = 0, remote = HEAD, dirtyAfter = false, wrote = "" } = {}) {
  const calls = [];
  let fetches = 0;
  const sh = (cmd, args, opts = {}) => {
    calls.push([cmd, ...args].join(" "));
    if (cmd !== "git") return { status: red.includes(args.join(" ")) ? 3 : 0, stdout: "", stderr: "" };
    const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
    const [verb, ...rest] = args;
    if (verb === "fetch") { fetches++; return ok(); }
    if (verb === "rev-parse") {
      if (rest[0] === "origin/develop") return ok(`${fetches > 1 ? developAfter : BASE}\n`);
      if (rest[0] === "--short") return ok("aaaaaaa\n");
      if (rest[0] === "HEAD^{tree}") return ok(`${TREE}\n`);
      return ok(`${HEAD}\n`);
    }
    if (verb === "diff" && rest[0] === "--name-only" && rest[1] === "HEAD") return ok(wrote);
    if (verb === "diff") return ok("packages/lares-cli/tests/x.test.ts\n");
    if (verb === "status") return ok(dirtyAfter ? " M packages/x.ts\n" : "");
    if (verb === "ls-files") return ok("");
    if (verb === "merge") return { status: red.includes("merge") ? 1 : 0, stdout: "", stderr: "" };
    if (verb === "push") return { status: pushStatus, stdout: "", stderr: "" };
    if (verb === "ls-remote") return ok(`${remote}\trefs/heads/develop\n`);
    return ok();
  };
  return { sh, calls };
}

const run = (repo, over = {}) => {
  const said = [], written = {};
  const r = gate({ root: "/bench", sh: repo.sh, say: (l) => said.push(l), house: "/house", planFn: () => PLAN.map((s) => ({ ...s })), redeclare: () => 0, write: (f, t) => { written[f] = t; }, clock: (() => { let t = 0; return () => (t += 1000); })(), ...over });
  return { r, said, written };
};

test("RED the step order: fetch, then every planned step in plan order, verdict reads, then the land's re-read, push and remote read", () => {
  const repo = fakeRepo();
  const { r, said } = run(repo, { land: true });
  assert.equal(r.code, 0, said.join("\n"));
  assert.ok(r.landed);
  const order = repo.calls.filter((c) => /^(git (fetch|merge|push|ls-remote)|pnpm|bash|npx)/.test(c));
  assert.deepEqual(order, [
    "git fetch -q origin develop",
    `git merge --no-edit ${BASE}`,
    "pnpm build",
    "bash tools/witness-all.sh --fast",
    "npx vitest run tests/x.test.ts",
    "git fetch -q origin develop",
    "git push origin HEAD:develop",
    "git ls-remote origin refs/heads/develop",
  ]);
  assert.match(said.at(-1), /^FLOOR GATE LANDED aaaaaaaaa on develop \(was bbbbbbbbb\)$/);
});

test("RED a red step stops the push: no push runs, the door holds and exits 1", () => {
  const repo = fakeRepo({ red: ["vitest run tests/x.test.ts"] });
  const { r, said } = run(repo, { land: true });
  assert.equal(r.code, 1);
  assert.equal(r.landed, false);
  assert.ok(!repo.calls.some((c) => c.startsWith("git push")), "a red gate pushed");
  assert.match(said.at(-1), /^FLOOR GATE HOLDS: not landed, the gate refused \(touched-lares-cli \(exit 3\)\)$/);
});

test("RED a red build stops every later step (a stop step), and still no push", () => {
  const repo = fakeRepo({ red: ["build"] });
  const { r } = run(repo, { land: true });
  assert.equal(r.code, 1);
  assert.ok(!repo.calls.some((c) => c.startsWith("bash ") || c.startsWith("npx ") || c.startsWith("git push")));
});

test("RED a moved develop refuses the land with the cure: rerun the door; nothing pushes", () => {
  const repo = fakeRepo({ developAfter: MOVED });
  const { r, said } = run(repo, { land: true });
  assert.equal(r.code, 1);
  assert.ok(!repo.calls.some((c) => c.startsWith("git push")));
  assert.match(said.at(-1), /develop moved from bbbbbbbbb to ddddddddd under the gate; pono: rerun the door/);
});

test("RED a failed push reads NOT LANDED and exit 1 (the night a pipe hid the push's exit)", () => {
  const { r, said } = run(fakeRepo({ pushStatus: 1 }), { land: true });
  assert.equal(r.code, 1);
  assert.equal(r.landed, false);
  assert.match(said.at(-1), /^FLOOR GATE NOT LANDED: git push origin HEAD:develop exited 1$/);
});

test("RED a push that reads 0 while origin's develop names another sha still reads NOT LANDED", () => {
  const { r, said } = run(fakeRepo({ remote: MOVED }), { land: true });
  assert.equal(r.code, 1);
  assert.match(said.at(-1), /NOT LANDED: the push read 0, yet origin's develop reads ddddddddd/);
});

test("CONTROL no land asked: a green gate holds, pushes nothing, exits 0", () => {
  const repo = fakeRepo();
  const { r, said } = run(repo);
  assert.equal(r.code, 0);
  assert.ok(!repo.calls.some((c) => c.startsWith("git push") || c.startsWith("git ls-remote")));
  assert.match(said.at(-1), /^FLOOR GATE HOLDS: green at aaaaaaaaa, not landed \(land=true lands\)$/);
});

test("RED the verdict file: the keeper's shape at <house>/cache/bench/<rev>.json, over the committed HEAD and its tree", () => {
  const { r, written } = run(fakeRepo());
  const file = verdictPath("/house", HEAD);
  assert.equal(file, `/house/cache/bench/${HEAD}.json`);
  assert.equal(r.file, file);
  const doc = JSON.parse(written[file]);
  assert.deepEqual(Object.keys(doc), ["kind", "v", "rev", "tree", "code", "line", "steps", "secs"]);
  assert.equal(doc.kind, VERDICT_KIND);
  assert.equal(doc.rev, HEAD);
  assert.equal(doc.tree, TREE);
  assert.equal(doc.code, 0);
  assert.match(doc.line, /^BENCH GATE GREEN/);
  assert.deepEqual(doc.steps.map((s) => s.name), PLAN.map((s) => s.name));
  assert.equal(written[file], JSON.stringify(doc), "the bytes JSON.stringify writes: the rite hashes them");
});

test("RED a step that moved the tracked tree voids the verdict and refuses the land", () => {
  const repo = fakeRepo({ dirtyAfter: true });
  const { r, written } = run(repo, { land: true });
  assert.equal(r.code, 1);
  const doc = JSON.parse(written[verdictPath("/house", HEAD)]);
  assert.equal(doc.code, 1);
  assert.match(doc.line, /tracked tree moved/);
  assert.ok(!repo.calls.some((c) => c.startsWith("git push")));
});

test("commit-build commits what the build wrote, and nothing where it wrote nothing", () => {
  const quiet = fakeRepo();
  run(quiet);
  assert.ok(!quiet.calls.some((c) => c.startsWith("git commit")));
  const busy = fakeRepo({ wrote: "packages/lararium-sensorium/fixtures/cli-verbs.json\n" });
  run(busy);
  assert.ok(busy.calls.includes("git add -u"));
  assert.ok(busy.calls.some((c) => c.startsWith("git commit -q -m lar:///floor.gate.commits/build-writes")));
});

test("parseArgs: the ref, the tier, whole by slug or dir, land; faults name themselves", () => {
  const pk = ["packages/lares-cli", "tests"];
  assert.deepEqual(parseArgs(["spirit/x"], pk), { ref: "spirit/x", tier: "small", whole: [], land: false, ticket: "", inside: false });
  assert.deepEqual(parseArgs(["abc", "tier=whole", "whole=lares-cli,tests", "land=true", "ticket=t1"], pk), { ref: "abc", tier: "whole", whole: ["packages/lares-cli", "tests"], land: true, ticket: "t1", inside: false });
  assert.throws(() => parseArgs([], pk), /name the ref/);
  assert.throws(() => parseArgs(["x", "tier=huge"], pk), /tier=huge/);
  assert.throws(() => parseArgs(["x", "whole=nope"], pk), /whole=nope/);
  assert.throws(() => parseArgs(["x", "land=yes"], pk), /land=yes/);
  assert.throws(() => parseArgs(["x", "y"], pk), /unknown argument y/);
});

test("floorCommand: the door hands itself to floor-run's --ref bench, never re-implementing it", () => {
  const words = floorCommand({ ref: "spirit/x", tier: "small", whole: ["tests"], land: true, ticket: "t9" }, { node: "node", self: "/f/floor-gate.mjs", floorRun: "/f/floor-run.mjs" });
  assert.deepEqual(words, ["/f/floor-run.mjs", "--ticket", "t9", "--ref", "spirit/x", "--", "node", "/f/floor-gate.mjs", "--inside", "tier=small", "whole=tests", "land=true"]);
});

test("redeclareUnbaked: a moved source takes its new sha in place; an unmoved row stays; a vanished source reads red", () => {
  const root = mkdtempSync(join(tmpdir(), "floor-gate-"));
  mkdirSync(join(root, "genesis"));
  writeFileSync(join(root, "a.json"), "new bytes");
  writeFileSync(join(root, "b.json"), "same");
  const sameSha = "0967115f2813a3541eaef77de9d9d5773f1c0c04314b0bbfe4ff3b3b1c55b5d5";
  const doc = `{\n  "format": "lararium-genesis-unbaked",\n  "unbaked": [\n    {\n      "source": "a.json",\n      "sha256": "${"0".repeat(64)}",\n      "why": "w"\n    },\n    {\n      "source": "b.json",\n      "sha256": "${sameSha}",\n      "why": "w"\n    }\n  ]\n}\n`;
  writeFileSync(join(root, "genesis/unbaked.json"), doc);
  assert.equal(redeclareUnbaked(root, () => {}), 0);
  const after = readFileSync(join(root, "genesis/unbaked.json"), "utf8");
  assert.ok(!after.includes("0".repeat(64)));
  assert.ok(after.includes(sameSha));
  assert.equal(after.length, doc.length, "the layout stands byte for byte but the one sha");
  writeFileSync(join(root, "genesis/unbaked.json"), doc.replace("a.json", "gone.json"));
  assert.equal(redeclareUnbaked(root, () => {}), 1);
});

test("houseRoot: LARES_HOUSE from the environment, a relative one names none", () => {
  assert.equal(houseRoot({ LARES_HOUSE: "/h", HOME: "/nonexistent" }), "/h");
  assert.equal(houseRoot({ LARES_HOUSE: "rel/h", HOME: "/nonexistent" }), "");
  assert.equal(houseRoot({ HOME: "/nonexistent" }), "");
});
