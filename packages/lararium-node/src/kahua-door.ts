/**
 * kahua-door — the node's one door onto a face's kahua stage (`lar:///ha.ka.ba/bags/kahua`).
 *
 * The door decides nothing the reader would not: every act it signs passes `readKahuaAct` under the same grant before it
 * lands, and every read folds through `readKahuaStage`. What the door adds is the order of the hands:
 *
 *   mint      — once per face: the verified projection already naming a stage returns that url and signs nothing (a second
 *               mint, a second device); otherwise the operator's grant stands the doc at the face's derived address
 *               (`kahuaStageDocUrl`) and pins it by a root-signed `plane` act.
 *   propose   — the device's atom signs ONE batch on the face's intents plane (any seat may; it grants nothing).
 *   lift      — the lōkahi CAP first (Keyhive: does this device's face hold the stage), then the operator's GRANT (a current
 *               root key in hand), each refused by its own name; an AI seat's hand (the atom) never stands in for the grant.
 *   withdraw  — the same two gates, naming a held revision.
 *   carry     — the same two gates, then ONE root-signed act at the current epoch naming the earlier revisions that keep
 *               standing after a rotation (`--all`: each title's head as the history reads it); a batch re-lift.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { randomBytes } from "node:crypto";
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import {
  KAHUA_BAG, KAHUA_PLANE, buildKahuaProposal, buildOutcome, intentEntryCid, intentEntryRecordsOfGroup, intentId,
  KAHUA_CARRY_MAX, kahuaActRecords, kahuaBodyDigest, kahuaCarryCandidates, kahuaPlaneUrl, kahuaStageDocUrl, materializeSharedLarDoc, readIntentEntry, readKahuaAct, readKahuaProposal,
  readKahuaStage, signKahuaCarry, signKahuaLift, signKahuaWithdraw, signPersonaAct, writeIntentEntry, writeKahuaAct, writePersonaAct,
  type IntentVerbRegistry, type KahuaItem, type KahuaRevision, type KahuaSource, type LarDoc, type PersonaProjection,
} from "@lararium/mesh";

export class KahuaRefused extends Error { override name = "KahuaRefused"; }

type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };

export interface KahuaDoorPorts {
  readonly repo: Repo;
  readonly group: string;
  readonly verbs: IntentVerbRegistry;
  /** The face's VERIFIED `@persona` projection, read fresh at each call. */
  readonly projection: () => PersonaProjection;
  /** The lineage's current root epoch. */
  readonly epoch: () => number;
  /** Whether a key stands in the face's CURRENT root roster: the operator's grant. */
  readonly currentSigner: (key: string) => boolean;
  /** Whether a key sat in the roster of an earlier epoch: seats an earlier act in history, never lets it stand. */
  readonly signedAt?: (epoch: number, key: string) => boolean;
  /** This device's atom: it signs proposals and outcomes, never an act that folds on the stage. */
  readonly atom: Signer;
  readonly persona: DocHandle<LarDoc>;
  readonly intents: DocHandle<LarDoc>;
  /** The operator's grant in hand: the face's root signer out of sealed custody; throws where custody holds none. */
  readonly rootSigner: () => Promise<Signer>;
  /** The lōkahi cap as the daemon island's Keyhive reads it for a presenter; null where no island stands to read it. */
  readonly cap: ((presenter: string) => Promise<{ readonly held: boolean; readonly reason?: string }>) | null;
  /** Register the stage in the vessel's catalog under its bag id (the recipe layer resolves it there). */
  readonly register: (bagId: string, url: string) => void;
  /** The session a lift by hand names in its origin. */
  readonly session: () => string;
}

export interface KahuaLiftInput {
  readonly title: string; readonly text: string; readonly fields?: Readonly<Record<string, string>>;
  readonly taint: readonly string[]; readonly sources?: readonly KahuaSource[];
  /** The revision this lift supersedes; absent: the standing head (none for a first lift). Naming a non-head makes a sibling. */
  readonly parent?: string | null;
  /** The proposal intent id this lift answers. */
  readonly proposal?: string;
}
export interface KahuaProposeInput {
  readonly proposals: readonly { readonly title: string; readonly revision: string; readonly text?: string; readonly digest?: string; readonly taint: readonly string[] }[];
  readonly session?: string;
}

