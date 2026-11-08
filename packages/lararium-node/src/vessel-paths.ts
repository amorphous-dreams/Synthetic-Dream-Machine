/**
 * vessel-paths — the ONE resolver for the operator's house state, every path laid beneath ONE named root.
 *
 * `LAR_ROOT` names the house root and nothing else stands in for it; an unnamed root refuses by name
 * (`HouseRootUnnamed`, from `@lararium/mempalace/house-root`). The container sets `LAR_ROOT=/lar`. Beneath it:
 *
 *   <root>/hearth/vessel       the vessel substrate (Automerge Repo, the social bootstrap)
 *   <root>/hearth/identity     the sovereign keypair + the veiled-Handle anchors
 *   <root>/hearth/nexus        the Nexus seal
 *   <root>/hearth/sensoriums   memory · mesh · memetic-wikitext, each under its own name
 *   <root>/hearth/checkpoints  the watermarks (projection, harvest) — each re-derives from what it watches
 *   <root>/hearth/staging      normalized transcript copies a harvest stages
 *   <root>/library             the acquired library — outside the hearth, kept through every re-founding
 *   <root>/projections         the deliberate plaintext renders
 *   <root>/config              config.json, meta.json, the repo registry
 *   <root>/cache               sweepable scratch (the ephemeral sensoriums)
 *   <root>/run                 transient spool, sockets and levers
 *
 * A re-founding clears `<root>/hearth` and touches nothing beside it, so every class that must outlive one
 * (the library, the projections, the operator's settings) stands at the root's first level, never inside it.
 * The Python mirror (`packages/lararium-sensorium/scripts/house_root.py`) holds the same table;
 * `tests/house-root-weld.test.ts` reads both and asserts them equal.
 *
 * The SENSORIUM consolidation (SHEAF-TRUE): content ← the contentpalace, structure ← the structurepalace,
 * form ← the formpalace, ALL THREE co-located under `<sensoriums>/memory/{content,structure,form}`
 * so the filetree IS the composition (sensorium.ts). The lararium OWNS its content plane: the sovereign
 * contentpalace inherits mempalace's exact base schema, holds content internally under the abiding home,
 * and adopting a user's mempalace history runs as a deliberate one-way import Act (`guest-import.ts`),
 * never a runtime binding. bands + coupling ride as BASE caps — they live in the manifest, never as dirs.
 *
 * The mesh federation store lives as its OWN `mesh` SENSORIUM that `#has` three nested child sensoriums
 * (WHO · AUTHORITY · FLOW) under `<sensoriums>/mesh`, the children hanging below it. The mesh's own
 * caps stay minimal — its STRUCTURE comes from the three children, each carrying its own thin manifest.
 *
 * Both the CLI (local-connector) and the node daemon (uds-channel) resolve through HERE, so the UDS socket
 * path always agrees.
 */

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

// The house root and its classes live in ONE cycle-free home — `@lararium/mempalace/house-root` — so
// vessel-paths and mempalace's palace-path derive every home from the SAME source (no value-duplication).
// Imported across the existing node → mempalace edge.
import {
  HouseRootUnnamed, larHouseRoot, larHearthHome, larSensoriumsHome, larCheckpointsHome, larStagingHome,
  larLibraryRoot, larProjectionsHome, larConfigHome, larCacheHome, larRuntimeHome, mempalaceContentParent,
} from "@lararium/mempalace/house-root";

// Re-export the root and its classes, so every caller in the node and the CLI names them through here.
export {
  HouseRootUnnamed, larHouseRoot, larHearthHome, larSensoriumsHome, larCheckpointsHome, larStagingHome,
  larLibraryRoot, larProjectionsHome, larConfigHome, larCacheHome, larRuntimeHome,
};

/**
 * The ONE mempalace executable resolver (DRY) — prefer the user-installed CLI at `~/.local/bin`
 * (`mempalace.exe` on win32), fall back to the bare name on PATH. Both the palace-organ setup and the
 * sensorium-ingest leg resolve the exe through HERE so the win32 spelling + the local-bin preference never
 * fork across call sites.
 */
