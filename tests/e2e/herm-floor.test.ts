/**
 * e2e/herm-floor — THE HERM CONTRACT, stood against a live vessel.
 *
 * A HERM IS NOT A LARARIUM MISSING SOMETHING. It is the BASE COURSE every vessel stands on, and a
 * lararium is that course with its hearth-fire lit. The stack carries the distinction as CAPS rather
 * than kinds: a vessel composes the caps it can hold, and `personaSlotCeiling("herm") === 0` bars a
 * SEATED persona root on a crossroads. Facelessness is not only a window between two commands — a
 * crossroads someone stands for the public may never light a face at all.
 *
 * MAY-HOLD-A-FACE ⊥ HOLDS-ONE-NOW. `standAs` asks the ARCHIVE question alone; whether a face STANDS is
 * a separate fact the boot reads separately, and `--recipe herm` DECLINES the lift rather than naming a
 * different kind of thing.
 *
 * WHY THESE ARE E2E AND NOT UNIT. A vector that fences a SITE finds that site; a vector that stands the
 * PATH lets the boot enumerate its own reaches for a face, and this floor was found one reach at a time
 * by unit vectors that each went green while the live boot failed further along. R1 stands the whole
 * path, and when it fails it fails with the next site's name in its message.
 *
 *   R1 — a herm reaches `live`                         · the base case of the stack
 *   R2 — a herm's floor gate stands at its explicit Nexus · joined by hand, it answers the knock: a proven stranger reads the map
 *   R3 — a herm carries a crossing                     · admit-by-lease, the relay role that is load-bearing
 *   R4 — a herm refuses hearth-scoped acts LEGIBLY     · refusal is a feature of the floor
 *   R5 — a herm LIFTS into a lararium                  · the cap-stack transition the runbook's rite performs
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { rendezvousPath } from "../../packages/lararium-mesh/src/rendezvous-path.js";
import { freePort, openStaged, stageDir, unlockStaged, type LarInstance } from "../harness/instance.js";
import { seedTestCustody } from "../harness/test-door.js";

/**
 * The herm's rendezvous — DERIVED from its root, never hunted under it.
 *
 * A walk for a file named `lares.sock` beneath the root found nothing, because the rendezvous stands
 * at `/tmp/lares-<uid>/<root-digest>.sock` — a fixed 40 bytes however deep a root runs. Three vectors
 * then read a floor that never answered as a floor that refused, which is the opposite verdict.
 * `invokeLocal` re-derives the socket from the root it is handed, so the ROOT is what to hand it.
 */
function substrateDir(r: string): string { return join(r, "data", "lares", "vessel"); }
function rendezvousFor(r: string): string {
  // The digest is over the SUBSTRATE dir (`<root>/data/lares/vessel`), which is what `larDataDir()`
  // resolves to and what `local-connector` hashes. Hashing the bare root names a socket nothing binds.
  return rendezvousPath({ root: substrateDir(r), uid: process.getuid?.() ?? 0 });
}
function sockStands(r: string): boolean { return existsSync(rendezvousFor(r)); }

const REPO = new URL("../..", import.meta.url).pathname;
const CLI  = join(REPO, "packages/lares-cli/dist/src/bin/lares.js");
/** The OS's port for this run — every stand, stop and read below keys on it, so two copies never meet. */
let PORT = 0;

let root = "";
/** The hearth whose quorum carries the herm in R2: a staged hearth on its own root, port and custody. */
let hearth: LarInstance | null = null;

/** Run one `lares` command against the herm's root and read its last JSON line; the platform's own warnings never count. */
function run(args: readonly string[]): { code: number; said: string; json: Record<string, unknown> | null } {
  const r = spawnSync(process.execPath, [CLI, ...args], { env: { ...process.env, LAR_ROOT: root }, cwd: REPO, encoding: "utf8" });
  // The runtime's own warnings (node:sqlite's ExperimentalWarning and its `--trace-warnings` hint) print on stderr AFTER
  // a command's last word when the module loads late; they are the platform's lines, never this house's answer.
  const said = `${r.stdout}\n${r.stderr}`.split("\n")
    .filter((l) => !/ExperimentalWarning|--trace-warnings/.test(l)).join("\n").trim().split("\n").slice(-3).join("\n");
  let json: Record<string, unknown> | null = null;
  for (const line of (r.stdout ?? "").trim().split("\n").reverse()) {
    try { json = JSON.parse(line) as Record<string, unknown>; break; } catch { /* not json */ }
  }
  return { code: r.status ?? -1, said, json };
}

