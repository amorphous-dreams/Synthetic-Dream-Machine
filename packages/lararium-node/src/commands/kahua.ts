/**
 * kahua — the store holder's rows for a face's kahua stage (`lares kahua mint|propose|stage|staged|lift|withdraw|carry|list|get`).
 *
 * Each row names its face per invocation (`face`), proves it through the intent door's face load (anchor, verified KEL,
 * the signed log naming the intents plane), and runs `kahuaDoor` over that face. The lōkahi cap reads off the standing
 * vessel's daemon island (`kahua-cap`); a direct act stands no island, so its lift and withdraw refuse
 * `lokahi-cap-unread`. The operator's grant reads out of sealed custody (the face's persona root), and the door checks it
 * against the lineage's current roster.
 *
 * A lift names a STAGED row of the face's local canon `bags/daemon-<F>` by title and digest (`kahua-door.ts`); `stage`
 * writes one row there (local, unsigned) and `staged` reads one back for the preview the person reads before a lift.
 * The local canon opens through the standing vessel (`faceCanon`); a direct act holds none, and its lift refuses
 * `kahua-lift-unstaged`.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { wardRootSigner } from "../ward-signer.js";
import { makeCatalogAccessor } from "@lararium/tw5";
import type { WardCredential } from "../ward-credential.js";
import { randomBytes } from "node:crypto";
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import {
  faceRecordsOf, faceRelationOf, storedLarRecord, tiddlerText, ownEntry, CONTROL_HOME_ID, type KahuaSource, type LarDoc,
} from "@lararium/mesh";
import { loadIntentFace, IntentRefused } from "./intent.js";
import { kahuaDoor, KahuaRefused, type KahuaDoorPorts } from "../kahua-door.js";

export { KahuaRefused };

/**
 * A face's stage list beside its relation. A fresh face holds no stage yet (its log pins none): it answers an empty stage
 * named `none`, never a refusal, so a reader that maps faces to folders (the founding rite's seed) reads on. Every other
 * refusal stands.
 */
export async function listStage(door: { list(): Promise<unknown[]> }, relation: string | null): Promise<{ items: unknown[]; relation: string | null; stage?: "none" }> {
  try { return { items: await door.list(), relation }; }
  catch (e) {
    if (e instanceof KahuaRefused && /^kahua-unpinned\b/.test(e.message)) return { items: [], relation, stage: "none" };
    throw e;
  }
}

export type KahuaAction = "mint" | "propose" | "stage" | "staged" | "lift" | "withdraw" | "carry" | "list" | "get";
export type KahuaCapPort = (presenter: string) => Promise<{ readonly held: boolean; readonly reason?: string }>;

export interface KahuaCommandOptions {
  /** The face's ward route for this act (seat-harness#/the-ward): the root signs only under a fresh ward unlock. */
  readonly ward?: WardCredential;
  readonly repo: Repo;
  readonly catalogUrl?: string;
  readonly face?: number;
  readonly action: KahuaAction;
  readonly title?: string;
  /** A stage's body and fields; a lift carries the staged row's own and takes neither from the hand. */
  readonly text?: string;
  readonly fields?: Readonly<Record<string, string>>;
  /** The staged row's content digest a lift names (`kahuaRowDigest`). */
  readonly digest?: string;
  readonly taint?: readonly string[];
  readonly sources?: readonly KahuaSource[];
  readonly parent?: string | null;
  readonly proposal?: string;
  readonly target?: string;
  /** The earlier revisions a carry names; `all` carries each title's head as the history reads it. */
  readonly cids?: readonly string[];
  readonly all?: boolean;
  readonly proposals?: unknown;
  readonly session?: string;
  readonly history?: boolean;
  /** The standing vessel's island read of the cap; absent on a direct act. */
  readonly cap?: KahuaCapPort;
  /** The face's local canon `bags/daemon-<F>` by relation, as the standing vessel opens it; absent on a direct act. */
  readonly faceCanon?: (relation: string) => Promise<DocHandle<LarDoc> | null>;
}

/**
 * The face's local canon `bags/daemon-<F>` through a vessel's control document: the row `daemon-canon/<F>` names its
 * document (`standFaceDaemonCanon`), and the Repo opens it (the sealed rest unseals it while the face stands lit). Null
 * where the control document names none.
 */
export function faceCanonThroughControl(repo: Repo, control: () => Promise<DocHandle<LarDoc>>): (relation: string) => Promise<DocHandle<LarDoc> | null> {
  return async (relation) => {
    const named = tiddlerText(ownEntry((await control()).doc()?.tiddlers, `${CONTROL_HOME_ID}/daemon-canon/${encodeURIComponent(relation)}`));
    if (!named || !named.startsWith("automerge:")) return null;
    return repo.find<LarDoc>(named as AutomergeUrl);
  };
}

