/**
 * vessel-parity — does EVERY vessel shore compose the capabilities the parity law binds?
 *
 * See `tools/vessel-parity-witness.sh` for why this instrument exists. This file holds the roster,
 * the source reading, and the five guards that keep the run from going green on an absent subject.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO = process.env.REPO ?? process.cwd();

/* ── THE SHORES ─────────────────────────────────────────────────────────────────────────────────
 * A shore is a VESSEL CLASS: one package that opens a vessel over one substrate. Its composition
 * set reads package-wide, not door-file-only — measured, the node shore composes
 * `carryPersonaKelUpTheGradient` through `persona-kel-ring.ts` (a node-local re-export), so a
 * door-file-only reading would call the node shore thin and go red on the shore that HAS the cure.
 */
const SHORES = [
  { name: "node",    dir: "packages/lararium-node/src" },
  { name: "browser", dir: "packages/lararium-browser/src" },
];

/** The packages a shore composes FROM. A capability housed anywhere else cannot reach both shores. */
const SHARED = ["@lararium/mesh", "@lararium/keyhive"];

/* ── THE ROSTER ─────────────────────────────────────────────────────────────────────────────────
 * Every capability under the parity law, and for each the shared package that MUST house it.
 *
 * `exempt` names a RULED seat difference — a shore that legitimately does not compose it — and MUST
 * carry the reason and the ruling's citation. An exemption is a DECLARED ACT: guard 5 retires one the
 * moment both shores actually compose the capability, so the set cannot silently accumulate dead weight.
 */
const ROSTER = [
  {
    symbol: "climbNexusBoards",
    pkg: "@lararium/mesh",
    why: "the per-Nexus board climb. Its own header vows both shores compose the identical call.",
  },
  {
    symbol: "carryPersonaKelUpTheGradient",
    pkg: "@lararium/mesh",
    why: "the carry that unbricks a hearth seated after founding. Sat on the node shore for a day while the leaf carried a byte-identical fail-closed gate and no cure.",
  },
  {
    symbol: "makeOperatorDaemonBehavior",
    pkg: "@lararium/keyhive",
    why: "the daemon behaviour both island entries wire byte-identically — which is why it lives once in keyhive.",
  },
  {
    symbol: "nexusIdentity",
    pkg: "@lararium/mesh",
    why: "resolves the anchor a vessel dials. The climb and the carry both key on it, so a shore without it cannot climb.",
  },
  {
    symbol: "whoFaceCap",
    pkg: "@lararium/mesh",
    why: "composing the WHO cap is binding. A shore that cannot bind a face carries no person.",
  },
  {
    symbol: "shareConfigOf",
    pkg: "@lararium/mesh",
    why: "the share-verdict gate every replica applies before a document leaves the island.",
  },
  {
    symbol: "DeterministicFederationGate",
    pkg: "@lararium/mesh",
    why: "the federation posture read. A shore without it federates ungated.",
  },
  {
    symbol: "materializeSharedLarDoc",
    pkg: "@lararium/mesh",
    why: "the shared-doc materialisation both vessel doors perform at open.",
  },
  {
    symbol: "registerCrossroadsInOracle",
    pkg: "@lararium/mesh",
    why: "the crossroads announce both shores make to the oracle they dial.",
  },
  {
    symbol: "vesselDyads",
    pkg: "@lararium/mesh",
    why: "the dyad veil read. Ruled to derive from the device-minted vessel key on EITHER shore.",
  },
  {
    symbol: "deriveRegisterBags",
    pkg: "@lararium/mesh",
    why: "the bag register every vessel stands at open.",
  },
  {
    symbol: "ed25519SignerFromSeed",
    pkg: "@lararium/mesh",
    why: "the signer both shores mint from their own seed.",
  },

  /* ── RULED ASYMMETRIC ────────────────────────────────────────────────────────────────────────
   * Each row names a seat difference canon RULES, not drift. The reason carries the citation.
   * Guard 5 retires any row whose asymmetry has since closed, so a ruling cannot rot here inertly.
   */
  {
    symbol: "repoRoot",
    pkg: "@lararium/mesh",
    ruled: {
      absent: ["browser"],
      reason: "`@lararium/mesh/node` subpath — a repo-root fs read. device-capabilities-2026.mem:59 rules the human-visible `bags/`/`wikis/` projection a NODE seat (two of three engines refuse `showDirectoryPicker`); a browser vessel projects to OPFS alone, which holds no repo root to resolve.",
    },
  },

  /* ── OWED — an UNRULED asymmetry, PINNED ────────────────────────────────────────────────────
   * Not a ruling and not a failure: a measured difference nobody has ruled either way. The row
   * pins the holder set EXACTLY as measured, so the gap cannot WIDEN unseen and cannot close
   * unnoticed — either movement goes red and asks for the row to be re-reasoned or retired.
   * This is the open-φ ledger in weld form: a debt carried visibly, never dropped silent.
   */
  {
    symbol: "AntigenRing",
    pkg: "@lararium/mesh",
    owed: {
      absent: ["browser"],
      reason: "The node share-verdict composes antigen + membership + plane-seal + posture (`open-node-vessel.ts:639,663,692`); the browser composes only the federation gate and its relay-peer set. No ruling found either way — the browser's thinner verdict may be correct for a leaf, or may be the next drift. Closing it needs the antigen board to reach the leaf shore.",
    },
  },
  {
    symbol: "NexusMembership",
    pkg: "@lararium/mesh",
    owed: {
      absent: ["browser"],
      reason: "Same seam as `AntigenRing` — node reads a membership holder into its verdict, the leaf shore reads none. Unruled.",
    },
  },

  /* ── UNWIRED — shared, sited for BOTH shores, composed by NEITHER ───────────────────────────
   * The vow-read-aspirational family: a capability correctly housed in mesh whose promise no shore
   * has yet taken up. A row here asserts the SYMMETRIC absence holds — so the day one shore wires it
   * and the other does not, this gate names the shore that stayed thin, at that commit.
   */
  {
    symbol: "makePersonaGroupIdentityRing",
    pkg: "@lararium/mesh",
    unwired: {
      reason: "Zero production call sites; both shores run `identity = null` — the browser at `open-browser-vessel.ts:395` (its own comment calls this an HONEST GAP), the node at `self-slot-share.ts:95` ('The self-slot INNER capability ring stays inert'). The null is RULED deliberate: `federation-gate.ts:237-244` holds that lighting the inner ring re-introduces the allow-all regression Ringward found. Symmetric absence, not browser drift — and `one-name-one-relation` rules the naming fusions resolve BEFORE this lights, since the cap layer hashes a bag URL to seed the Document behind it.",
    },
  },
];