/** How long a stop may hold the port, and a stand may take to reach live with its verb door bound. */
const STOP_DEADLINE_MS  = 30_000;
const STAND_DEADLINE_MS = 150_000;

/**
 * THE VERB VECTORS' BUDGETS, and the hang guard each derives from its own.
 *
 * A verb's OUTCOME is the readiness predicate: the daemon resolves a call when its outcome lands in the daemon doc,
 * so a caller waits on that event and on nothing else. The ceiling below only bounds a hang — it is the vector's
 * own budget less what the vector spends elsewhere and a margin for the assertion to report, so a slow-but-live
 * daemon spends the whole budget on its answer, and a cutoff never fires on a machine that is merely loaded.
 */
const VERB_MARGIN_MS = 5_000;
const R3_BUDGET_MS = 60_000;
const R4_BUDGET_MS = 90_000;
const R5_BUDGET_MS = 240_000;
/** R3 asks one verb. */
const R3_CEILING_MS = R3_BUDGET_MS - VERB_MARGIN_MS;
/** R4 asks two in sequence, so each takes half of what the margin leaves. */
const R4_CEILING_MS = (R4_BUDGET_MS - VERB_MARGIN_MS) / 2;
/** R5 stops the vessel and stands it again before it asks. */
const R5_CEILING_MS = R5_BUDGET_MS - STOP_DEADLINE_MS - STAND_DEADLINE_MS - VERB_MARGIN_MS;

/** The tail of the vessel's own log, for a failure to carry what the daemon was doing when it failed. */
function standLogTail(r: string): string {
  const p = join(substrateDir(r), "stand.log");
  return existsSync(p) ? readFileSync(p, "utf8").slice(-1200) : "(no stand.log)";
}

/**
 * Ask the vessel ONE verb over its UDS door and return the answer as text — the outcome, or the error that came
 * back instead. The wait is the outcome itself; `ceilingMs` bounds a hang and nothing else.
 */
async function askVerb(verb: string, args: Record<string, unknown>, ceilingMs: number): Promise<string> {
  const dir = sockStands(root) ? substrateDir(root) : null;
  const { invokeLocal } = await import("../../packages/lares-cli/src/local-connector.js");
  const r = await invokeLocal(verb, args, await operatorDid(root), { dataDir: dir, timeoutMs: ceilingMs })
    .catch((e: Error) => ({ error: e.message }));
  return JSON.stringify(r);
}

/** A herm's own root: the tracked genesis, and nothing else. No face is ever lit here. */
function standHermRoot(): string {
  const r = mkdtempSync(join(stageDir(), "lares-herm-"));
  execFileSync("bash", ["-lc", `cd ${REPO} && git ls-files -z genesis/ | xargs -0 -I{} cp --parents "{}" "${r}/"`]);
  return r;
}

/** The pid holding PORT, or "" — the one reliable way to name this vessel's process. `pkill -f` matches
 *  its own shell and would kill the harness. */
function portPid(): string {
  // `ss` where the box has it, else `lsof`: a box with neither tool read every vessel as already gone, so a stop
  // returned at once and the lift's founding met the standing vessel's store claim (`StoreHeld`).
  return execFileSync("bash", ["-lc",
    `{ ss -ltnp 2>/dev/null | grep ':${PORT} ' | grep -oP 'pid=\\K[0-9]+'; lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null; } | grep -m1 . || true`], { encoding: "utf8" }).trim();
}