export async function runKahuaCommand(opts: KahuaCommandOptions): Promise<Record<string, unknown>> {
  let loaded: Awaited<ReturnType<typeof loadIntentFace>>;
  try { loaded = await loadIntentFace(opts.repo, opts.catalogUrl, { index: opts.face }); }
  catch (e) { if (e instanceof IntentRefused) throw new KahuaRefused(e.message); throw e; }
  const { group, index, face, personaPlane, plane, verbs, signer } = loaded;
  if (!personaPlane) throw new KahuaRefused("face-log-unreadable: the catalog names no persona plane for the face");
  const catalog = await makeCatalogAccessor(opts.repo, opts.catalogUrl!).handle();
  const session = opts.session ?? `cli:${randomBytes(8).toString("hex")}`;
  const ports: KahuaDoorPorts = {
    repo: opts.repo, group, verbs,
    projection: () => face.project(faceRecordsOf([personaPlane.doc()], group), group),
    epoch: () => face.lineage[face.lineage.length - 1]!.epoch,
    currentSigner: (key) => face.currentSigner(key),
    signedAt: (epoch, key) => face.signsAt(epoch, key),
    atom: signer, intents: plane as DocHandle<LarDoc>,
    // The root signs ONE act here, opening fresh under the act's ward route and zeroing after it (seat-harness#/the-ward).
    rootSigner: () => wardRootSigner(index, opts.ward, "a kahua hand act"),
    cap: opts.cap ?? null,
    register: (bagId, url) => catalog.change((d) => { d.tiddlers[bagId] = storedLarRecord(bagId, { text: url, kind: "oracle" }, "kahua-pin"); }),
    session: () => session,
    ...(opts.faceCanon ? { faceCanon: opts.faceCanon } : {}),
  };
  const door = kahuaDoor(ports);
  const need = (v: string | undefined, what: string): string => { if (!v) throw new KahuaRefused(`${opts.action}: name ${what}`); return v; };
  switch (opts.action) {
    case "mint": return { ...(await door.mint()) };
    case "propose": {
      const proposals = typeof opts.proposals === "string" ? JSON.parse(opts.proposals) as unknown : opts.proposals;
      if (!Array.isArray(proposals)) throw new KahuaRefused("kahua-proposal-proposals: name a JSON list of {title, revision, text|digest, taint}");
      return { ...(await door.propose({ proposals: proposals as never, ...(opts.session ? { session: opts.session } : {}) })) };
    }
    case "stage": {
      if (typeof opts.text !== "string") throw new KahuaRefused("kahua-stage-text: name the row's body");
      return { ...(await door.stage({ title: need(opts.title, "a title"), text: opts.text, ...(opts.fields ? { fields: opts.fields } : {}) })) };
    }
    case "staged": {
      // THE PREVIEW: the staged row beside the item's standing heads, so the person reads what a lift would carry.
      const title = need(opts.title, "a title");
      const row = await door.staged(title);
      const item = await door.get(title).catch(() => null);
      const heads = (item?.heads ?? []).map((h) => ({ cid: h.cid, carries: h.text === row.text && JSON.stringify(Object.entries(h.fields).sort()) === JSON.stringify(Object.entries(row.fields).sort()) }));
      return { title, digest: row.digest, relation: row.relation, text: row.text, fields: row.fields, heads };
    }
    case "lift": {
      if (opts.taint === undefined) throw new KahuaRefused("kahua-act-refused: taint: name --taint (`none` when every input came from inside the face)");
      return { ...(await door.lift({
        title: need(opts.title, "a title"), digest: need(opts.digest, "the staged row's digest"), taint: opts.taint,
        ...(opts.sources ? { sources: opts.sources } : {}),
        ...(opts.parent !== undefined ? { parent: opts.parent } : {}), ...(opts.proposal ? { proposal: opts.proposal } : {}),
      })) };
    }
    case "withdraw": return { ...(await door.withdraw(need(opts.target, "a revision cid"))) };
    case "carry": {
      if (!opts.all && (opts.cids ?? []).length === 0) throw new KahuaRefused("carry: name the revision cids that keep standing, or `all`");
      return { ...(await door.carry(opts.all ? { all: true } : { cids: opts.cids ?? [] })) };
    }
    // The list names the face's relation F beside its items: the folder name its private projections carry
    // (`daemon-<F>`, `kahua-<F>`), so a reader that maps folders to faces (`lares export`) reads it off the verified log.
    // A FRESH FACE HOLDS NO STAGE YET: a face whose log pins no stage (no relation yet, or no stage pin) answers an empty
    // stage named `none`, never a refusal, so a reader that maps faces (the founding rite's seed) reads on.
    case "list": return { ...(await listStage(door, faceRelationOf(ports.projection()))) };
    case "get": {
      const title = need(opts.title, "a title");
      return { item: await door.get(title), ...(opts.history ? { history: await door.history(title) } : {}) };
    }
  }
}