/** The roster floor. A gate that stops seeing its subject reports the cleanest run it ever produced. */
const ROSTER_FLOOR = 16;
/** And the floor under the LAW's own arm: rows that must actually reach every shore. */
const BOTH_SHORES_FLOOR = 12;

/* ── THE READING ────────────────────────────────────────────────────────────────────────────────── */

/** Every `.ts` under a directory, recursively, skipping test and stub trees. */
function sources(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name === "__stubs__" || e.name === "__tests__" || e.name === "node_modules") continue;
        walk(join(d, e.name));
      } else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
        out.push(join(d, e.name));
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * The symbols a shore imports from the shared packages.
 *
 * Reads `import { … } from "<shared>…"` and `export { … } from "<shared>…"` — the re-export form
 * counts, because a shore that re-exports a mesh capability under its own name composes it (the node
 * shore's `persona-kel-ring.ts` does exactly this). A bare or namespace import contributes no symbol.
 */
function composedSymbols(shoreDir) {
  const found = new Set();
  const spec = SHARED.map((p) => p.replace(/[/\-]/g, "\\$&")).join("|");
  const re = new RegExp(String.raw`(?:import|export)\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["'](?:${spec})[^"']*["']`, "g");
  for (const file of sources(join(REPO, shoreDir))) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(re)) {
      for (const raw of m[1].split(",")) {
        // `type X`, `X as Y` → the imported name is what the shared package exports.
        const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
        if (name) found.add(name);
      }
    }
  }
  return found;
}

/** Does a shared package actually EXPORT this symbol? A vanished subject must go red, never quiet. */
function sharedExports(pkg) {
  const dir = join(REPO, "packages", pkg === "@lararium/mesh" ? "lararium-mesh" : "lararium-keyhive", "src");
  const found = new Set();
  for (const file of sources(dir)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|class|interface|type|let)\s+([A-Za-z0-9_$]+)/g)) {
      found.add(m[1]);
    }
    // `export { a, b as c } from "./x.js"` and `export { a, b };`
    for (const m of text.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) {
      for (const raw of m[1].split(",")) {
        const t = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
        const name = (t[1] ?? t[0])?.trim();
        if (name) found.add(name);
      }
    }
  }
  return found;
}

/* ── THE GUARDS ─────────────────────────────────────────────────────────────────────────────────── */

const failures = [];
const notes = [];

// Guard 0 — the shores stand. A renamed package would otherwise read as two empty sets that agree.
for (const shore of SHORES) {
  if (!existsSync(join(REPO, shore.dir))) {
    failures.push(`SHORE ABSENT — ${shore.name} (${shore.dir}). The reading has no subject.`);
  }
}
if (failures.length) { report(); process.exit(1); }

const composed = new Map(SHORES.map((s) => [s.name, composedSymbols(s.dir)]));
const exported = new Map(SHARED.map((p) => [p, sharedExports(p)]));

// A shore whose reading came back empty measured nothing.
for (const [name, set] of composed) {
  if (set.size === 0) failures.push(`SHORE READ EMPTY — ${name} composes no shared symbol at all. The scanner lost its grip, not the shore.`);
}

// Guard 1 — the roster floor.
if (ROSTER.length < ROSTER_FLOOR) {
  failures.push(`ROSTER BELOW FLOOR — ${ROSTER.length} capabilities, floor ${ROSTER_FLOOR}. Capabilities left the roster without the floor moving.`);
}