/**
 * Stop the vessel on PORT and WAIT FOR THE PORT ITSELF to come free — never a fixed sleep.
 *
 * A herm's shutdown flushes its stores and its repo before it exits, so how long it holds the listener
 * depends on how much it wrote, not on a constant. A fixed pause races that flush: the re-stand binds a
 * port the dying vessel still holds, dies with "already in use", and the vector reports the LIFT broken
 * when what broke was the wait. Poll the port and the race is gone.
 */
async function stopVessel(): Promise<void> {
  const pid = portPid();
  if (!pid) return;
  try { process.kill(Number(pid)); } catch { /* already gone */ }
  const deadline = Date.now() + STOP_DEADLINE_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    if (!portPid()) return;
  }
}


/**
 * Stand the floor and report what it reached. Resolves the boot log either way — a fault is a result.
 *
 * READ THE VESSEL'S OWN LOG, NEVER THE LAUNCHER'S STDOUT. `lares vessel stand` DETACHES: the launcher
 * prints a status line and exits while the vessel it started writes `stand.log` under its own data
 * dir. A harness watching the launcher's pipe sees a vessel that reached `live` as one that printed
 * nothing, and reports the floor down while it is up — a measurement fault that reads exactly like a boot
 * fault. The log the vessel writes is the one that knows.
 */
async function standHerm(r: string): Promise<{ live: boolean; log: string }> {
  const standLog = join(r, "data/lares/vessel/stand.log");
  // CLEAR THE PRIOR BOOT'S LOG FIRST. The vessel APPENDS, so a `phase → live` from an earlier stand
  // answers instantly for a vessel that never came back up — the lift vector then reports a hearth that
  // stood when nothing did, and reaches for a socket no process holds.
  rmSync(standLog, { force: true });
  const child = spawn(process.execPath, [CLI, "vessel", "stand", "--skip-build"], {
    env: { ...process.env, LAR_ROOT: r, LAR_PORT: String(PORT) }, cwd: REPO,
  });
  let launcher = "";
  child.stdout.on("data", (b) => { launcher += String(b); });
  child.stderr.on("data", (b) => { launcher += String(b); });
  const deadline = Date.now() + STAND_DEADLINE_MS;
  for (;;) {
    const log = (existsSync(standLog) ? readFileSync(standLog, "utf8") : "") + launcher;
    // LIVE, AND THE VERB DOOR BOUND. `phase → live` prints before the vessel binds its UDS channel, so a vessel
    // read at that line can stand with no socket yet — and a vector sampling the socket once reads "no door"
    // for a door a beat away. The channel's own listen callback prints `uds verb-channel on …`; that line is
    // the event a caller's first verb needs, so the stand resolves on both.
    if (/phase → live/.test(log) && /uds verb-channel on /.test(log)) return { live: true, log };
    // FAIL FAST ONLY ON A FAULT THIS VESSEL RAISED. A bare /Error:/ also matches the keyhive wasm's own
    // DEBUG stream ("Error: Some(ReceiveCgkaOpError(UnknownInvitePrekey…))") — a line a healthy boot prints
    // on its way to `live`, which cuts the watch short and reports a hearth that stood as one that died.
    // These names belong to the JS runtime and to this house; the log below them belongs to everyone.
    if (/boot fault|FATAL|already in use|TypeError:|ReferenceError:|Cannot read properties/.test(log)) return { live: false, log };
    if (Date.now() > deadline) return { live: false, log: log + "\n[timeout]" };
    await new Promise((res) => setTimeout(res, 500));
  }
}

/**
 * The presenter every verb vector must carry: THIS VESSEL'S OWN KEY, the one the `lares` CLI presents.
 *
 * A zero key names nobody, and nobody is refused on capability before the question this file asks — does a
 * FACE stand — is ever reached. A vector holding a zero key measures the cap gate and reports the herm.
 */
async function operatorDid(r: string): Promise<string> {
  const { vesselDid } = await import("../../packages/lares-cli/src/env.js");
  const prior = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = r;
  try { return await vesselDid().catch(() => `0x${"0".repeat(64)}`); }
  finally { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; }
}