export function resolveMempalaceExe(): string {
  const exe = process.platform === "win32" ? "mempalace.exe" : "mempalace";
  const local = join(homedir(), ".local", "bin", exe);
  return existsSync(local) ? local : exe;
}

// ── The one-segment law (every caller-named dir passes through it) ───────────────────────────────

/**
 * Admit a caller-supplied NAME as exactly one path segment, or refuse.
 *
 * A resolver that `join`s a caller's word onto a root hands that caller the whole filesystem: `join`
 * resolves `..`, so a name carrying separators walks out of the root it was meant to stay inside. Two
 * resolvers here feed DELETE verbs — `lares sense purge <name>` and `lares sensorium dissolve <id>`
 * both `rmSync` recursively over what the name resolves to — and one of them reaches through the MCP,
 * so the segment arrives from outside this island entirely.
 *
 * The sensoriums stand inside the hearth, under one root. A traversing
 * segment is the one thing that defeats that boundary: it walks outside the intended root.
 * So the containment holds at the CHOKE-POINT, where a name becomes a path, rather than at each of the
 * dozen verbs downstream — the same mechanism-over-policy shape `confineMirrorWrite` keeps for the
 * projector, and for the same reason (the input is untrusted wherever the policy came from).
 *
 * One segment means what `readdirSync` would hand back: `basename(name) === name`, and never `.` or `..`.
 * It THROWS rather than returning a verdict, because every caller resolves a path it is about to act on
 * and a fail-closed refusal is the only reading that cannot be ignored.
 */
export function assertOneSegment(kind: string, name: string): string {
  if (name.length === 0 || name === "." || name === ".." || basename(name) !== name || name.includes("\\")) {
    throw new Error(`${kind} refuses ${JSON.stringify(name)} — a name resolves to ONE path segment, never a route out of its root`);
  }
  return name;
}

// ── The `memory` sensorium (content · structure · form) ──────────────────────────────────────────

/** The `memory` sensorium dir — `<sensoriums>/memory`. Its manifest declares content/structure/
 *  form/persistence (fiber caps, leaf-dirs below) + bands/coupling (base caps, manifest-only). */
export function memorySensoriumDir(): string {
  return join(larSensoriumsHome(), "memory");
}

/**
 * THE LENS MAP — the memory sensorium's planes, keyed by the name the VERBS take as a parameter.
 *
 * `lares-query` exposes FOUR universal verbs (search · relate · structure · status) and takes the palace
 * as a LENS, so the surface stays four verbs wide however many planes stand. A verb multiplied per plane
 * (`recall_structure`, `recall_form`, …) grows as 4 caps x N palaces and buys nothing the parameter does
 * not already carry.
 *
 * `persistence` rides here as an ordinary lens, which names what it holds: the plane where a ki finding
 * earns standing through witness, and fades without it. Its store answers the same four verbs as any
 * other palace, because a palace IS its composed caps.
 *
 * Feed this straight to {@link makeLaresQuery}; it is the whole binding.
 */
export function memorySensoriumLenses(): Record<string, string> {
  const root = memorySensoriumDir();
  return {
    content: join(root, "content"),
    structure: join(root, "structure"),
    form: join(root, "form"),
    persistence: join(root, "persistence"),
  };
}

/** Resolve a sensorium NAME to its root dir — `<sensoriums>/<name>` (the manifest lives beneath it).
 *  The one place a `lares sense <sensorium> <verb>` address turns a name into a target root; `memory`
 *  resolves to {@link memorySensoriumDir} by construction (same join), so the default stays identical. */
export function sensoriumDir(name: string): string {
  return join(larSensoriumsHome(), assertOneSegment("sensoriumDir", name));
}

