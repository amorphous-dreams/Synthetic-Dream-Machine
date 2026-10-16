// retired-names-witness — one list of every burned name, read against the tree.
//
// A burned name simply does not appear: not in code, not in a comment, not in a test, a tool, a workflow or a
// compose file. This witness reads `packages/*/src`, `packages/*/tests`, `tests/`, `tools/`, `.github/` and every
// `docker-compose*.yml`, and names each `file:line name` where a burned name stands. Comments count; string bodies
// count. The guard lists that hold names of their own (and this witness with its self-test) are the only files it
// skips.
//
// It also LISTS, and never fails on, each `bags/**/*.mem` line outside `api/pono` that names a burned name: a canon
// meme is the operator's to rule, so those lines read as a sitting list (`CANON-MEME path:line name`).
//
// Exit 0 = no code site. 1 = a code site stands. 2 = refused (a root that holds none of the scanned trees).
//
//   node tools/retired-names-witness.mjs [--root <repo>] [--json]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const word = (name) => new RegExp(String.raw`(?<![\w$])${name}(?![\w$])`, "g");
const kebab = (name) => new RegExp(String.raw`(?<![\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\w-])`, "g");
const literal = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

/** Every burned name, each with the pattern it reads by. A camelCase or SCREAMING name reads as a whole word. */
export const RETIRED = Object.freeze([
  // The pre-sync handshake: its runner, its challenge, its gate, both proofs, every frame and its guard.
  ...[
    "runPeerHandshake", "mkLarChallenge", "DaemonAuthGate", "verifyLeafProof", "verifyAuthProof",
    "isLarChallengeMsg", "buildAuthResponse", "evaluateAuthProof", "mkLarAuth", "mkLarAuthOk", "authOkBytes", "verifyAuthOk",
    "signLeafProof", "signPresented",
    "isLarAuthMsg", "isLarAuthOkMsg", "leafProofBytes", "authProofBytes", "mintLeafNonce", "presentedCid", "presentedSigner",
    "LarChallengeMsg", "LarAuthMsg", "LarAuthOkMsg", "AuthProofWire", "PeerHandshake", "AuthVerifierShore", "verifyPeer",
  ].map((name) => ({ name, re: word(name) })),
  { name: "lar:challenge", re: kebab("lar:challenge") },
  { name: "lar:auth", re: kebab("lar:auth") },
  { name: "daemon-auth-gate", re: kebab("daemon-auth-gate") },
  { name: "auth-proof", re: kebab("auth-proof") },
  { name: "presented-leaf-proof", re: kebab("presented-leaf-proof") },
  { name: "auth-ok", re: kebab("auth-ok") },
  { name: "auth-wire", re: kebab("auth-wire") },
  // The env dial: a join address, a gate key and a doc URL handed to a vessel by variable (any `LAR_<X>_JOIN_*` too).
  { name: "LAR_JOIN_SYNC", re: /\bLAR_(?:[A-Z0-9]+_)*JOIN_SYNC\b/g },
  { name: "LAR_JOIN_GATE", re: /\bLAR_(?:[A-Z0-9]+_)*JOIN_GATE\b/g },
  { name: "LAR_JOIN_DOC", re: /\bLAR_(?:[A-Z0-9]+_)*JOIN_DOC\b/g },
  { name: "LAR_JOIN_*", re: /\bLAR_(?:[A-Z0-9]+_)*JOIN_\*/g },
  { name: "LAR_CARRIAGE_RELAY", re: /\bLAR_CARRIAGE_RELAY\b/g },
  // The bare-key knock and the bare-key browser dial.
  ...["knockPath", "knockedUrl", "relayGatePubKey", "relayPinFor"].map((name) => ({ name, re: word(name) })),
  { name: "?gate=", re: /[?&]gate=/g },
  { name: "?oracle-gate=", re: literal("?oracle-gate=") },
  { name: "browser-relay-pin", re: kebab("browser-relay-pin") },
  // The shut relay, its channel and its serve loop.
  ...[
    "startCarriageServeLoop", "CarriageServeLoop", "CarriageServeLoopConfig",
    "startAuthenticatedMembershipRelay", "AuthenticatedWSMembershipChannel", "AuthenticatedMembershipRelay", "MEMBERSHIP_RELAY_SHUT",
    "WSMembershipChannel", "startMembershipRelay",
    "representWalk", "presentationKey", "carriageRelayUrl", "carriagePollIntervalMs",
  ].map((name) => ({ name, re: word(name) })),
  ...["carriage-serve-loop", "authenticated-membership-relay", "ws-membership-channel", "membership-relay-shut", "herm-relay-shut"]
    .map((name) => ({ name, re: kebab(name) })),
]);