for (const row of ROSTER) {
  // Guard 2 — the subject exists. A renamed capability must go RED, not silently unmeasured.
  if (!exported.get(row.pkg)?.has(row.symbol)) {
    failures.push(`SUBJECT VANISHED — \`${row.symbol}\` is on the roster but ${row.pkg} exports no such name. Renamed or deleted; this row has been measuring nothing.`);
    continue;
  }

  const all = SHORES.map((s) => s.name);
  const holders = SHORES.filter((s) => composed.get(s.name).has(row.symbol)).map((s) => s.name);
  const absent = all.filter((n) => !holders.includes(n));

  /* A DECLARED ASYMMETRY — ruled or owed. Both are PINNED: the measured holder set must match the
   * declaration exactly, so the gap can neither widen nor close without this gate saying so. */
  const decl = row.ruled ?? row.owed;
  if (decl) {
    const kind = row.ruled ? "RULED" : "OWED";
    // Guard 3 — a declared asymmetry carries its reason. An undeclared reason is not a ruling.
    if (!decl.reason?.trim()) {
      failures.push(`${kind} UNREASONED — \`${row.symbol}\` declares an asymmetry with no reason. A seat difference states its ruling; an owed gap states what closing it takes.`);
      continue;
    }
    // Guard 5 — the declaration retires itself. Inertness cannot preserve a stale hold-out.
    const same = decl.absent.length === absent.length && decl.absent.every((s) => absent.includes(s));
    if (!same) {
      if (absent.length === 0) {
        failures.push(`${kind} CLOSED — \`${row.symbol}\` declares ${decl.absent.join("+")} absent, yet EVERY shore now composes it. The asymmetry is gone: retire the row.`);
      } else {
        failures.push(`${kind} MOVED — \`${row.symbol}\` declares ${decl.absent.join("+")} absent; measured absent: ${absent.join("+") || "(none)"}. The gap shifted shores — re-reason the row.`);
      }
      continue;
    }
    notes.push(`${kind === "RULED" ? "RULED ASYMMETRIC" : "OWED (unruled)   "}  ${row.symbol}  (${row.pkg})  —  absent on ${decl.absent.join("+")}`);
    continue;
  }

  /* UNWIRED — the symmetric absence must HOLD. One shore wiring it alone is the drift this catches. */
  if (row.unwired) {
    if (!row.unwired.reason?.trim()) {
      failures.push(`UNWIRED UNREASONED — \`${row.symbol}\` declares no shore composes it, with no reason.`);
      continue;
    }
    if (holders.length === all.length) {
      failures.push(`UNWIRED CLOSED — \`${row.symbol}\` now reaches EVERY shore. Retire the row onto the parity law proper.`);
    } else if (holders.length > 0) {
      failures.push(`THIN SHORE — \`${row.symbol}\` was composed by NO shore; now \`${holders.join("+")}\` composes it and \`${absent.join("+")}\` does not. A shared capability took up on one shore alone.`);
    } else {
      notes.push(`UNWIRED (neither)   ${row.symbol}  (${row.pkg})`);
    }
    continue;
  }

  // Guard 4 — the parity law itself. Named by SHORE and by CAPABILITY.
  if (absent.length === all.length) {
    failures.push(`SHARED BUT DEAD — \`${row.symbol}\` sits under the parity law and NO shore composes it. Either the law names a capability nothing takes up, or the reading lost it.`);
    continue;
  }
  if (absent.length) {
    for (const shore of absent) {
      failures.push(`THIN SHORE — the \`${shore}\` vessel does NOT compose \`${row.symbol}\` from ${row.pkg}. ${row.why ?? ""}`);
    }
    continue;
  }
  notes.push(`BOTH SHORES         ${row.symbol}  (${row.pkg})`);
}

function report() {
  for (const n of notes) console.log(`  ${n}`);
  if (failures.length) {
    console.log("");
    for (const f of failures) console.log(`  ✗ ${f}`);
  }
}

/* THE SECOND FLOOR. The roster could hold its count while every row drifted into a declared
 * asymmetry — a gate satisfied entirely by exemptions measures nothing. So the LAW's own arm carries
 * its own floor: this many rows must actually reach every shore. */
const bothShores = ROSTER.filter((r) => !r.ruled && !r.owed && !r.unwired).length;
if (bothShores < BOTH_SHORES_FLOOR) {
  failures.push(`PARITY ARM BELOW FLOOR — only ${bothShores} rows bind every shore, floor ${BOTH_SHORES_FLOOR}. Capabilities drifted into declared asymmetries faster than the floor moved.`);
}

report();
console.log("");
console.log(`vessel-parity: ${ROSTER.length} capabilities walked over ${SHORES.length} shores ` +
            `(roster floor ${ROSTER_FLOOR}, parity-arm floor ${BOTH_SHORES_FLOOR}, ${bothShores} rows bind every shore); ` +
            SHORES.map((s) => `${s.name} composes ${composed.get(s.name).size} shared symbols`).join(", ") + ".");

if (failures.length) {
  console.log(`vessel-parity: ${failures.length} breach(es) — a vessel shore drifted thin.`);
  process.exit(1);
}
console.log("vessel-parity: every capability under the law reaches every shore.");
