// rite-walk/carry-leg — the rite's CARRY LEG: a house stands on the source image, is seeded, censused and exported; the same
// tag rebuilds at the pinned head, a brand-new house stands there, imports the bundle, and the parity witness compares the
// two houses' censuses (`tools/carry-parity.mjs`). The rehearsal of the carry PR #218's merge rides on, on scratch houses.
//
// TWO PHASES, ONE SCOPE. Every vessel verb runs inside the container, so `export` runs on the source CLI in the source image and
// `import` on the NEW CLI in the new one. Each phase stands on its own clone of the checkout (`old-src` at `--from-rev`,
// `new-src` at the pinned head), its own workspace clone and house, and its own compose copy; the shim each phase runs
// is the one in its clone (running a clone's shim edits no `tools/lares-container.sh`). The image leg's scope holds
// unchanged (`assertImageScope`, the docker wrapper, the scratch HOME), and the base must stand under
// `~/.lares-scratch/rehearsal/`. One tag serves both images in turn, so the source house goes down before the new image builds.
//
// THE PIN. A walk pins the head it starts at (or `--pin <sha>`) into its kept state, and the new phase clones that sha
// alone: a sibling committing mid-walk never moves the image under proof. A resume that names another pin refuses.
//
// WHAT THE LEG NEVER DOES: call the shim's `reset` (no step names it), type `accept-loss` (a `down` that asks for it reads
// fail: a drop is exactly what the rehearsal must catch), export with `--accept-omissions` (an omission other than
// `parallel-drafts` reads fail), or read a stand-off as a bare exit code: the import exits 1 for rows over canon that moved
// between the revisions, and the leg judges its stand-offs against the plan's named set (`judgeImport`) and hands each
// import answer to the parity witness (`--imports`), which excuses those uris by name. The pūlama stands only at the end,
// on the carried house (carry → light): the image leg's pūlama phase, once parity reads par.
//
// THE KEEP (the house keeps itself): between the export and the down the source house strings a keep lei under the ward and runs
// `lares rite keep` into a workspace bound at its `up` (`keep`, a clone of a scratch bare remote standing in for the operator's
// repo), and conferre reads the keep's tessera par. The new phase clones that remote fresh (`keep-clone-new`); under
// `--import-from keep` the import reads that clone instead of the copied bundle, and parity reads par either way. A source
// revision that carries no keep rite reads the keep `unreached: door-absent` and walks its down regardless.
//
// CUSTODY: the staged test custody and the published test route, as the image leg rides them. `found` runs offline under
// `test-ward-route.mjs`; every terminal act (`up`, `vault unlock`, `persona new`, a ward act) types the published route on
// a pseudo-terminal. Each such pass reads `pass (pty)` or `pass (staged-custody)`, never bare.
//
// Usage: node tools/rite-walk.mjs --carry-leg --base <~/.lares-scratch/rehearsal/…> --project <name> --port <n>
//          --image <tag> --from-rev <full sha> --out <dir> [--pin <sha>] [--count <n>] [--from <step>] [--to <step>] [--keep]
//          [--import-from bundle|keep]
//   rc 0  no step failed · rc 1  a step failed · rc 2  the walk refused before any act
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { seedFiles, seedPlan, pickCanon, PETNAMES, SHARED_WIKIS, STAGE_PREFIX } from "./carry-seed.mjs";
import {
  TEST_PASSPHRASE, UNLOCK_SAYS, WARD_SAYS, assertImageScope, build, found, imageHands, imageReceiptFaults, lastJson,
  pulamaLight, pulamaUp, refusal, stageCustody, surfaceEnvText, tail, unlockedOf, upOwn, upPulama, walkImage,
} from "./image-leg.mjs";
import { RiteWalkRefusal, lineOf, quote, sha256, verdict } from "./steps.mjs";

const CHECKOUT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const PARITY = join(CHECKOUT, "tools", "carry-parity.mjs");
const STATE = "carry-walk-state.json";
const IN_CLI = "node packages/lares-cli/bin/lares.mjs";
const BUNDLE = "/lar/config/carry/pre-merge";
/** The workspace the source house keeps into, bound at its `up`, and where the new phase clones the keep's remote. */
export const KEEP_WORKSPACE = "keep";
export const KEEP_CLONE_IN = "/lar/config/carry/keep-clone/house";
/** Where the import reads: the copied bundle, or the fresh clone of the keep's remote (`--import-from keep`). */
const importSource = (c) => (c.vars.importFrom === "keep" ? KEEP_CLONE_IN : BUNDLE);
/** That source's host path in the new house, where its re-declare list and manifest rest. */
const importHost = (c) => (c.vars.importFrom === "keep" ? join(c.scope.houseNew, "config", "carry", "keep-clone", "house") : join(c.scope.houseNew, "config", "carry", "pre-merge"));
const CHECK = "/lar/config/carry/bundle-check";
const SUBMODULES = Object.freeze(["TiddlyWiki5", "mempalace"]);
/** The one omission a clean export may name: parallel drafts are the face's own, and travel as drafts. */
export const ALLOWED_OMISSIONS = Object.freeze(["parallel-drafts"]);
export const CARRY_RITE = "lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-carry";

const within = (outer, inner) => inner === outer || inner.startsWith(outer + sep);

// ── the scope ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** THE CARRY SCOPE: the image scope, a base under `~/.lares-scratch/rehearsal/`, a full old sha, and both phases' paths. */
export function assertCarryScope(opts = {}) {
  const realHome = opts.realHome ?? homedir();
  const image = assertImageScope({ ...opts, realHome, checkout: opts.checkout ?? CHECKOUT });
  const prefix = join(resolve(realHome), ".lares-scratch", "rehearsal");
  if (!within(prefix, image.base) || image.base === prefix) throw new RiteWalkRefusal(`--base ${image.base} stands outside ${prefix}/ (the carry leg rehearses under ~/.lares-scratch/rehearsal/ alone)`);
  const rev = opts["from-rev"];
  if (rev === undefined || rev === "") throw new RiteWalkRefusal("--from-rev names nothing; the carry leg names the old house's revision");
  if (!/^[0-9a-f]{40}$/.test(rev)) throw new RiteWalkRefusal(`--from-rev ${rev} names no full sha (40 hex)`);
  if (opts.pin !== undefined && !/^[0-9a-f]{40}$/.test(opts.pin)) throw new RiteWalkRefusal(`--pin ${opts.pin} names no full sha (40 hex)`);
  const at = (p) => join(image.base, p);
  return Object.freeze({
    ...image, oldRev: rev,
    houseOld: at("house-old"), houseNew: at("house-new"), workspaceOld: at("workspace-old"), workspaceNew: at("workspace-new"),
    oldSrc: at("old-src"), newSrc: at("new-src"), composeOld: at("compose-old.yml"), composeNew: at("compose-new.yml"),
    census: at("census"), seedSrc: at("house-old/config/seed-src"),
    keepRemote: at("keep-remote.git"), keepWs: at("keep-ws"), keepClone: at("house-new/config/carry/keep-clone"),
  });
}

/** One phase's image scope: the shared base, home, wrapper and env file, over that phase's house, workspace and compose copy. */
export function phaseScope(scope, phase) {
  const old = phase === "old";
  return Object.freeze({ ...scope, house: old ? scope.houseOld : scope.houseNew, workspace: old ? scope.workspaceOld : scope.workspaceNew, compose: old ? scope.composeOld : scope.composeNew,
    ...(old ? { workspaces: `${KEEP_WORKSPACE}=${scope.keepWs}` } : {}) });
}

/**
 * The walk's kept state. A fresh walk pins `pin` (or the head it starts at); a resume keeps the pin it started under and
 * refuses another, and refuses an old revision other than its own.
 */
export function carryState({ kept, pin, head, oldRev }) {
  if (kept) {
    if (pin !== undefined && pin !== kept.vars.pin) throw new RiteWalkRefusal(`the kept walk pinned ${kept.vars.pin}; --pin ${pin} names another`);
    if (oldRev !== kept.vars.oldRev) throw new RiteWalkRefusal(`the kept walk carries from ${kept.vars.oldRev}; --from-rev ${oldRev} names another`);
    return kept;
  }
  return { vars: { pin: pin ?? head, oldRev }, rows: [], legs: [] };
}

// ── the judges ──────────────────────────────────────────────────────────────────────────────────────────────────────

const uriOf = (entry) => String(entry).split(" (")[0];

/**
 * Judge the import answers (one per worn face, in order) against the plan. A stand-off reads by name: each expected uri
 * must stand off, nothing else may, nothing may refuse, and nothing may still wait once every face imported.
 */