/** Every sensorium standing under `<sensoriums>` — the ones a lens may name. */
export function sensoriumNames(): string[] {
  const root = larSensoriumsHome();
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * THE LENS MAP, over EVERY sensorium — keyed `<sensorium>/<plane>`.
 *
 * The palace rides as a PARAMETER, and a sensorium is just a wider palace: three of them stand here
 * (`memory` holds the journey, `memetic-wikitext` holds the canon, `mesh` holds the federation), each with
 * the same plane family. A lens map naming only one of them hands the verbs a door into one room and calls
 * it the house — the canon a caller asks for sits in a sensorium the map never mentioned, and the search
 * answers confidently from the wrong one.
 *
 * So the lens carries BOTH coordinates. The verb surface stays four wide; the address does the widening.
 * A bare plane name (`content`) still resolves against `memory`, which keeps the common read short.
 */
export function sensoriumLenses(): Record<string, string> {
  const root = larSensoriumsHome();
  const out: Record<string, string> = {};

  // DISCOVER the palaces; never declare them. A sensorium `#has` EITHER planes OR child sensoriums —
  // `memetic-wikitext` holds formal/informal, `mesh` holds who/authority/flow, and each child carries its
  // own plane family. A map that enumerated a fixed plane list one level down would address `memory` and
  // silently miss every canon plane two levels below it, then answer a canon query confidently from the
  // journey. So the walk asks the FILETREE what stands, and a dir holding a chroma store IS a palace —
  // the composition on disk names itself.
  const walk = (dir: string, key: string, depth: number): void => {
    if (depth > 4) return;
    if (existsSync(join(dir, "chroma.sqlite3"))) {
      out[key] = dir;
      return;                                   // a palace is a leaf; nothing composes below it
    }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".")) {
        walk(join(dir, e.name), key ? `${key}/${e.name}` : e.name, depth + 1);
      }
    }
  };
  walk(root, "", 0);

  // The short form: a bare plane name reads the `memory` sensorium — the journey, and the common case.
  for (const [k, v] of Object.entries(memorySensoriumLenses())) {
    if (existsSync(join(v, "chroma.sqlite3"))) out[k] = v;
  }
  return out;
}

/** The GUEST mempalace store dir — `MEMPALACE_PALACE_PATH` (override, the relocation lever) else the
 *  upstream-default `~/.mempalace`. NOT a cap of the memory sensorium: the lararium owns its content
 *  plane internally at {@link larContentDir}, so this store stays a comparator, never the `content`
 *  fiber. This store is a GUEST — raised deliberately (`lares mempalace setup`), read
 *  as a comparator, imported FROM (`guest-import.ts`); never bound into at runtime, and never written
 *  by the boot (the S5 comparator ruling). This is the PARENT store (config.json + the `palace/` chroma
 *  dir + entities + locks + the worldline-KG knowledge_graph.sqlite3 that lives INSIDE it). The vendored
 *  mempalace subtree is never touched — the env lever relocates it; palace-path.ts derives the chroma
 *  from the SAME base. */
export function larMempalaceDir(): string {
  const env = process.env["MEMPALACE_PALACE_PATH"]?.trim();
  if (env) return env;
  // The upstream-default parent (`~/.mempalace`) — the SAME source mempalace's palace-path.ts derives
  // its chroma dir from, so the vessel view and the palace view stay byte-identical.
  return mempalaceContentParent();
}

/** The structurepalace store dir (the `structure` fiber cap) — `<memory>/structure`, inside the consolidated
 *  sensorium tree. A 2nd mempalace instance holding the per-turn parse-tree AST keyed by structural hash. */
export function larStructurePalaceDir(): string {
  return join(memorySensoriumDir(), "structure");
}

/** The formpalace store dir (the `form` fiber cap) — `<memory>/form`, inside the consolidated sensorium
 *  tree. A mempalace instance holding the per-turn living-grammar FORM vector, keyed by verbatim_sha
 *  (the cross-graph join to the content drawer). */
export function larFormPalaceDir(): string {
  return join(memorySensoriumDir(), "form");
}

/** The persistencepalace store dir (the `has.persistence` cosheaf cap — the 5th part) — `<memory>/persistence`,
 *  inside the consolidated sensorium tree. A caller-vector mempalace instance holding Testimony atoms +
 *  their witness-logs (standing derived by the keel). The `memory` sensorium composes it in authority mode. */
export function larPersistencePalaceDir(): string {
  return join(memorySensoriumDir(), "persistence");
}

