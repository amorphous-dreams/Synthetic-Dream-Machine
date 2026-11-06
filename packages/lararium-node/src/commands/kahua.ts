/**
 * kahua — the store holder's rows for a face's kahua stage (`lares kahua mint|propose|lift|withdraw|carry|list|get`).
 *
 * Each row names its face per invocation (`face`), proves it through the intent door's face load (anchor, verified KEL,
 * the signed log naming the intents plane), and runs `kahuaDoor` over that face. The lōkahi cap reads off the standing
 * vessel's daemon island (`kahua-cap`); a direct act stands no island, so its lift and withdraw refuse
 * `lokahi-cap-unread`. The operator's grant reads out of sealed custody (the face's persona root), and the door checks it
 * against the lineage's current roster.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { wardRootSigner } from "../ward-signer.js";
import type { WardCredential } from "../ward-credential.js";
import { randomBytes } from "node:crypto";
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import {
  faceRecordsOf, storedLarRecord, type KahuaSource, type LarDoc,
} from "@lararium/mesh";
import { loadIntentFace, IntentRefused } from "./intent.js";
import { kahuaDoor, KahuaRefused, type KahuaDoorPorts } from "../kahua-door.js";

export { KahuaRefused };
export type KahuaAction = "mint" | "propose" | "lift" | "withdraw" | "carry" | "list" | "get";
export type KahuaCapPort = (presenter: string) => Promise<{ readonly held: boolean; readonly reason?: string }>;

export interface KahuaCommandOptions {
  /** The face's ward route for this act (seat-harness#/the-ward): the root signs only under a fresh ward unlock. */
  readonly ward?: WardCredential;
  readonly repo: Repo;
  readonly catalogUrl?: string;
  readonly face?: number;
  readonly action: KahuaAction;
  readonly title?: string;
  readonly text?: string;
  readonly fields?: Readonly<Record<string, string>>;
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
}

export async function runKahuaCommand(opts: KahuaCommandOptions): Promise<Record<string, unknown>> {
  let loaded: Awaited<ReturnType<typeof loadIntentFace>>;
  try { loaded = await loadIntentFace(opts.repo, opts.catalogUrl, { index: opts.face }); }
  catch (e) { if (e instanceof IntentRefused) throw new KahuaRefused(e.message); throw e; }
  const { group, index, face, personaPlane, plane, verbs, signer } = loaded;
  if (!personaPlane) throw new KahuaRefused("face-log-unreadable: the catalog names no persona plane for the face");
  const catalog = await opts.repo.find<LarDoc>(opts.catalogUrl as never);
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
    case "lift": {
      if (opts.taint === undefined) throw new KahuaRefused("kahua-act-refused: taint: name --taint (`none` when every input came from inside the face)");
      return { ...(await door.lift({
        title: need(opts.title, "a title"), text: opts.text ?? "", taint: opts.taint,
        ...(opts.fields ? { fields: opts.fields } : {}), ...(opts.sources ? { sources: opts.sources } : {}),
        ...(opts.parent !== undefined ? { parent: opts.parent } : {}), ...(opts.proposal ? { proposal: opts.proposal } : {}),
      })) };
    }
    case "withdraw": return { ...(await door.withdraw(need(opts.target, "a revision cid"))) };
    case "carry": {
      if (!opts.all && (opts.cids ?? []).length === 0) throw new KahuaRefused("carry: name the revision cids that keep standing, or `all`");
      return { ...(await door.carry(opts.all ? { all: true } : { cids: opts.cids ?? [] })) };
    }
    case "list": return { items: await door.list() };
    case "get": {
      const title = need(opts.title, "a title");
      return { item: await door.get(title), ...(opts.history ? { history: await door.history(title) } : {}) };
    }
  }
}