export function judgeImport(answers, { expectedStandoff = [] } = {}) {
  const faults = [], stood = new Set(), refused = [];
  const landed = {};
  answers.forEach((a, i) => {
    if (!a?.json) { faults.push(`face answer ${i} answered no JSON (exit ${a?.code})`); return; }
    if (a.json.data?.applied !== true) faults.push(`face answer ${i} never applied (applied: ${JSON.stringify(a.json.data?.applied)})`);
    for (const [cls, t] of Object.entries(a.json.data?.tallies ?? {})) {
      landed[cls] = (landed[cls] ?? 0) + (t.landed ?? 0);
      for (const s of t.stoodOff ?? []) stood.add(uriOf(s));
      for (const r of t.refused ?? []) refused.push(`${cls}: ${r}`);
    }
  });
  for (const uri of expectedStandoff) if (!stood.has(uri)) faults.push(`expected stand-off ${uri} never stood off`);
  for (const uri of stood) if (!expectedStandoff.includes(uri)) faults.push(`unexpected stand-off ${uri}`);
  if (refused.length > 0) faults.push(`${refused.length} row(s) refused: ${refused.slice(0, 5).join("; ")}`);
  const waiting = answers.at(-1)?.json?.data?.waiting ?? [];
  if (waiting.length > 0) faults.push(`${waiting.length} row set(s) still waiting after every face imported: ${JSON.stringify(waiting).slice(0, 300)}`);
  return { ok: faults.length === 0, faults, stoodOff: [...stood], refused, landed };
}

/** Judge the export's answer: exit 0, and no omission but the allowed ones. */
export function judgeExport(r, answer) {
  if (r.code !== 0 || !answer?.data) return { ok: false, faults: [refusal(r)] };
  const kinds = (answer.data.omissions ?? []).map((o) => o.kind);
  const bad = kinds.filter((k) => !ALLOWED_OMISSIONS.includes(k));
  return { ok: bad.length === 0, faults: bad.map((k) => `omission ${k}`), kinds };
}

/** The parity witness's compare line (the contract on the span): census readings per side, the base, each import answer, each named stand-off. */
export function compareArgs({ old = [], fresh = [], base = [], imports = [], standOff = [], out }) {
  const each = (flag, xs) => xs.flatMap((x) => [flag, x]);
  return ["compare", ...each("--old", old), ...each("--new", fresh), ...each("--base", base), ...each("--imports", imports), ...each("--stand-off", standOff), "--json", ...(out ? ["--out", out] : [])];
}

/** Flip one byte in the middle of a buffer: the tampered-bundle probe. */
export function tamperOne(buf) {
  const out = Buffer.from(buf);
  const at = Math.floor(out.length / 2);
  out[at] = out[at] ^ 0x01;
  return out;
}

/** A tree's digest: each file's relative path and sha256, sorted. */
export function treeDigest(root) {
  if (!existsSync(root)) return null;
  const rows = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p); else rows.push(`${relative(root, p)} ${sha256(readFileSync(p))}`);
    }
  };
  walk(root);
  return { files: rows.length, digest: `sha256:${sha256(rows.join("\n"))}` };
}

// ── the terminal answers ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A new face's route, in the words the source image asked on a terminal (the probe to `persona-1`):
 * "Face h1 takes a route of its own, apart from this vessel's. …", then the menu, the passphrase and its confirm. No ward
 * prompt and no "same typed route" question follow on a standing vessel.
 */
export const PERSONA_SAYS = Object.freeze([
  { prompt: "bind [p]assphrase, [s]heet (paper pin), [b]oth (p): ", answer: "p" },
  { prompt: "new passphrase: ", answer: TEST_PASSPHRASE },
  { prompt: "new passphrase (confirm): ", answer: TEST_PASSPHRASE },
]);
/** Every answer list the leg types. `down` types none: a `down` that asks for accept-loss fails the step. */
export const CARRY_SAYS = Object.freeze({ unlock: UNLOCK_SAYS, ward: WARD_SAYS, persona: PERSONA_SAYS, import: Object.freeze([...WARD_SAYS, ...WARD_SAYS, ...WARD_SAYS]), down: Object.freeze([]) });

/** The prompts a terminal showed, the route redacted: each span that ends in a prompt mark (`(p): `, `[y/N]: `, `passphrase: `, `(confirm): `, `?`). */
const PROMPT_END = /(\(p\)|\[y\/N\]|\[y\/n\]|passphrase|\(confirm\)|digest)(:)(?=\s|$)|\?(?=\s*$)/;
export function promptsOf(transcript) {
  const out = [];
  for (const line of String(transcript).replace(/\r/g, "\n").split("\n")) {
    const m = PROMPT_END.exec(line);
    if (m) out.push(line.slice(0, m.index + m[0].length).trim());
  }
  return out.slice(0, 40);
}

// ── the acts ────────────────────────────────────────────────────────────────────────────────────────────────────────

const flat = (text) => String(text ?? "").replace(/\r/g, "");
const json = (text) => lastJson(flat(text));
const said = (r) => `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
const hostGit = async (c, args) => {
  const r = await c.git(args);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${lineOf(said(r))}`);
  return String(r.stdout ?? "").trim();
};

/** Wear one face on a terminal: `vault unlock --face N`, the published route typed. */
async function wear(c, phase, face) {
  const h = c.hands(phase);
  const r = await h.pty(h.shimLine(["vault", "unlock", "--face", String(face)]), { says: CARRY_SAYS.unlock, route: TEST_PASSPHRASE, timeout: 120_000 });
  const status = await h.shim(["vault", "status", "--json"]);
  const wears = /"wears"\s*:\s*(\d+)/.exec(flat(status.stdout))?.[1] ?? /"wears"\s*:\s*(\d+)/.exec(flat(r.stdout))?.[1];
  return { ok: r.code === 0 && unlockedOf(flat(status.stdout)).unlocked === true && (wears === undefined || Number(wears) === face), wears: wears === undefined ? null : Number(wears), transcript: r.stdout, code: r.code };
}

/** A clone of the walker's checkout at one revision, its two image submodules filled from the checkout's own stores. */
async function cloneAt(c, phase, rev) {
  const src = phase === "old" ? c.scope.oldSrc : c.scope.newSrc;
  if (existsSync(join(src, ".git"))) throw new Error(`${src} already stands; clear the base or walk on from a later step`);
  await hostGit(c, ["clone", "--quiet", "--local", "--no-checkout", CHECKOUT, src]);
  await hostGit(c, ["-C", src, "checkout", "--quiet", "--detach", rev]);
  const common = resolve(CHECKOUT, await hostGit(c, ["-C", CHECKOUT, "rev-parse", "--git-common-dir"]));
  const filled = [];
  for (const name of SUBMODULES) {
    const store = [join(common, "modules", name), join(dirname(common), name)].find((p) => existsSync(p)) ?? join(common, "modules", name);
    await hostGit(c, ["-C", src, "config", `submodule.${name}.url`, store]);
    filled.push(`${name} ← ${store}`);
  }
  await hostGit(c, ["-C", src, "-c", "protocol.file.allow=always", "submodule", "update", "--init", "--quiet", ...SUBMODULES]);
  const head = await hostGit(c, ["-C", src, "rev-parse", "HEAD"]);
  const dirty = await hostGit(c, ["-C", src, "status", "--porcelain", "--untracked-files=no"]);
  return { src, head, dirty, filled };
}

const srcStep = (phase) => async (c) => {
  const rev = phase === "old" ? c.vars.oldRev : c.vars.pin;
  const at = await cloneAt(c, phase, rev);
  if (at.head !== rev) return { ok: false, answer: `the clone stands at ${at.head}, not ${rev}` };
  if (at.dirty !== "") return { ok: false, answer: `the clone's tracked tree reads dirty: ${lineOf(at.dirty)}` };
  const h = c.hands(phase);
  h.stage();
  const ground = phase === "old" ? await layKeepGround(c) : null;
  const proof = await h.proveScope();
  return { ok: true, answer: `${at.src} at ${rev}, clean; ${at.filled.join(", ")}${ground ? ` · ${ground}` : ""} · ${proof}`, measures: { rev, filled: at.filled } };
};

/**
 * The keep's ground, before the source house's `up` binds it: a scratch bare remote standing in for the operator's repo, holding one
 * commit of `* -text`, and the workspace clone of it (a local identity, so the host half commits under no operator's name).
 */