/**
 * A reader at the herm's FLOOR gate for `nexusAid`, as a reader dials it: the pin the herm's floor key derives for that Nexus
 * on the flow route, filed in a reader's own pair index, and a throwaway face (a chain no admit backs, `arm: null`) to
 * present. The publisher's key (`verifyingKey`) is the herm's vessel key, never the gate's.
 *
 * WHERE A HERM'S GATE STANDS: at a Nexus whose quorum counted its `carry`, on the herm's own replica of that Nexus's
 * carriage board, and nowhere else (the shut-routes house ruling, stable-founding-road #/rulings: an explicit Nexus opens the herm relay;
 * lar:///ha.ka.ba/lararium/node/herm-carriage). A herm founded with no join stands none, so this reader holds a pin the
 * herm COULD derive and meets no gate at it. HOW A STOOD GATE ANSWERS is the operator ruling "A herm answers the knock":
 * any proven peer, member or stranger. R2 stands both halves over real sockets: the same reader meets no gate before the
 * join and reads the map after it. In-process twins: packages/lararium-node/tests/herm-answers-the-knock.test.ts and
 * herm-carriage-relay.test.ts; the join through the commands: herm-explicit-join.test.ts.
 */
/** The AID of the charter the herm holds at its seal home, or null: what `nexus seal import` landed there. */
async function hermCharterAid(r: string): Promise<string | null> {
  const mesh = await import("../../packages/lararium-mesh/src/index.js");
  const node = await import("../../packages/lararium-node/src/index.js");
  const prior = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = r;
  try { return mesh.nexusAidOf(node.readNexusDoc(node.larSealHome())) ?? null; }
  finally { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; }
}

async function hermFloorReader(r: string, nexusAid: string) {
  const mesh = await import("../../packages/lararium-mesh/src/index.js");
  const node = await import("../../packages/lararium-node/src/index.js");
  const { FLOW_SOCKET_ROUTE } = await import("../../packages/lararium-mesh/src/flow-read-client.js");
  const fx = await import("../../packages/lararium-mesh/tests/face-gate-fixture.js");
  const prior = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = r;
  try {
    const vesselKey = (await node.loadVesselVerifyingKey()).toLowerCase();
    // The pin derives where the floor key door lives (the node package's own module graph): a door from one module instance
    // reads as foreign to a gate root from another (`door-other-tier`), so the derivation never mixes the two.
    const { flowFloorPinAt } = await import("../../packages/lararium-node/src/herm-carriage.js");
    const pins = mesh.hearthPinIndex();
    const hearth = "hearth-herm-floor";
    if (!pins.put(hearth, flowFloorPinAt(nexusAid, await node.vesselFloorKeyDoor()))) throw new Error("the herm's floor pin did not file in the reader's index");
    const w = await fx.world({ tier: "floor", route: FLOW_SOCKET_ROUTE, nexus: nexusAid });
    const p = await fx.presenter(w, "herm-floor reader");
    return {
      verifyingKey: vesselKey,
      pins, hearth, nexus: mesh.hex(new TextEncoder().encode(nexusAid)),
      presentation: { certificate: p.certificate, signer: p.signer, arm: null, history: p.history },
      audience: fx.AUDIENCE,
      deadlines: { draw(lapse: () => void) { const t = setTimeout(lapse, 5_000); return { cancel: () => clearTimeout(t) }; } },
      nexusHeld: mesh.nexusAidOf(node.readNexusDoc(node.larSealHome())) ?? null,
    };
  } finally { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; }
}

beforeAll(async () => { PORT = await freePort(); });

afterAll(async () => {
  try { await hearth?.stop(); } catch { /* the hearth's own root; nothing held */ }
  try {
    // LET THE VESSEL FINISH DYING. It flushes its stores on the way down, so tearing the tree out from
    // under it races its own writes and ENOTEMPTYs — a teardown fault that reads as a suite failure with
    // every vector green above it.
    await stopVessel();
  } catch { /* nothing held the port */ }
  try { if (root) rmSync(root, { recursive: true, force: true }); } catch { /* a straggler write; the tmpdir keeps it */ }
});