/** The lararium-OWNED content store dir (the `content` fiber cap) — `<memory>/content`, inside the
 *  sensorium tree. The lararium owns its content plane rather than binding it to the guest
 *  `~/.mempalace`; adopting an existing user mempalace history runs as a deliberate import Act, never
 *  a runtime binding. Held by the content-palace (caller-vector, embed upstream / commit here). */
export function larContentDir(): string {
  return join(memorySensoriumDir(), "content");
}

// ── The `mesh` sensorium (WHO · AUTHORITY · FLOW) ─────────────────────────────────────────────────

/** The `mesh` sensorium dir — `<sensoriums>/mesh`. Its manifest declares MINIMAL own caps + three
 *  nested children (who/authority/flow) as dumb `coupling.children[]` edges; the filetree IS the
 *  composition (sensorium.ts). The cross-Lararium federation feed/carriage lives elsewhere in the mesh
 *  domain — this is directory + structure only. */
export function meshSensoriumDir(): string {
  return join(larSensoriumsHome(), "mesh");
}

/** The WHO child-sensorium dir — `<mesh>/who`. Identity/presence: content (presence-embeddings) +
 *  structure (the presence-graph) fill here; the parallel populates the caps, the dir stays thin. */
export function meshWhoDir(): string {
  return join(meshSensoriumDir(), "who");
}

/** The AUTHORITY child-sensorium dir — `<mesh>/authority`. Caps/keyhive: the cap-grant store fills
 *  here; the parallel declares the content cap + engine, the dir stays thin. */
export function meshAuthorityDir(): string {
  return join(meshSensoriumDir(), "authority");
}

/** The FLOW child-sensorium dir — `<mesh>/flow`. Traffic/coupling, the coupling-lobe: its manifest
 *  RESERVES `coupling.children[]` for the node-stream edges the parallel's transfer-entropy read
 *  consults (effective-connectivity). We reserve the slot; the read lives elsewhere. */
export function meshFlowDir(): string {
  return join(meshSensoriumDir(), "flow");
}

// ── The `memetic-wikitext` sensorium (FORMAL ⋈ INFORMAL peers, neither top) ───────────────────────

/** The `memetic-wikitext` sensorium dir — `<sensoriums>/memetic-wikitext`. A nameless nested
 *  entity that `#has` NO fiber cap and TWO PEER child-sensoria (formal ⋈ informal) as dumb
 *  `coupling.children[]` edges, NEITHER on top; the coupling plane reads the directed formal↔informal
 *  flow (memetic-wikitext-sensorium.ts). The filetree IS the composition (sensorium.ts). */
export function memeticWikitextSensoriumDir(): string {
  return join(larSensoriumsHome(), "memetic-wikitext");
}

/** The FORMAL peer-sensorium dir — `<memetic-wikitext>/formal`. The memes-on-disk corpus (grammar/
 *  liturgy): a thin content-cap sensorium the parallel fills; the dir nests below the top so the tree
 *  relocates as one and teardown reaps it. */
export function memeticWikitextFormalDir(): string {
  return join(memeticWikitextSensoriumDir(), "formal");
}

/** The INFORMAL peer-sensorium dir — `<memetic-wikitext>/informal`. The chat-sessions corpus (pidgin):
 *  a thin content-cap sensorium the parallel fills; nested below the top with the formal peer. */
export function memeticWikitextInformalDir(): string {
  return join(memeticWikitextSensoriumDir(), "informal");
}

// ── The ephemeral sensorium multipalace (scratch sensoriums) ─────────────────────────────────────────

/** The scratch-sensorium root — `<cache>/scratch/sensoriums`. Each `lares sensorium` run mints a
 *  dissolvable child instance below it (ephemeral, sweepable; palace-teardown reaps every child). */
export function scratchSensoriumDir(): string {
  return join(larCacheHome(), "scratch", "sensoriums");
}

/** The scratch instance dir for one ephemeral sensorium, by its id, under {@link scratchSensoriumDir}.
 *  `dissolve` rmSyncs whatever this returns, so the id passes the one-segment law first. */
export function scratchSensoriumInstanceDir(id: string): string {
  return join(scratchSensoriumDir(), assertOneSegment("scratchSensoriumInstanceDir", id));
}

// ── The vessel substrate (Automerge Repo — NOT a sensorium) ──────────────────────────────────────