async function layKeepGround(c) {
  const { keepRemote, keepWs } = c.scope;
  if (existsSync(keepWs)) return `the keep workspace stands at ${relative(c.scope.base, keepWs)}`;
  await hostGit(c, ["init", "--quiet", "--bare", "--initial-branch=main", keepRemote]);
  await hostGit(c, ["clone", "--quiet", keepRemote, keepWs]);
  for (const [k, v] of [["user.name", "Keeper"], ["user.email", "keeper@example.invalid"], ["commit.gpgsign", "false"]]) await hostGit(c, ["-C", keepWs, "config", k, v]);
  await hostGit(c, ["-C", keepWs, "symbolic-ref", "HEAD", "refs/heads/main"]);
  writeFileSync(join(keepWs, ".gitattributes"), "* -text\n");
  await hostGit(c, ["-C", keepWs, "add", ".gitattributes"]);
  await hostGit(c, ["-C", keepWs, "commit", "--quiet", "-m", "guard"]);
  await hostGit(c, ["-C", keepWs, "push", "--quiet", "origin", "HEAD:refs/heads/main"]);
  return `the keep workspace ${KEEP_WORKSPACE} clones ${relative(c.scope.base, keepRemote)}`;
}

const buildStep = (phase) => async (c) => {
  const h = c.hands(phase);
  const want = phase === "old" ? c.vars.oldRev : c.vars.pin;
  const r = await build(h);
  c.vars[`image-${phase}`] = r.measures?.imageId ?? null;
  const revision = r.measures?.revision;
  return { ...r, ok: r.ok === true && revision === want, answer: `${r.answer}${revision === want ? "" : ` (the leg wants ${want})`}` };
};

const onPhase = (phase, fn) => (c) => fn(c.hands(phase));

const seedCanon = (phase, faces) => async (c) => {
  const said_ = [];
  for (const face of faces) {
    const h = c.hands(phase);
    if (faces.length > 1) {
      const w = await wear(c, phase, face);
      if (!w.ok) return { ok: false, answer: `face ${face} never stood worn (exit ${w.code}): ${tail(w.transcript)}` };
    }
    const r = await h.shim(["vessel", "seed", "--apply", "--yes", "--no-json"], { timeout: 600_000 });
    if (r.code !== 0) return { ok: false, answer: `face ${face}: ${refusal(r)}` };
    const pending = Number(/kahua: (\d+) item\(s\) stand pending/.exec(said(r))?.[1] ?? 0);
    let lift = "";
    if (pending > 0) {
      const l = await h.pty(h.shimLine(["vessel", "seed", "--apply", "--lift-kahua", String(pending), "--no-json"]), { says: CARRY_SAYS.ward, route: TEST_PASSPHRASE, timeout: 300_000 });
      if (l.code !== 0) return { ok: false, answer: `face ${face}: the lift of ${pending} kahua item(s) answered exit ${l.code}: ${tail(l.stdout)}` };
      lift = ` · lifted ${pending} kahua item(s)`;
    }
    said_.push(`face ${face}: ${lineOf(said(r), "seed")}${lift}`);
  }
  return { ok: true, answer: said_.join(" · ") };
};

const personaStep = (phase, n) => async (c) => {
  const h = c.hands(phase);
  const name = phase === "old" ? PETNAMES[n] : redeclared(c)[n];
  if (!name) return { ok: false, answer: `the bundle's re-declare list names no face at index ${n}` };
  const r = await h.pty(h.shimLine(["persona", "new", String(n), "--name", name, "--no-json"]), { says: CARRY_SAYS.persona, route: TEST_PASSPHRASE, timeout: 180_000 });
  const transcript = flat(r.stdout);
  const minted = transcript.includes(`persona h${n} minted`);
  return { ok: r.code === 0 && minted, answer: `exit ${r.code}; route typed: ${r.typed}; ${tail(transcript)}`, measures: { name, typed: r.typed, prompts: promptsOf(transcript), transcript: quote(transcript).slice(0, 4000) } };
};

const unlockAll = (phase) => async (c) => {
  const h = c.hands(phase);
  const r = await h.pty(h.shimLine(["vault", "unlock", "--all", "--face", "1"]), { says: CARRY_SAYS.unlock, route: TEST_PASSPHRASE, timeout: 180_000 });
  const status = await h.shim(["vault", "status", "--json"]);
  const unlocked = unlockedOf(flat(status.stdout)).unlocked;
  return { ok: r.code === 0 && unlocked === true, answer: `exit ${r.code}; unlocked ${unlocked} · ${tail(r.stdout)}`, measures: { prompts: promptsOf(flat(r.stdout)) } };
};

/** The three canon memes the plan forks over, read from the source clone, and the prose it borrows. */
async function canonFor(c) {
  const src = c.scope.oldSrc;
  const carriers = (await hostGit(c, ["-C", src, "ls-tree", "-r", "--name-only", c.vars.oldRev, "--", "bags/lares/ha.ka.ba/lares/docs"])).split("\n").filter(Boolean);
  const moved = (await hostGit(c, ["-C", src, "diff", "--name-only", c.vars.oldRev, c.vars.pin, "--", "bags/lares"])).split("\n").filter(Boolean);
  const pick = pickCanon({ carriers, moved });
  const text = async (p) => hostGit(c, ["-C", src, "show", `${c.vars.oldRev}:${p}`]).then((t) => `${t}\n`);
  return { still: { ...pick.still, text: await text(pick.still.path) }, moved: { ...pick.moved, text: await text(pick.moved.path) }, kapae: pick.kapae };
}

/** A shim call that must read exit 0; answers its one line. */
async function must(h, args, what, opts) {
  const r = await h.shim(args, opts);
  if (r.code !== 0) throw new Error(`${what}: ${refusal(r)}`);
  return lineOf(said(r));
}

/** Put one face's seed files in one exec: each row's answer lands beside it, each refusal names its file. */
async function bulkPut(h, face, count) {
  const dir = `/lar/config/seed-src/f${face}`;
  const script = `n=0; bad=0; for f in ${dir}/*.mem; do n=$((n+1)); if ! ${IN_CLI} meme put "$(cat "$f.uri")" --recipe "$(cat "$f.recipe")" --face ${face} --file "$f" --json > "$f.out" 2>&1; then bad=$((bad+1)); echo "REFUSED $f: $(tail -c 300 "$f.out" | tr '\\n' ' ')"; fi; done; echo "PUT $n BAD $bad"`;
  const r = await h.compose(["exec", "-T", "lares", "sh", "-c", script], { timeout: Math.max(600_000, count * 5_000) });
  const m = /PUT (\d+) BAD (\d+)/.exec(said(r));
  return { code: r.code, put: m ? Number(m[1]) : 0, bad: m ? Number(m[2]) : -1, refusals: said(r).split("\n").filter((l) => l.startsWith("REFUSED")).slice(0, 10) };
}