describe("the herm — the floor of the lararium cap stack", () => {
  test("R1 — a herm reaches live: found, stood, and NO face ever lit", async () => {
    root = standHermRoot();
    seedTestCustody(root, "ignore");   // the harness names the founding route
    execFileSync(process.execPath, [CLI, "vessel", "found", "--skip-build"], {
      env: { ...process.env, LAR_ROOT: root }, cwd: REPO, stdio: "ignore",
    });
    const { live, log } = await standHerm(root);
    // The failure carries the next reach-for-a-face by name — that is what this vector is for.
    expect(live, `the floor did not stand:\n${log.slice(-1200)}`).toBe(true);

    // ★ THE FLOOR IS THE CLAIM, so prove it POSITIVELY rather than by the absence of a `persona new`.
    // Every vector below reads as "the floor carries / refuses / lifts", and each of those is a
    // different verdict on a hearth. A rig that quietly lit a face would turn R5's LIFT green by
    // having nothing to lift — the shape `founding-witness` already refuses on the place half.
    //
    // The roster rests sealed, and this vessel stands locked, so no command reads it here: a face's rows prove
    // themselves by their NAMES instead. A face founding lands a persona root and its anchors in the identity
    // home, each under a name the carrier table spells; a floor that never lit a face holds neither.
    const rowsNamed = (dir: string, name: RegExp): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? rowsNamed(join(dir, e.name), name) : name.test(e.name) ? [join(dir, e.name)] : []);
    expect(rowsNamed(root, /^vk-slots\.bin$/).length, "the walk found no founded identity home to read").toBe(1);   // CONTROL: the walk reads the founded custody
    expect(rowsNamed(root, /persona-group-root|^anchors-h\d+\.json$/), "a face stands on the floor rig — every vector below measures a hearth, not a floor").toEqual([]);
    // And the locked floor says so when asked: a sealed read beside it refuses and names the unlock, where it
    // once opened a second key session of its own.
    const asked = spawnSync(process.execPath, [CLI, "persona", "list", "--json"], {
      env: { ...process.env, LAR_ROOT: root }, cwd: REPO, encoding: "utf8",
    });
    expect(asked.status, `a locked floor answered a sealed read:\n${asked.stdout.slice(0, 400)}`).not.toBe(0);
    expect(`${asked.stdout}\n${asked.stderr}`).toMatch(/lares vault unlock/);
  }, 200_000);

  test("R2 — a herm's floor gate stands at its explicit Nexus and only there, and there it answers the knock", async () => {
    const { pullAndVerifyFlow } = await import("../../packages/lararium-mesh/src/flow-read-client.js");
    const { CLOSED_DOOR } = await import("../../packages/lararium-node/src/bulb-routes.js");
    const origin = `http://127.0.0.1:${PORT}`;
    // A STRANGER asks for the pointer over HTTP and draws the one closed door — the vessel answers, and says
    // nothing. A refused connection here would mean nothing stands at all, which is a different verdict.
    const stranger = await fetch(`${origin}/flow/pointer`).catch(() => null);
    expect(stranger, `nothing answered on :${PORT} — no vessel stands there for R5 to lift`).not.toBeNull();
    expect(stranger!.status).toBe(CLOSED_DOOR.status);
    expect(await stranger!.text()).toBe(CLOSED_DOOR.body);

    // THE HEARTH whose quorum will carry this herm: the Stable founding act seats its one-seat seed charter, so its one
    // chair counts a carry alone. The charter travels to the herm by its own doors (`seal export` → `seal import`).
    hearth = await openStaged({ tag: "herm-floor-hearth" });
    const exported = await hearth.cli(["nexus", "seal", "export", "--no-json"]);
    expect(exported.code, `the hearth exported no charter:\n${exported.stderr.slice(-400)}`).toBe(0);
    const courier = mkdtempSync(join(stageDir(), "herm-floor-courier-"));
    writeFileSync(join(courier, "hearth-charter.mem"), exported.stdout);
    const imported = run(["nexus", "seal", "import", join(courier, "hearth-charter.mem"), "--json"]);
    expect(imported.code, `the herm refused the hearth's charter:\n${imported.said}`).toBe(0);

    // RED — NO GATE BEFORE THE JOIN (the shut-routes house ruling, stable-founding-road #/rulings: an explicit Nexus opens the herm relay). The herm
    // holds the charter and nothing more: no quorum counted its carry, so it stands no floor gate at that Nexus. A reader
    // holding the very floor pin the herm's floor key derives there, presenting a proven face, meets no gate.
    const aid = await hermCharterAid(root);
    expect(aid, "the herm holds no charter: the import landed nothing").toMatch(/^nexus-[0-9a-f]{64}$/);
    const before = await hermFloorReader(root, aid!);
    expect(before.nexusHeld).toBe(aid);
    const unjoined = await pullAndVerifyFlow(origin, before);
    expect(unjoined.ok, "a herm that only holds a charter served its map at a floor gate it never stood").toBe(false);
    expect(unjoined.pointer).toBeUndefined();

    // THE JOIN, BY HAND, through the three doors a person runs (lar:///ha.ka.ba/lararium/node/carry-bundle): the herm signs
    // its carrier seal and its floor pin with its own vessel key, the hearth's quorum counts the carry with the pin beside
    // it, and the herm takes the bundle onto its own replica. The running herm refolds, and its floor gate stands there.
    const signed = run(["nexus", "carry-for", "--json"]);
    expect(signed.code, `the herm signed no carrier seal:\n${signed.said}`).toBe(0);
    const seal = (signed.json?.["data"] ?? {}) as { nym?: string; carrierSig?: string; floorPin?: unknown };
    expect(seal.floorPin, "carry-for signed no floor pin at the hearth's Nexus").toBeTruthy();
    writeFileSync(join(courier, "floor-pin.json"), JSON.stringify(seal.floorPin));
    const carried = await hearth.cli(["nexus", "carry", seal.nym!, "--carrier", seal.carrierSig!, "--floor-pin", join(courier, "floor-pin.json"), "--json"]);
    expect(carried.code, `the hearth's quorum refused the carry:\n${carried.stdout.slice(-400)}\n${carried.stderr.slice(-400)}`).toBe(0);
    const bundle = (carried.json?.["data"] as { carryBundle?: unknown } | undefined)?.carryBundle;
    expect(bundle, "the carry emitted no carry bundle").toBeTruthy();
    writeFileSync(join(courier, "carry-bundle.json"), JSON.stringify(bundle));
    const taken = run(["nexus", "carry-take", join(courier, "carry-bundle.json"), "--json"]);
    expect(taken.code, `the herm refused its carry bundle:\n${taken.said}`).toBe(0);
    expect((taken.json?.["data"] as { refolded?: boolean } | undefined)?.refolded, "the standing herm did not refold on the take").toBe(true);

    // A HERM ANSWERS THE KNOCK (operator ruling, stable-founding-road#/rulings; siege-resilience). The same proven stranger,
    // no member of any Nexus, no arm, knocks at the gate the join stood and reads the map, verified under the herm's key.
    const joined = await pullAndVerifyFlow(origin, before);
    expect(joined.ok, `the carried herm answered no knock: ${joined.reason ?? "(no reason)"}\n${standLogTail(root)}`).toBe(true);
    expect(joined.pointer?.pub).toBe(before.verifyingKey);
    rmSync(courier, { recursive: true, force: true });
  }, 300_000);

  test("R3 — a herm carries: its verb channel answers a caller", async () => {
    const dir = sockStands(root) ? substrateDir(root) : null;
    expect(dir, "no UDS door — a herm that carries nothing has no floor under anything").not.toBeNull();
    // A WELL-FORMED call. `where` requires `args.tiddler`; an empty payload earns "args.tiddler is
    // required" — the channel answering correctly, which a vector reading only `status` scores as a floor
    // that does not carry.
    const r = await askVerb("where", { tiddler: "$:/lares/flow" }, R3_CEILING_MS);
    expect(r, `the verb channel never answered a well-formed \`where\`:\n${r.slice(0, 400)}\n${standLogTail(root)}`).toMatch(/"status":"done"/);
  }, R3_BUDGET_MS);

  test("R4 — a herm refuses a hearth-scoped act LEGIBLY, never by stack trace", async () => {
    // Either an unknown verb or a named refusal — both say "light a face". Neither may be a raw throw, and
    // neither may be the hang guard firing: a cutoff names no lift, so a refusal that never arrived reads red.
    // The circles plane arrives with the FACE — a PLACE bootstrap carries the daemon bag alone — so a follow
    // verb on this floor names the lift. (A face's own names answer no verb at all: they ride the custody door.) Answering
    // "circles-<tag> unresolved: the flow registry names no such plane" is true and useless: it reads
    // as a broken registry to the one human who could fix it by lighting a face.
    const c = await askVerb("circle-list", { circle: "following" }, R4_CEILING_MS);
    expect(c, `\`circle-list\` on the floor refused in registry-fault language:\n${c.slice(0, 400)}\n${standLogTail(root)}`)
      .toMatch(/light a face|unknown verb|no face|waking floor/i);
  }, R4_BUDGET_MS);

  test("R5 — a herm LIFTS into a lararium: the Stable founding act over the place, re-wake, the hearth verbs stand", async () => {
    // THE CHARTER R2 CARRIED IN BELONGS TO THE HEARTH THAT FOUNDED IT, never to this place: a face binds its own hearth's seed
    // charter, and a hearth founds its own seed. The herm's copy leaves before the lift measures a charterless place.
    rmSync(join(root, "data", "lares", "nexus"), { recursive: true, force: true });
    // CONTROL — THE FLOOR HOLDS NO VESSEL KEY, SO NO FACE LIGHTS ON IT. A face founding seals its anchors and its
    // veil archive under the vessel key; the standing vessel rests locked, and the founding refuses by naming the
    // unlock, with nothing landed. A lift that passed here would have lit a face under no key.
    const locked = run(["persona", "new", "0", "--name", "the lift"]);
    expect(locked.code, `a locked floor lit a face:\n${locked.said}`).not.toBe(0);
    expect(locked.said).toMatch(/lares vault unlock/);
    // A PLACE HOLDS NO HEARTH, SO NO FACE LIGHTS ON IT EVEN OPENED: a face binds its hearth's seed charter.
    unlockStaged(root);
    const unseeded = run(["persona", "new", "0", "--name", "the lift"]);
    expect(unseeded.code, `an opened place with no seed charter lit a face:\n${unseeded.said}`).not.toBe(0);
    expect(unseeded.said).toMatch(/no seed charter stands here/);
    // The lift: the Stable founding act over the standing place, with no vessel holding the store.
    await stopVessel();
    const lit = run(["vessel", "found", "--hearth", "--name", "the lift", "--skip-build"]);
    expect(lit.code, `the Stable founding act refused the lift:\n${lit.said}`).toBe(0);
    const { live, log } = await standHerm(root);
    // CARRY THE BOOT INTO THE FAILURE. A bare `expected false to be true` names a vessel that did not
    // stand and says nothing about WHY — and this vector has flaked without ever telling anyone what the
    // lifted boot was doing when it did. The log the vessel wrote is the only witness to that.
    expect(live, `the lift left the vessel unable to stand:\n${log.slice(-2000)}`).toBe(true);
    unlockStaged(root);

    const dir = sockStands(root) ? substrateDir(root) : null;
    expect(dir, "the lifted hearth bound no UDS door — nothing to ask, and no fallback that would be this hearth").not.toBeNull();
    const r = await askVerb("circle-list", { circle: "following" }, R5_CEILING_MS);
    expect(r, `the lifted hearth still refuses its own face-scoped \`circle-list\`:\n${r.slice(0, 400)}\n${standLogTail(root)}`).toMatch(/"status":"done"/);
  }, R5_BUDGET_MS);
});