/** The guard lists that name burned names of their own, and this witness with its self-test. */
export const SKIP = Object.freeze([
  "packages/lararium-mesh/tests/gate-cutover-reach.test.ts",
  "packages/lararium-mesh/tests/gate-dial-funnel.test.ts",
  "tools/held-out-cells.test.mjs",
  "tools/retired-names-witness.mjs",
  "tools/retired-names-witness.test.mjs",
]);

const BINARY = /\.(?:png|jpe?g|gif|webp|ico|wasm|woff2?|ttf|otf|gz|tgz|zip|pdf|mp4|webm|sqlite|db|bin)$/i;

/** Every `{ line, name }` where `text` names a burned name, one entry per occurrence. */
export function sitesInText(text) {
  const out = [];
  text.split("\n").forEach((line, k) => {
    for (const { name, re } of RETIRED) for (const _ of line.matchAll(re)) out.push({ line: k + 1, name });
  });
  return out;
}

function filesUnder(root, dir, out) {
  let names;
  try { names = readdirSync(join(root, dir)); } catch { return out; }
  for (const name of names) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const rel = dir ? `${dir}/${name}` : name;
    let st;
    try { st = statSync(join(root, rel)); } catch { continue; }
    if (st.isDirectory()) filesUnder(root, rel, out);
    else if (st.isFile() && !BINARY.test(name)) out.push(rel);
  }
  return out;
}

/** The files the code reading covers, repo-relative and sorted. */
export function codeFiles(root) {
  const out = [];
  let pkgs = [];
  try { pkgs = readdirSync(join(root, "packages")); } catch { /* no packages */ }
  for (const pkg of pkgs) for (const leaf of ["src", "tests"]) filesUnder(root, `packages/${pkg}/${leaf}`, out);
  for (const dir of ["tests", "tools", ".github"]) filesUnder(root, dir, out);
  for (const name of readdirSync(root)) if (/^docker-compose.*\.ya?ml$/.test(name)) out.push(name);
  return [...new Set(out)].filter((rel) => !SKIP.includes(rel)).sort();
}

/** The canon memes the listing covers: every `bags/**\/*.mem` outside an `api/pono` carrier. */
export function memeFiles(root) {
  return filesUnder(root, "bags", []).filter((rel) => rel.endsWith(".mem") && !/(?:^|\/)api\/pono\//.test(rel)).sort();
}

const sitesOver = (root, files) => files.flatMap((rel) => {
  let text;
  try { text = readFileSync(join(root, rel), "utf8"); } catch { return []; }
  return sitesInText(text).map((s) => ({ file: rel, ...s }));
});

/** The whole reading: `code` sites fail the witness; `memes` sites are listed. */
export function readTree(root) {
  const files = codeFiles(root);
  return { files: files.length, code: sitesOver(root, files), memes: sitesOver(root, memeFiles(root)) };
}

function main(argv) {
  const at = argv.indexOf("--root");
  const root = resolve(at >= 0 ? argv[at + 1] : join(dirname(fileURLToPath(import.meta.url)), ".."));
  const r = readTree(root);
  if (r.files === 0) { console.error(`retired-names-witness: ${root} holds none of the scanned trees`); return 2; }
  if (argv.includes("--json")) { console.log(JSON.stringify(r, null, 2)); return r.code.length ? 1 : 0; }
  for (const s of r.memes) console.log(`CANON-MEME ${s.file}:${s.line} ${s.name}`);
  for (const s of r.code) console.log(`RETIRED ${s.file}:${s.line} ${s.name}`);
  const owners = new Map();
  for (const s of r.code) owners.set(s.file, (owners.get(s.file) ?? 0) + 1);
  console.log(`RETIRED-NAMES: ok=${r.code.length === 0} files=${r.files} sites=${r.code.length} owners=${owners.size} canon-meme=${r.memes.length} root=${relative(process.cwd(), root) || "."}`);
  return r.code.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