const seedContent = async (c) => {
  const h = c.hands("old");
  const canon = await canonFor(c);
  const plan = seedPlan({ count: c.vars.count ?? 300, canon, bodies: [canon.still.text, canon.moved.text] });
  c.vars.expectedStandoff = plan.expectedStandoff;
  c.vars.stageUris = plan.faces[0].filter((r) => r.recipe === "default" && r.uri.startsWith(STAGE_PREFIX) && r.kind !== "non-nfc").map((r) => r.uri);
  rmSync(c.scope.seedSrc, { recursive: true, force: true });
  for (const f of seedFiles(plan)) { mkdirSync(dirname(join(c.scope.seedSrc, f.path)), { recursive: true }); writeFileSync(join(c.scope.seedSrc, f.path), f.text); }
  const edge = (kind) => plan.edges.filter((e) => e.kind === kind);
  const notes = [];
  // Host-side acts: temp consent in the house config, sensorium files, the library's source file.
  const cfgPath = join(c.scope.houseOld, "config", "config.json");
  const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
  for (const e of edge("temp-consent")) { cfg.projection = { ...(cfg.projection ?? {}), temp: { ...(cfg.projection?.temp ?? {}), [e.slug]: true }, tempExpiryDays: { ...(cfg.projection?.tempExpiryDays ?? {}), [e.slug]: e.expiryDays } }; }
  writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  for (const e of edge("sensorium")) for (const f of e.files) { const p = join(c.scope.houseOld, "sensoriums", f.name); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }
  for (const e of edge("library")) for (const f of e.files) { const p = join(c.scope.seedSrc, "library", f.name); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, f.text); }
  // The steward: wikis, seats, the bag share, the kāpae, the library, its rows.
  let w = await wear(c, "old", 0);
  if (!w.ok) return { ok: false, answer: `the steward never stood worn: ${tail(w.transcript)}` };
  for (const e of edge("wiki-init")) notes.push(await must(h, ["wiki", "init", e.slug, "--no-json"], `wiki init ${e.slug}`));
  for (const e of edge("wiki-share")) notes.push(await must(h, ["wiki", "share", e.slug, ...(e.write.length ? ["--write", e.write.join(",")] : []), "--read", e.read.join(","), "--no-json"], `wiki share ${e.slug}`));
  for (const e of edge("bag-share")) notes.push(await must(h, ["bag", "share", e.bag, "--read", e.read.join(","), "--no-json"], `bag share ${e.bag}`));
  for (const e of edge("library")) for (const f of e.files) notes.push(await must(h, ["library", "acquire", `/lar/config/seed-src/library/${f.name}`, "--to", e.collection, "--keep", "--no-json"], `library acquire ${f.name}`));
  const tally = {};
  for (const face of [0, 1, 2]) {
    if (face > 0) { w = await wear(c, "old", face); if (!w.ok) return { ok: false, answer: `face ${face} never stood worn: ${tail(w.transcript)}` }; }
    const rows = plan.faces[face].filter((r) => r.kind !== "non-nfc").length;
    const put = await bulkPut(h, face, rows);
    tally[face] = { rows, put: put.put, bad: put.bad };
    if (put.code !== 0 || put.bad !== 0 || put.put !== rows) return { ok: false, answer: `face ${face}: ${put.put}/${rows} put, ${put.bad} refused · ${put.refusals.join(" · ")}`, measures: { tally } };
    if (face === 0) {
      for (const e of edge("kapae")) notes.push(await must(h, ["tiddler", "delete", e.title, "--recipe", e.recipe, "--no-json"], `kapae ${e.title}`));
    }
    if (face === 1) {
      for (const e of [...edge("kahua-lift"), ...edge("kahua-staged")]) {
        const staged = await h.shim(["kahua", "stage", e.title, "--face", "1", "--text", e.text, "--json"]);
        const digest = /"digest"\s*:\s*"(?:sha256:)?([0-9a-f]{8,})"/.exec(flat(staged.stdout))?.[1];
        if (staged.code !== 0 || !digest) return { ok: false, answer: `kahua stage ${e.title}: ${staged.code === 0 ? "answered no digest" : refusal(staged)}` };
        if (e.kind === "kahua-lift") {
          const l = await h.pty(h.shimLine(["kahua", "lift", e.title, "--face", "1", "--taint", "none", "--digest", digest, "--no-json"]), { says: CARRY_SAYS.ward, route: TEST_PASSPHRASE, timeout: 120_000 });
          if (l.code !== 0) return { ok: false, answer: `kahua lift ${e.title}: exit ${l.code}: ${tail(l.stdout)}` };
        }
        notes.push(`${e.kind} ${digest.slice(0, 8)}`);
      }
    }
  }
  // The non-NFC row, alone: it lands or refuses by name, and the receipt carries which.
  const odd = plan.faces[0].find((r) => r.kind === "non-nfc");
  w = await wear(c, "old", 0);
  writeFileSync(join(c.scope.seedSrc, "non-nfc.mem"), odd.text);
  const oddPut = await h.shim(["meme", "put", odd.uri, "--recipe", "default", "--file", "/lar/config/seed-src/non-nfc.mem", "--json"]);
  c.vars.nonNfc = { uri: odd.uri, code: oddPut.code, said: quote(lineOf(said(oddPut))).slice(0, 300) };
  return { ok: true, answer: `rows put per face ${JSON.stringify(tally)}; non-NFC row exit ${oddPut.code}; ${notes.length} edge act(s)`, measures: { tally, edges: notes, nonNfc: c.vars.nonNfc, expectedStandoff: plan.expectedStandoff, unseeded: ["a temp-layer record (no verb grounded; consent alone rides)", "a draft recovery file"] } };
};

/** Readers first, the writer last: every shared wiki held under each face, so none rests cold at the export. */
const holdOld = async (c) => {
  const h = c.hands("old");
  const said_ = [];
  for (const face of [2, 1, 0]) {
    const w = await wear(c, "old", face);
    if (!w.ok) return { ok: false, answer: `face ${face} never stood worn: ${tail(w.transcript)}` };
    for (const slug of SHARED_WIKIS) {
      const r = await h.shim(["wiki", "hold", slug, "--no-json"]);
      said_.push(`${face}/${slug}: ${r.code === 0 ? "held" : refusal(r)}`);
      if (face === 0 && r.code !== 0) return { ok: false, answer: said_.join(" · ") };
    }
  }
  return { ok: true, answer: said_.join(" · ") };
};

/** One census per worn face through the parity witness, written under `census/<label>-<pet>.json`. */
const censusStep = (phase, label) => async (c) => {
  const h = c.hands(phase);
  const house = phase === "old" ? c.scope.houseOld : c.scope.houseNew;
  mkdirSync(c.scope.census, { recursive: true });
  const files = [];
  for (const face of [0, 1, 2]) {
    const w = await wear(c, phase, face);
    if (!w.ok) return { ok: false, answer: `face ${face} never stood worn: ${tail(w.transcript)}` };
    const out = join(c.scope.census, `${label}-${PETNAMES[face]}.json`);
    const r = await c.node([PARITY, "census", "--root", house, "--label", `${label} ${PETNAMES[face]}`, "--out", out, "--lares", join(h.checkout, "tools", "lares-container.sh")], { env: h.env, timeout: 1_800_000 });
    if (r.code !== 0) return { ok: false, answer: `census ${label} face ${face}: ${refusal(r)}` };
    files.push(out);
  }
  c.vars[`census-${label}`] = files;
  return { ok: true, answer: `${files.length} census reading(s): ${files.map((f) => relative(c.scope.base, f)).join(", ")}` };
};

const exportStep = async (c) => {
  const h = c.hands("old");
  const w = await wear(c, "old", 0);
  if (!w.ok) return { ok: false, answer: `the steward never stood worn: ${tail(w.transcript)}` };
  const r = await h.shim(["export", BUNDLE, "--json"], { timeout: 1_800_000 });
  const answer = json(r.stdout);
  const j = judgeExport(r, answer);
  c.vars.bundle = { id: answer?.data?.bundleId ?? null, counts: answer?.data?.counts ?? null, omissions: j.kinds ?? null };
  return { ok: j.ok, answer: j.ok ? `bundle ${String(c.vars.bundle.id).slice(0, 16)} · faces ${JSON.stringify(answer.data.faces)} · counts ${JSON.stringify(answer.data.counts)}` : j.faults.join("; "), measures: c.vars.bundle };
};

/** `down` on a terminal with no answer typed: a `down` that asks for accept-loss reads fail, and the house stays whole. */
const downOld = async (c) => {
  const h = c.hands("old");
  const r = await h.pty(h.shimLine(["down"]), { says: CARRY_SAYS.down, timeout: 180_000 });
  const transcript = flat(r.stdout);
  const vessel = await h.cid("lares");
  if (/accept-loss/.test(transcript)) return { ok: false, answer: `down asked for accept-loss; the leg never types it (exit ${r.code}; vessel ${vessel ? "stands" : "gone"}): ${tail(transcript)}` };
  return { ok: r.code === 0 && vessel === "", answer: `exit ${r.code}; vessel container: ${vessel ? "stands" : "gone"} · ${tail(transcript)}` };
};

/** The door a revision lacks names itself: an old source carries no keep rite, and the keep then reads unreached. */
const doorAbsent = (text) => /unknown (command|verb|sub-?verb|flag)|no such (command|verb)|name a sub-verb|not a lares command|rite-needs|plans no single/i.test(text);

/** `lei kui --rite keep` on a terminal: the ward asks its one prompt and gets the published route; the line then reads standing. */
const keepLeiOld = async (c) => {
  const h = c.hands("old");
  const line = ["lei", "kui", "--rite", "keep", "--branch", KEEP_WORKSPACE, "--returns", "2", "--json"];
  const r = await h.pty(h.shimLine(line), { says: CARRY_SAYS.ward, route: TEST_PASSPHRASE, timeout: 120_000 });
  const answer = json(r.stdout);
  if (r.code !== 0 && answer?.ok !== true && doorAbsent(said(r))) return { unreached: "door-absent", answer: `the source revision strings no keep lei: ${refusal(r)}` };
  const show = await h.shim(["lei", "show", "--rite", "keep", "--branch", KEEP_WORKSPACE, "--json"]);
  const standing = json(show.stdout)?.data?.lei ?? null;
  return { ok: r.code === 0 && answer?.ok === true && standing?.standing === true, answer: `exit ${r.code}; ${JSON.stringify(answer?.data ?? null)} · the line reads ${JSON.stringify(standing)}`, measures: { exit: r.code, standing } };
};