export function kahuaDoor(ports: KahuaDoorPorts) {
  const { group } = ports;
  const projection = (): PersonaProjection => {
    const p = ports.projection();
    if (!p.founded || p.fork) throw new KahuaRefused("face-log-unreadable: the face's signed log does not fold");
    return p;
  };
  const stageUrl = (): string => {
    const url = kahuaPlaneUrl(projection(), group);
    if (!url) throw new KahuaRefused("kahua-unpinned: the face pins no stage; run `lares kahua mint` on the root's hearth");
    return url;
  };
  const stage = async (): Promise<DocHandle<LarDoc>> => ports.repo.find<LarDoc>(stageUrl() as never);
  const foldFace = () => ({ group, grant: ports.currentSigner, ...(ports.signedAt ? { signedAt: ports.signedAt } : {}) });
  const records = async () => kahuaActRecords((await stage()).doc(), group);
  const reading = async () => readKahuaStage(await records(), foldFace());
  const grant = async (): Promise<Signer> => {
    let signer: Signer;
    try { signer = await ports.rootSigner(); }
    catch (e) { throw new KahuaRefused(`operator-grant-absent: the operator's grant opens here no root of the face (${e instanceof Error ? e.message : String(e)})`); }
    if (!ports.currentSigner(signer.key)) throw new KahuaRefused("operator-grant-absent: the hand holds no current root of the face; an AI seat proposes with `lares kahua propose`");
    return signer;
  };
  const cap = async (): Promise<void> => {
    if (!ports.cap) throw new KahuaRefused("lokahi-cap-unread: no daemon island stands to read the face's cap on the stage; lift on a standing vessel");
    const read = await ports.cap(ports.atom.key);
    if (!read.held) throw new KahuaRefused(`lokahi-cap-absent: this device's face holds no cap on ${KAHUA_BAG}${read.reason ? ` (${read.reason})` : ""}`);
  };
  /** Sign-checked landing: the act passes the reader before it touches the doc. The doc carries acts alone; every reader folds them. */
  const land = async (act: Awaited<ReturnType<typeof signKahuaLift>>): Promise<string> => {
    const read = readKahuaAct(act, { group, grant: ports.currentSigner });
    if (!read.ok) throw new KahuaRefused(`kahua-act-refused: ${read.refusal}`);
    const handle = await stage();
    handle.change((d) => writeKahuaAct(d, act));
    return read.cid;
  };
  const proposalOf = (id: string) => {
    const devices = new Set(projection().devices);
    for (const raw of intentEntryRecordsOfGroup(ports.intents.doc(), group)) {
      const read = readIntentEntry(raw, { group, authorize: (signer) => devices.has(signer) });
      if (!read.ok || read.entry.body.entry !== "intent") continue;
      const body = read.entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string };
      if (intentId(body) !== id) continue;
      const batch = readKahuaProposal(read.entry);
      if (batch) return { batch, issuer: body.issuer, cid: read.cid };
    }
    throw new KahuaRefused(`proposal-unknown: no verified kahua proposal ${id} stands on the face's intents plane`);
  };

  return {
    async mint(): Promise<{ readonly url: string; readonly minted: boolean }> {
      const held = kahuaPlaneUrl(projection(), group);
      if (held) { ports.register(KAHUA_BAG, held); return { url: held, minted: false }; }
      const root = await grant();
      // THE ADDRESS DERIVES FROM THE FACE: two hearths that mint at once stand the same doc and, from one head, sign the
      // same pin byte for byte (ed25519 signs deterministically), so the merged log reads one act and never a fork.
      const doc = await materializeSharedLarDoc(ports.repo, kahuaStageDocUrl(group), "kahua:stage");
      const act = await signPersonaAct(projection().head, { group, act: "plane", epoch: ports.epoch(), fields: { plane: KAHUA_PLANE, url: doc.url } }, root);
      ports.persona.change((d) => writePersonaAct(d, act));
      if (kahuaPlaneUrl(projection(), group) !== doc.url) throw new KahuaRefused("kahua-pin-unverified: the plane act did not fold into the face's log");
      ports.register(KAHUA_BAG, doc.url);
      await ports.repo.flush();
      return { url: doc.url, minted: true };
    },

    async propose(input: KahuaProposeInput): Promise<{ readonly id: string; readonly cid: string }> {
      const proposals = input.proposals.map((p) => {
        const digest = p.digest ?? (typeof p.text === "string" ? kahuaBodyDigest(p.text) : undefined);
        if (!digest) throw new KahuaRefused("kahua-proposal-digest: name the body or its digest");
        return { title: p.title, revision: p.revision, digest, taint: p.taint };
      });
      let entry;
      try {
        entry = await buildKahuaProposal({ group, signer: ports.atom, session: input.session ?? ports.session(), nonce: randomBytes(16).toString("hex"), proposals, verbs: ports.verbs });
      } catch (e) { throw new KahuaRefused(e instanceof Error ? e.message : String(e)); }
      ports.intents.change((d) => writeIntentEntry(d, entry));
      await ports.repo.flush();
      return { id: intentId(entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string }), cid: intentEntryCid(entry) };
    },

    async lift(input: KahuaLiftInput): Promise<{ readonly cid: string; readonly parent: string | null }> {
      stageUrl();
      if (!Array.isArray(input.taint)) throw new KahuaRefused("kahua-act-refused: taint: name the lift's taint list (empty when every input came from inside the face)");
      let origin = { seat: "", device: ports.atom.key, session: ports.session() };
      let taint = [...input.taint];
      let sources = input.sources ? [...input.sources] : [];
      let proposalCause: { id: string; cid: string } | null = null;
      if (input.proposal) {
        const found = proposalOf(input.proposal);
        const row = found.batch.proposals.find((p) => p.title === input.title);
        if (!row) throw new KahuaRefused(`proposal-title: proposal ${input.proposal} names no item "${input.title}"`);
        if (row.digest !== kahuaBodyDigest(input.text)) throw new KahuaRefused("proposal-digest: the body differs from the one proposed");
        origin = { seat: found.issuer, device: found.issuer, session: found.batch.session };
        taint = [...new Set([...row.taint, ...taint])];
        if (sources.length === 0) sources = [{ title: row.title, revision: row.revision }];
        proposalCause = { id: input.proposal, cid: found.cid };
      }
      if (sources.length === 0) throw new KahuaRefused("kahua-act-refused: sources: name the daemon source(s) the item distils");
      await cap();
      const root = await grant();
      if (!input.proposal) origin = { ...origin, seat: root.key };
      let parent: string | null;
      if (input.parent !== undefined) parent = input.parent;
      else {
        const item = (await reading()).get(input.title);
        if (item?.status === "siblings") throw new KahuaRefused(`siblings: "${input.title}" stands as ${item.heads.length} siblings; name --parent <cid> (${item.heads.map((h) => h.cid).join(", ")})`);
        parent = item?.heads[0]?.cid ?? null;
      }
      let act;
      try {
        act = await signKahuaLift({ group, epoch: ports.epoch(), title: input.title, text: input.text, fields: { ...(input.fields ?? {}) }, parent, origin, taint, sources,
          ...(proposalCause ? { proposal: proposalCause.id } : {}) }, root);
      } catch (e) { throw new KahuaRefused(`kahua-act-refused: ${e instanceof Error ? e.message.replace(/^kahua-act: /, "") : String(e)}`); }
      const cid = await land(act);
      if (proposalCause) {
        const outcome = await buildOutcome({ group, signer: ports.atom, cause: proposalCause.id, result: { lifted: cid, title: input.title } });
        ports.intents.change((d) => writeIntentEntry(d, outcome));
      }
      await ports.repo.flush();
      return { cid, parent };
    },

    async withdraw(target: string): Promise<{ readonly cid: string }> {
      stageUrl();
      await cap();
      const root = await grant();
      if (!/^[0-9a-f]{64}$/.test(target) || !(await reading()).revision(target)) throw new KahuaRefused(`withdraw-unknown: no verified revision ${target} stands on the stage`);
      const cid = await land(await signKahuaWithdraw({ group, epoch: ports.epoch(), target }, root));
      await ports.repo.flush();
      return { cid };
    },

    async carry(input: { readonly cids?: readonly string[]; readonly all?: boolean }): Promise<{ readonly cids: readonly string[]; readonly carried: readonly string[] }> {
      stageUrl();
      await cap();
      const root = await grant();
      const read = await reading();
      let carried: string[];
      if (input.all) carried = kahuaCarryCandidates(await records(), foldFace());
      else {
        carried = [...new Set(input.cids ?? [])];
        for (const cid of carried) if (!/^[0-9a-f]{64}$/.test(cid) || !read.revision(cid)) throw new KahuaRefused(`carry-unknown: no verified revision ${cid} stands in the stage's history`);
        carried = carried.filter((cid) => read.revision(cid)?.standing !== true).sort();
      }
      if (carried.length === 0) throw new KahuaRefused("carry-nothing: every verified revision named already stands under the current root");
      const cids: string[] = [];
      for (let i = 0; i < carried.length; i += KAHUA_CARRY_MAX) {
        cids.push(await land(await signKahuaCarry({ group, epoch: ports.epoch(), carries: carried.slice(i, i + KAHUA_CARRY_MAX) }, root)));
      }
      await ports.repo.flush();
      return { cids, carried };
    },

    async list(): Promise<KahuaItem[]> { return (await reading()).list(); },
    async get(title: string): Promise<KahuaItem | null> { return (await reading()).get(title); },
    async history(title: string): Promise<KahuaRevision[]> { return (await reading()).history(title); },
  };
}