/** Storage dir — the Automerge Repo, vessel key, and UDS socket, at `<root>/hearth/vessel`.
 *  Runtime store, not a sensorium (it carries no sensory fiber caps). */
export function larDataDir(): string {
  return join(larHearthHome(), "vessel");
}

/** Vessel identity dir — the sovereign keypair + the veiled-Handle anchors, at
 *  `<root>/hearth/identity`. It sits beside (never inside) the runtime `<root>/hearth/vessel` store, so
 *  storage and sovereignty remain separate filesystem responsibilities. The ONE identity resolver —
 *  node-vessel-identity resolves any prior location onto it. */
export function larIdentityDir(): string {
  return join(larHearthHome(), "identity");
}

/**
 * The Nexus SEAL home — the kahu quorum's seats + their epoch lineage, at `<root>/hearth/nexus`.
 *
 * WHY IT SITS HERE AND NOT IN THE BAGS TREE. The seal reads as a FILE rather than a bag: an operator
 * backs it up, hands it to a peer, and reads it with their own eyes. A bag would give it fleet-sync it
 * does not want and a doc-id it does not need. But siting a file in the corpus tree made it inherit that
 * tree's home — which on a development install sits INSIDE the repository, so a founding seal could land
 * in a git history nobody meant to write it into.
 *
 * So it homes beside `identity`, per-operator, under the hearth: outside the corpus, outside the repo, and
 * beside the runtime vessel store; the seal and sovereign root stay separate from vessel data. A clone of the
 * corpus therefore carries NO Nexus — which reads correct,
 * because a Nexus belongs to the operators who founded it, never to whoever copied the code.
 */
export function larSealHome(): string {
  return join(larHearthHome(), "nexus");
}

// ── Checkpoints and staging (inside the hearth) ───────────────────────────────────────────────────

/** Disk-projection checkpoint (the synced-tree watermark) — `<checkpoints>/projection`. */
export function larProjectionCheckpointDir(): string {
  return join(larCheckpointsHome(), "projection");
}

/** Harvest checkpoint (lar_hv idempotency state) — `<checkpoints>/harvest`. */
export function larHarvestCheckpointDir(): string {
  return join(larCheckpointsHome(), "harvest");
}

/** Harvest staging (normalized transcript copies) — `<staging>/harvest`. */
export function larHarvestStagingDir(): string {
  return join(larStagingHome(), "harvest");
}

/**
 * The social bootstrap — `<vessel>/social-bootstrap.json`. The ONE resolver; every reader and the
 * writer route through it.
 *
 * IT HOLDS AN ADDRESS BOOK: the automerge URLs of this vessel's social docs (the identities · circles ·
 * sessions · daemon · persona docs) plus their sentinel ids. No content, no keys — only WHERE those docs
 * live. So it names one vessel, and it sits beside the store that holds what it names.
 *
 * ── WHY IT LEFT genesis/ ────────────────────────────────────────────────────────────────────────
 * It lived under the CORPUS root, which answers //which corpus//, while every fact it carries answers
 * //which vessel//. Everything else per-vessel had already moved home — identity, the Nexus seal, the
 * library, the store holding these very docs — and the address book alone stayed behind, pointing from
 * the corpus into the home. Three costs came with that address:
 *   · a per-vessel artifact sat inside a shared, copyable directory, so anything copying genesis/
 *     wholesale handed a fresh vessel another vessel's identity — which a rehearsal proved by failing;
 *   · the bootstrap lived in the corpus tree, so copied seed material carried another vessel's address book;
 *   · a line in .gitignore stood as the only guard, where a placement should have been.
 *
 * ── WHY <vessel> RATHER THAN <checkpoints> ───────────────────────────────────────────────────────
 * The address book belongs with the vessel store because it names the docs in that store. A fresh store
 * gets a freshly founded address book beside its documents.
 */
export function larBootstrapPath(): string {
  return join(larDataDir(), "social-bootstrap.json");
}

// NOTE: genesis/ stays CORPUS-relative (larRoot / the repo) and holds TRACKED SEED ALONE — the baked
// bundle (seed.json, cas/), identical for every vessel and safe to copy.