/**
 * `lares rite keep` on the host (the walker's own CLI, through the bridge into the source vessel): guard, cut, commit, push to the
 * scratch remote, land; conferre then reads the keep's tessera par.
 */
const keepOld = async (c) => {
  const h = c.hands("old");
  const r = await c.node([join(CHECKOUT, "packages", "lares-cli", "bin", "lares.mjs"), "rite", "keep", "--workspace", KEEP_WORKSPACE, "--json"], { env: h.env, timeout: 1_800_000 });
  const answer = json(r.stdout);
  if (answer === null && doorAbsent(said(r))) return { unreached: "door-absent", answer: `the source revision keeps nothing: ${refusal(r)}` };
  const d = answer?.data ?? {};
  c.vars.keep = { tessera: d.tessera ?? null, bundleId: d.bundleId ?? null, pushed: d.pushed ?? null, par: d.par ?? null };
  const receipts = await h.shim(["rite", "receipts", "--json"], { timeout: 120_000 });
  const conferre = json(receipts.stdout)?.data?.conferre ?? {};
  const par = (conferre.par ?? []).some((t) => t.rite === "keep" && t.tessera === d.tessera);
  const red = (conferre.red ?? []).filter((t) => t.rite === "keep").map((t) => `${String(t.tessera).slice(0, 12)} ${t.red}`);
  return { ok: r.code === 0 && d.par === true && par && red.length === 0,
    answer: `exit ${r.code}; bundle ${String(d.bundleId).slice(0, 16)} · pushed ${d.pushed} · tessera ${String(d.tessera).slice(0, 12)} ${par ? "par" : "not par"}${red.length ? ` · red: ${red.join(", ")}` : ""}${r.code !== 0 ? ` · ${lineOf(String(d.message ?? said(r)))}` : ""}`,
    measures: c.vars.keep };
};

/** The new phase clones the keep's remote fresh into its config home, and the clone holds the very bundle the keep pushed. */
const keepCloneNew = async (c) => {
  const { keepRemote, keepClone } = c.scope;
  rmSync(keepClone, { recursive: true, force: true });
  mkdirSync(dirname(keepClone), { recursive: true });
  await hostGit(c, ["clone", "--quiet", "--branch", "main", keepRemote, keepClone]);
  let held = null;
  try { held = JSON.parse(readFileSync(join(keepClone, "house", "manifest.json"), "utf8")).bundleId ?? null; } catch { held = null; }
  const want = c.vars.keep?.bundleId ?? null;
  return { ok: held !== null && held === want, answer: `the clone holds bundle ${String(held).slice(0, 16)}; the keep pushed ${String(want).slice(0, 16)}; the export cut ${String(c.vars.bundle?.id ?? null).slice(0, 16)}`, measures: { held, kept: want, exported: c.vars.bundle?.id ?? null } };
};

const copyBundle = async (c) => {
  const pairs = [["config/carry/pre-merge", true], ["sensoriums", false], ["library", false]];
  const measures = {};
  for (const [rel, needed] of pairs) {
    const from = join(c.scope.houseOld, rel), to = join(c.scope.houseNew, rel);
    if (!existsSync(from)) { if (needed) return { ok: false, answer: `${from} stands nowhere` }; continue; }
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true, preserveTimestamps: true, errorOnExist: false, force: true });
    const a = treeDigest(from), b = treeDigest(to);
    measures[rel] = { from: a, to: b };
    if (a.digest !== b.digest) return { ok: false, answer: `${rel}: the copy reads ${b.digest}, the source ${a.digest}`, measures };
  }
  return { ok: true, answer: Object.entries(measures).map(([k, v]) => `${k} ${v.to.files} file(s) ${v.to.digest.slice(0, 19)}`).join(" · "), measures };
};

/** The bundle's re-declare list, by handle index: the pet-names the new house re-states, read, never retyped. */
function redeclared(c) {
  const p = join(importHost(c), "re-declare.json");
  const faces = JSON.parse(readFileSync(p, "utf8")).faces ?? [];
  return [...faces].sort((a, b) => a.handleIndex - b.handleIndex).map((f) => f.petname);
}

const foundNew = async (c) => {
  const names = redeclared(c);
  if (names[0] !== PETNAMES[0]) return { ok: false, answer: `the bundle's steward reads ${JSON.stringify(names[0])}; the founding names ${PETNAMES[0]}` };
  return await found(c.hands("new"));
};

/** The temp consent and expiry the source house carried, re-stated by hand in the new house's config. */
const configRestate = async (c) => {
  const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {});
  const old = read(join(c.scope.houseOld, "config", "config.json"));
  const p = join(c.scope.houseNew, "config", "config.json");
  const cfg = read(p);
  cfg.projection = { ...(cfg.projection ?? {}), temp: { ...(cfg.projection?.temp ?? {}), ...(old.projection?.temp ?? {}) }, tempExpiryDays: { ...(cfg.projection?.tempExpiryDays ?? {}), ...(old.projection?.tempExpiryDays ?? {}) } };
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(cfg, null, 2)}\n`);
  return { ok: true, answer: `projection ${JSON.stringify(cfg.projection)}` };
};

const importPreview = async (c) => {
  const h = c.hands("new");
  const w = await wear(c, "new", 0);
  if (!w.ok) return { ok: false, answer: `the steward never stood worn: ${tail(w.transcript)}` };
  const r = await h.shim(["import", importSource(c), "--json"], { timeout: 900_000 });
  const answer = json(r.stdout);
  const map = answer?.data?.faceMap ?? {};
  const missing = PETNAMES.filter((p) => !(p in map));
  return { ok: answer !== null && missing.length === 0, answer: answer ? `faceMap ${JSON.stringify(map)} · minted ${JSON.stringify(answer.data.minted)} · waiting ${(answer.data.waiting ?? []).length}${missing.length ? ` · unmapped ${missing.join(", ")}` : ""}` : refusal(r), measures: { faceMap: map } };
};

const importApply = async (c) => {
  const h = c.hands("new");
  const answers = [];
  for (const face of [0, 1, 2]) {
    const w = await wear(c, "new", face);
    if (!w.ok) return { ok: false, answer: `face ${face} never stood worn: ${tail(w.transcript)}` };
    const r = await h.pty(h.shimLine(["import", importSource(c), "--apply", "--json"]), { says: CARRY_SAYS.import, route: TEST_PASSPHRASE, timeout: 1_800_000 });
    const answer = json(r.stdout);
    answers.push({ code: r.code, json: answer });
    mkdirSync(c.scope.census, { recursive: true });
    const file = join(c.scope.census, `import-${face}.json`);
    writeFileSync(file, `${JSON.stringify(answer, null, 2)}\n`);
    (c.vars.imports ??= [])[face] = file;
  }
  const j = judgeImport(answers, { expectedStandoff: c.vars.expectedStandoff ?? [] });
  c.vars.importTallies = answers.map((a) => a.json?.data?.tallies ?? null);
  return { ok: j.ok, answer: j.ok ? `stood off exactly the named set ${JSON.stringify(j.stoodOff)}; landed ${JSON.stringify(j.landed)}` : j.faults.join("; "), measures: { exits: answers.map((a) => a.code), stoodOff: j.stoodOff, refused: j.refused, landed: j.landed } };
};

const reimport = async (c) => {
  const h = c.hands("new");
  const said_ = [];
  for (const face of [0, 1, 2]) {
    const w = await wear(c, "new", face);
    if (!w.ok) return { ok: false, answer: `face ${face} never stood worn: ${tail(w.transcript)}` };
    const r = await h.pty(h.shimLine(["import", importSource(c), "--apply", "--json"]), { says: CARRY_SAYS.import, route: TEST_PASSPHRASE, timeout: 1_800_000 });
    const answer = json(r.stdout);
    const landed = Object.entries(answer?.data?.tallies ?? {}).filter(([, t]) => (t.landed ?? 0) > 0).map(([k, t]) => `${k} ${t.landed}`);
    const seed = await h.shim(["vessel", "seed", "--apply", "--yes", "--no-json"], { timeout: 600_000 });
    said_.push(`face ${face}: import landed ${landed.length ? landed.join(", ") : "0"} · seed exit ${seed.code}`);
    if (!answer || landed.length > 0 || seed.code !== 0) return { ok: false, answer: said_.join(" · ") };
  }
  return { ok: true, answer: said_.join(" · ") };
};

const compare = async (c, out) => {
  const pick = (label) => (c.vars[`census-${label}`] ?? []);
  const args = [PARITY, ...compareArgs({ old: pick("old"), fresh: pick("new"), base: pick("new-base"), imports: (c.vars.imports ?? []).filter(Boolean), standOff: c.vars.expectedStandoff ?? [], out })];
  const r = await c.node(args, { env: c.hands("new").env, timeout: 600_000 });
  return { code: r.code, answer: json(r.stdout) };
};

const parity = async (c) => {
  const census = await censusStep("new", "new")(c);
  if (!census.ok) return census;
  const out = join(c.scope.census, "parity.json");
  const r = await compare(c, out);
  c.vars.parity = r.answer;
  return { ok: r.code === 0 && r.answer?.verdict === "par", answer: `exit ${r.code}; verdict ${r.answer?.verdict ?? "(none)"}${r.answer?.verdict === "par" ? "" : ` · ${JSON.stringify(r.answer).slice(0, 400)}`}`, measures: { receipt: relative(c.scope.base, out) } };
};

/** The instrument must read red where the new house moved: one row dropped, one row changed; then both restored, par again. */
const instrumentCollisions = async (c) => {
  const h = c.hands("new");
  const [dropped, changed] = c.vars.stageUris?.slice(1, 3) ?? [];
  if (!dropped || !changed) return { ok: false, answer: "the seed named no stage rows to collide" };
  const w = await wear(c, "new", 0);
  if (!w.ok) return { ok: false, answer: `the steward never stood worn: ${tail(w.transcript)}` };
  const keep = {};
  for (const uri of [dropped, changed]) {
    const got = await h.shim(["meme", "get", uri, "--recipe", "default"]);
    if (got.code !== 0) return { ok: false, answer: `meme get ${uri}: ${refusal(got)}` };
    keep[uri] = got.stdout;
  }
  const dir = join(c.scope.houseNew, "config", "collide");
  mkdirSync(dir, { recursive: true });
  const put = async (uri, text, name) => { writeFileSync(join(dir, name), text); return must(h, ["meme", "put", uri, "--recipe", "default", "--file", `/lar/config/collide/${name}`, "--json"], `meme put ${uri}`); };
  await must(h, ["tiddler", "delete", dropped, "--recipe", "default", "--family", "--no-json"], `tiddler delete ${dropped}`);
  await put(changed, keep[changed].replace(/\n<<~\/ahu>>/, "\nThe instrument test moved one line.\n<<~/ahu>>"), "changed.mem");
  const reds = await censusStep("new", "collide")(c);
  if (!reds.ok) return reds;
  const saved = c.vars["census-new"];
  c.vars["census-new"] = c.vars["census-collide"];
  const red = await compare(c, join(c.scope.census, "parity-collide.json"));
  c.vars["census-new"] = saved;
  const text = JSON.stringify(red.answer ?? {});
  const named = [dropped, changed].filter((u) => text.includes(u));
  await put(dropped, keep[dropped], "dropped.mem");
  await put(changed, keep[changed], "restored.mem");
  const again = await censusStep("new", "restored")(c);
  if (!again.ok) return again;
  c.vars["census-new"] = c.vars["census-restored"];
  const par = await compare(c, join(c.scope.census, "parity-restored.json"));
  c.vars["census-new"] = saved;
  const ok = red.code === 1 && named.length === 2 && par.code === 0;
  return { ok, answer: `collided: exit ${red.code}, naming ${named.length}/2 · restored: exit ${par.code}, verdict ${par.answer?.verdict}`, measures: { dropped, changed, redNames: named } };
};

const tamperedBundle = async (c) => {
  const h = c.hands("new");
  const from = importHost(c), to = join(c.scope.houseNew, "config", "carry", "bundle-check");
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(to, "manifest.json"), "utf8"));
  const victim = (manifest.files ?? []).map((f) => f.path).find((p) => p && !/manifest|re-declare/.test(p));
  if (!victim) return { ok: false, answer: "the manifest lists no file to tamper" };
  writeFileSync(join(to, victim), tamperOne(readFileSync(join(to, victim))));
  const count = async () => (json((await h.shim(["meme", "list", "--recipe", "default", "--json"])).stdout)?.data?.length ?? json((await h.shim(["meme", "list", "--recipe", "default", "--json"])).stdout)?.length ?? null);
  const before = await count();
  const r = await h.shim(["import", CHECK, "--apply", "--json"], { timeout: 600_000 });
  const after = await count();
  const refusedByName = r.code !== 0 && said(r).includes("bundle-hash-mismatch");
  rmSync(to, { recursive: true, force: true });
  return { ok: refusedByName && before === after, answer: `exit ${r.code}; ${lineOf(said(r), "bundle-hash-mismatch")} · rows before ${before}, after ${after}`, measures: { victim } };
};

/** Strip `row-key` from every stage row (a new act by the worn steward), then prove a keyless row lands at the head. */
const rowKeySweep = async (c) => {
  const h = c.hands("new");
  const w = await wear(c, "new", 0);
  if (!w.ok) return { ok: false, answer: `the steward never stood worn: ${tail(w.transcript)}` };
  const keyed = async () => (json((await h.shim(["wiki", "filter", `[prefix[${STAGE_PREFIX}]has[row-key]]`, "--recipe", "default", "--all", "--json"], { timeout: 300_000 })).stdout)?.data?.rows ?? []).length;
  const before = await keyed();
  const script = `n=0; bad=0; for u in $(cat /lar/config/sweep/uris); do n=$((n+1)); ${IN_CLI} meme get "$u" --recipe default > /tmp/sweep.mem 2>/dev/null && sed -i '/^row-key = "[^"]*"$/d' /tmp/sweep.mem && ${IN_CLI} meme put "$u" --recipe default --file /tmp/sweep.mem --json > /dev/null 2>&1 || { bad=$((bad+1)); echo "SWEEP-REFUSED $u"; }; done; echo "SWEPT $n BAD $bad"`;
  mkdirSync(join(c.scope.houseNew, "config", "sweep"), { recursive: true });
  writeFileSync(join(c.scope.houseNew, "config", "sweep", "uris"), `${(c.vars.stageUris ?? []).join("\n")}\n`);
  const r = await h.compose(["exec", "-T", "lares", "sh", "-c", script], { timeout: 3_600_000 });
  const m = /SWEPT (\d+) BAD (\d+)/.exec(said(r));
  const after = await keyed();
  const fresh = `${STAGE_PREFIX}research/keyless-at-head`;
  writeFileSync(join(c.scope.houseNew, "config", "sweep", "keyless.mem"), (await import("./steps.mjs")).memeText(fresh, "a stage row with no row-key lands at the head"));
  const keyless = await h.shim(["meme", "put", fresh, "--recipe", "default", "--file", "/lar/config/sweep/keyless.mem", "--json"]);
  c.vars.sweep = { before, after, swept: m ? Number(m[1]) : null, bad: m ? Number(m[2]) : null, keylessExit: keyless.code };
  return { ok: m !== null && Number(m[2]) === 0 && after === 0 && keyless.code === 0, answer: `keyed rows ${before} → ${after}; swept ${c.vars.sweep.swept}, refused ${c.vars.sweep.bad}; a keyless row: exit ${keyless.code}`, measures: c.vars.sweep };
};

const teardown = async (c) => {
  const phase = existsSync(c.scope.newSrc) ? "new" : "old";
  const t = await c.hands(phase).teardown();
  c.vars.tornDown = true;
  c.vars.dockerLog = t.log;
  return { ok: t.downCode === 0 && t.containers === "" && !t.baseStands, answer: `compose down exit ${t.downCode}; containers left: ${t.containers === "" ? "none" : t.containers}; the base stands: ${t.baseStands}; the image ${c.scope.image} stays` };
};

// ── the step table ──────────────────────────────────────────────────────────────────────────────────────────────────

const SC = "staged-custody";
const PTY = "pty";
export const CARRY_STEPS = Object.freeze([
  // The source house.
  { id: "src-old", command: "git clone --local --no-checkout · checkout --detach <from-rev> · submodule update --init TiddlyWiki5 mempalace", expect: "a clean clone at the old revision", run: srcStep("old") },
  { id: "build-old", command: "old-src/tools/lares-container.sh build", needs: ["src-old"], expect: "the image stamped at the old revision", run: buildStep("old") },
  { id: "stage-custody-old", command: "test-scratch-marker.mjs /lar && seed-test-custody.mjs /lar (old image)", via: SC, needs: ["build-old"], expect: "the marker and the custody tree stand", run: onPhase("old", stageCustody) },
  { id: "found-old", command: "lares found --hearth --name 'joshua-fontany' --chair 'dreamnet-kahu-0' (old image)", via: SC, needs: ["stage-custody-old"], expect: "the hearth stands", run: onPhase("old", found) },
  { id: "up-old", command: "old-src/tools/lares-container.sh up", via: PTY, needs: ["found-old"], expect: "the vessel stands, then the unlock", run: onPhase("old", upOwn) },
  { id: "seed-canon-old", command: "lares vessel seed --apply --yes [· --lift-kahua N]", needs: ["up-old"], expect: "house canon laid", run: seedCanon("old", [0]) },
  { id: "persona-1", command: "lares persona new 1 --name 'joshua-fontany-engineer'", via: PTY, needs: ["up-old"], expect: "persona h1 minted", run: personaStep("old", 1) },
  { id: "persona-2", command: "lares persona new 2 --name 'joshua-fontany-referee'", via: PTY, needs: ["up-old"], expect: "persona h2 minted", run: personaStep("old", 2) },
  { id: "unlock-all-old", command: "lares vault unlock --all --face 1", via: PTY, needs: ["persona-1", "persona-2"], expect: "every face opens", run: unlockAll("old") },
  { id: "seed-content-old", command: "wiki init · wiki share · bag share · library acquire · meme put ×N per face · kapae · kahua stage/lift", via: PTY, needs: ["unlock-all-old", "seed-canon-old"], expect: "every planned row lands", run: seedContent },
  { id: "hold-old", command: "lares wiki hold <slug> per face, readers first", via: PTY, needs: ["seed-content-old"], expect: "no shared wiki rests cold", run: holdOld },
  { id: "census-old", command: "carry-parity.mjs census --root house-old --lares old-src/tools/lares-container.sh (per worn face)", via: PTY, needs: ["hold-old"], expect: "three readings of the old house", run: censusStep("old", "old") },
  { id: "export", command: `lares export ${BUNDLE} --json`, via: PTY, needs: ["census-old"], expect: "the bundle reads back; no omission but parallel-drafts", run: exportStep },
  { id: "keep-lei-old", command: `lares lei kui --rite keep --branch ${KEEP_WORKSPACE} --returns 2`, via: PTY, needs: ["export"], expect: "the keep lei strings under the ward", run: keepLeiOld },
  { id: "keep-old", command: `lares rite keep --workspace ${KEEP_WORKSPACE} (on the host, into a clone of a scratch bare remote) · lares rite receipts`, via: PTY, needs: ["keep-lei-old"], expect: "pushed, landed; conferre reads the keep's tessera par", run: keepOld },
  { id: "down-old", command: "old-src/tools/lares-container.sh down (no accept-loss)", via: PTY, needs: ["census-old", "export"], expect: "the vessel leaves; the census asks for no loss", run: downOld },
  // The new house.
  { id: "src-new", command: "git clone --local --no-checkout · checkout --detach <pin> · submodule update --init TiddlyWiki5 mempalace", needs: ["down-old"], expect: "a clean clone at the pinned head", run: srcStep("new") },
  { id: "build-new", command: "new-src/tools/lares-container.sh build", needs: ["src-new"], expect: "the image stamped at the pinned head", run: buildStep("new") },
  { id: "copy-bundle", command: "cp -a house-old/{config/carry/pre-merge,sensoriums,library} house-new/", needs: ["export"], expect: "both trees digest equal", run: copyBundle },
  { id: "keep-clone-new", command: `git clone <keep remote> house-new/config/carry/keep-clone (import reads ${KEEP_CLONE_IN} under --import-from keep)`, needs: ["keep-old"], expect: "the clone holds the bundle the keep pushed", run: keepCloneNew },
  { id: "stage-custody-new", command: "test-scratch-marker.mjs /lar && seed-test-custody.mjs /lar (new image)", via: SC, needs: ["build-new"], expect: "the marker and the custody tree stand", run: onPhase("new", stageCustody) },
  { id: "found-new", command: "lares found --hearth --name <re-declare face 0> --chair 'dreamnet-kahu-0' (new image)", via: SC, needs: ["stage-custody-new", "copy-bundle"], expect: "the hearth stands", run: foundNew },
  { id: "config-restate", command: "house-new/config/config.json ← projection.temp, projection.tempExpiryDays (by hand)", needs: ["found-new"], expect: "the consent re-stated", run: configRestate },
  { id: "up-new", command: "new-src/tools/lares-container.sh up", via: PTY, needs: ["config-restate"], expect: "the vessel stands, then the unlock", run: onPhase("new", upOwn) },
  { id: "persona-new-1", command: "lares persona new 1 --name <re-declare face 1>", via: PTY, needs: ["up-new"], expect: "persona h1 minted", run: personaStep("new", 1) },
  { id: "persona-new-2", command: "lares persona new 2 --name <re-declare face 2>", via: PTY, needs: ["up-new"], expect: "persona h2 minted", run: personaStep("new", 2) },
  { id: "unlock-all-new", command: "lares vault unlock --all --face 1", via: PTY, needs: ["persona-new-1", "persona-new-2"], expect: "every face opens", run: unlockAll("new") },
  { id: "seed-canon-new", command: "per face: lares vault unlock --face N · lares vessel seed --apply --yes [· --lift-kahua N]", via: PTY, needs: ["unlock-all-new"], expect: "house canon laid under each face", run: seedCanon("new", [0, 1, 2]) },
  { id: "census-new-base", command: "carry-parity.mjs census --root house-new (per worn face, before the import)", via: PTY, needs: ["seed-canon-new"], expect: "the new house's own genesis rows read", run: censusStep("new", "new-base") },
  { id: "import-preview", command: `lares import ${BUNDLE} --json`, via: PTY, needs: ["census-new-base"], expect: "every pet-name maps to a face", run: importPreview },
  { id: "import-apply", command: `per face: lares import ${BUNDLE} --apply --json`, via: PTY, needs: ["import-preview"], expect: "stand-offs exactly the named set; nothing refused; nothing waiting", run: importApply },
  { id: "reimport", command: `per face: lares import ${BUNDLE} --apply · lares vessel seed --apply --yes`, via: PTY, needs: ["import-apply"], expect: "lands 0", run: reimport },
  { id: "parity", command: "carry-parity.mjs census (new) · carry-parity.mjs compare --old … --new … --base … --json", via: PTY, needs: ["reimport", "census-old"], expect: "par", run: parity },
  { id: "instrument-collisions", command: "drop one row, change one row · compare (red) · restore · compare (par)", via: PTY, needs: ["parity"], expect: "red naming both, then par", run: instrumentCollisions },
  { id: "tampered-bundle", command: `flip one byte in a copy · lares import ${CHECK} --apply`, needs: ["import-apply"], expect: "bundle-hash-mismatch; nothing lands", run: tamperedBundle },
  { id: "row-key-sweep", command: "per stage row: meme get · strip row-key · meme put; a keyless row put", via: PTY, needs: ["parity"], expect: "no row carries row-key; a keyless row lands", run: rowKeySweep },
  // Carry → light: the carried house stands its pūlama, lights it, and the vessel seats its holder over the socket.
  { id: "pulama-up", command: "new-src/tools/lares-container.sh pulama up", needs: ["parity"], expect: "standing unlit", run: onPhase("new", pulamaUp) },
  { id: "pulama-light", command: "new-src/tools/lares-container.sh pulama light", via: PTY, needs: ["pulama-up"], expect: "lit: true", run: onPhase("new", pulamaLight) },
  { id: "up-by-pulama", command: "new-src/tools/lares-container.sh up", via: PTY, needs: ["pulama-light"], expect: "the carried vessel seats its holder over the pūlama's socket", run: onPhase("new", upPulama) },
  { id: "teardown", command: "docker compose down --remove-orphans · rm the base", expect: "no container of the project stands; the base is gone", run: teardown },
]);

// ── the walk ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Run one command to its end on the host: `{ code, stdout, stderr }`. */
function hostRun(command, args, { env = process.env, timeout = 120_000 } = {}) {
  return new Promise((settle) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (b) => { stdout += String(b); });
    child.stderr.on("data", (b) => { stderr += String(b); });
    const bound = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.once("error", (e) => { clearTimeout(bound); settle({ code: 127, stdout, stderr: `${stderr}${e.message}` }); });
    child.once("close", (code, signal) => { clearTimeout(bound); settle({ code: signal === "SIGKILL" ? 124 : code ?? 1, stdout, stderr }); });
  });
}

/** The context every step runs with: the scope, the kept vars, one hands object per phase (the env file follows the phase in use). */
export function carryContext(scope, state, say = () => {}) {
  const made = {};
  let current = null;
  const uid = process.getuid(), gid = process.getgid();
  const gitEnv = (() => { const e = { ...process.env }; for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) delete e[k]; return e; })();
  return {
    scope, vars: state.vars, say,
    hands(phase) {
      const ps = phaseScope(scope, phase);
      made[phase] ??= imageHands(ps, state, { checkout: phase === "old" ? scope.oldSrc : scope.newSrc });
      if (current !== phase && existsSync(dirname(scope.envFile))) { writeFileSync(scope.envFile, surfaceEnvText(ps, { uid, gid, pulama: state.vars.pulama === true })); current = phase; }
      return made[phase];
    },
    git: (args, opts) => hostRun("git", args, { env: gitEnv, ...opts }),
    node: (args, opts) => hostRun(process.execPath, args, opts),
  };
}

export function parseCarryArgs(argv) {
  const opts = { keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--carry-leg") continue;
    if (a === "--keep") opts.keep = true;
    else if (["--base", "--project", "--port", "--image", "--out", "--from", "--to", "--from-rev", "--pin", "--count", "--import-from"].includes(a)) {
      if (argv[i + 1] === undefined) throw new RiteWalkRefusal(`${a} names nothing`);
      opts[a.slice(2)] = argv[++i];
    } else throw new RiteWalkRefusal(`unknown argument ${a}`);
  }
  if (opts["import-from"] !== undefined && !["bundle", "keep"].includes(opts["import-from"])) throw new RiteWalkRefusal(`--import-from ${opts["import-from"]} names neither bundle nor keep`);
  return opts;
}

/** The carry leg's receipt: the image leg's fields, the pinned head and the source revision, and what the carry measured. */
export function carryReceipt({ head, dirty, walker, scope, rows, legs, docker, vars }) {
  const tally = { pass: 0, fail: 0, unreached: 0 };
  for (const r of rows) tally[r.outcome] += 1;
  const compared = rows.map((r) => [r.step, r.command, r.outcome, r.via ?? null, r.cause ?? null]);
  return {
    kind: "rite-walk-carry-receipt", rite: CARRY_RITE,
    inputs: { head, pin: vars.pin, oldRev: vars.oldRev, dirty, walker, parity: vars.paritySha ?? null, scope: { project: scope.project, port: scope.port, image: scope.image, base: scope.base } },
    legs, tally: { ...tally, firstFail: rows.find((r) => r.outcome === "fail")?.step ?? null },
    outcomes: `sha256:${sha256(JSON.stringify(compared))}`,
    steps: rows, docker,
    carry: { bundle: vars.bundle ?? null, expectedStandoff: vars.expectedStandoff ?? [], importTallies: vars.importTallies ?? null, parity: vars.parity ?? null, sweep: vars.sweep ?? null, nonNfc: vars.nonNfc ?? null },
  };
}

/** Walk the carry leg. Answers `{ code, report }`; throws RiteWalkRefusal before any act where the walk may not run. */
export async function carryWalk(opts, say = console.log) {
  const scope = assertCarryScope(opts);
  if (!opts.out) throw new RiteWalkRefusal("--out names the directory the receipt lands in");
  if (within(scope.base, resolve(opts.out))) throw new RiteWalkRefusal("--out stands inside the base the teardown clears");
  for (const name of ["from", "to"]) if (opts[name] && !CARRY_STEPS.some((s) => s.id === opts[name])) throw new RiteWalkRefusal(`--${name} names no step: ${opts[name]}`);
  const statePath = join(scope.base, STATE);
  if (opts.from && !existsSync(statePath)) throw new RiteWalkRefusal(`${scope.base} carries no kept leg (${STATE})`);
  if (!opts.from && existsSync(scope.base)) throw new RiteWalkRefusal(`${scope.base} already stands; walk on from a kept leg (--from) or clear it`);
  const git = async (...args) => { const r = await hostRun("git", ["-C", CHECKOUT, ...args]); if (r.code !== 0) throw new RiteWalkRefusal(`git ${args.join(" ")}: ${lineOf(said(r))}`); return r.stdout.trim(); };
  const oldRev = await git("rev-parse", "--verify", `${scope.oldRev}^{commit}`);
  const head = await git("rev-parse", "HEAD");
  const state = carryState({ kept: opts.from ? JSON.parse(readFileSync(statePath, "utf8")) : null, pin: opts.pin, head, oldRev });
  await git("rev-parse", "--verify", `${state.vars.pin}^{commit}`);
  const paritySha = `sha256:${sha256(readFileSync(PARITY))}`;
  if (state.vars.paritySha && state.vars.paritySha !== paritySha) throw new RiteWalkRefusal(`the parity witness moved since the kept walk began (${state.vars.paritySha} → ${paritySha})`);
  state.vars.paritySha = paritySha;
  if (opts.count !== undefined) state.vars.count = Number(opts.count);
  if (opts["import-from"] !== undefined) state.vars.importFrom = opts["import-from"];
  mkdirSync(scope.base, { recursive: true });
  const c = carryContext(scope, state, say);
  for (const phase of ["old", "new"]) if (existsSync(join(phase === "old" ? scope.oldSrc : scope.newSrc, ".git"))) { c.hands(phase).stage(); say(await c.hands(phase).proveScope()); }

  const first = opts.from ? CARRY_STEPS.findIndex((s) => s.id === opts.from) : 0;
  const last = opts.to ? CARRY_STEPS.findIndex((s) => s.id === opts.to) : CARRY_STEPS.length - 1;
  const passedBefore = state.rows.filter((r) => r.outcome === "pass").map((r) => r.step);
  let rows;
  try {
    rows = await walkImage(CARRY_STEPS.slice(first, last + 1), {
      run: (step) => step.run(c), passed: passedBefore,
      say: (row) => say(`${verdict(row).padEnd(28)} ${row.step.padEnd(22)} ${row.answer ? `→ ${row.answer.slice(0, 220)}` : ""}`),
    });
  } finally { for (const phase of ["old", "new"]) try { await c.hands(phase).close(); } catch { /* no seat stood */ } }
  state.rows = [...state.rows.filter((r) => !rows.some((n) => n.step === r.step)), ...rows];
  state.legs.push({ from: CARRY_STEPS[first].id, to: CARRY_STEPS[last].id });
  let docker = state.vars.dockerLog ?? c.hands("old").dockerLog();
  if (!state.vars.tornDown) {
    if (opts.keep) writeFileSync(statePath, JSON.stringify(state));
    else { const t = await teardown(c); docker = state.vars.dockerLog; say(`the walk stopped before teardown and cleared its ground: ${t.answer}`); }
  }
  const order = new Map(CARRY_STEPS.map((s, i) => [s.id, i]));
  const all = CARRY_STEPS.map((s) => state.rows.find((r) => r.step === s.id) ?? { step: s.id, command: s.command, expect: s.expect ?? null, outcome: "unreached", cause: "outside-this-leg", answer: "", ms: 0 });
  all.sort((a, b) => order.get(a.step) - order.get(b.step));
  const walker = `sha256:${sha256(readFileSync(fileURLToPath(import.meta.url)))}`;
  const report = carryReceipt({ head, dirty: (await git("status", "--porcelain", "--untracked-files=no")) !== "", walker, scope, rows: all, legs: state.legs, docker, vars: state.vars });
  const faults = imageReceiptFaults(report.steps, CARRY_STEPS);
  if (faults.length > 0) throw new Error(`the receipt breaks the outcome law:\n  ${faults.join("\n  ")}`);
  mkdirSync(opts.out, { recursive: true });
  writeFileSync(join(opts.out, "carry-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    `rite-walk carry leg · ${report.rite}`,
    `old ${report.inputs.oldRev} → pin ${report.inputs.pin} · walker ${walker} · project ${scope.project} · port ${scope.port} · image ${scope.image}`,
    ...report.steps.map((r) => `${verdict(r).padEnd(28)} ${r.step.padEnd(22)} ${r.command}${r.answer ? `\n${" ".repeat(29)}→ ${r.answer}` : ""}${r.measures ? `\n${" ".repeat(29)}· ${JSON.stringify(r.measures)}` : ""}`),
    `pass ${report.tally.pass} · fail ${report.tally.fail} · unreached ${report.tally.unreached}${report.tally.firstFail ? ` · first fail ${report.tally.firstFail}` : ""} · outcomes ${report.outcomes}`,
    "", "every docker call, in order:", ...docker,
  ];
  writeFileSync(join(opts.out, "carry-report.txt"), `${lines.join("\n")}\n`);
  say(lines.find((l) => /^pass \d/.test(l)));
  say(`receipt: ${join(opts.out, "carry-report.json")}${opts.keep && !state.vars.tornDown ? ` · base kept: ${scope.base}` : ""}`);
  return { code: report.tally.fail > 0 ? 1 : 0, report };
}
