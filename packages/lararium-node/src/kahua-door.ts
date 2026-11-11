/**
 * kahua-door — the node's one door onto a face's kahua stage (`lar:///ha.ka.ba/bags/kahua`).
 *
 * The door decides nothing the reader would not: every act it signs passes `readKahuaAct` under the same grant before it
 * lands, and every read folds through `readKahuaStage`. What the door adds is the order of the hands:
 *
 *   mint      — adoption: the face's FOUNDING ACT signs the stage's pin (`landFaceGenesis` names `kahuaStageDocUrl(group)`
 *               beside the intents plane under the founding hand), by whichever device founds the face, node or browser,
 *               so the door answers the pin the verified projection names and signs nothing. A face whose log names no
 *               pin refuses `kahua-mint-outside-founding` on every device and opens no root: the pin appends to the face's
 *               linear `@persona` chain, so a pin signed outside the founding act, on two replicas standing even one act
 *               apart, would sign two acts at one seq and fork the whole log. The founding act stands at seq 0 alone.
 *   propose   — the device's atom signs ONE batch on the face's intents plane (any seat may; it grants nothing).
 *   stage     — one row into the face's LOCAL canon `bags/daemon-<F>` (`stageKahuaRow`): local and unsigned, the first of
 *               memory's two crossings; any seat may stage, and staging lifts nothing.
 *   lift      — names a STAGED row by title and content digest (`kahuaRowDigest`): the door reads the row back from
 *               `daemon-<F>`, refuses `kahua-lift-unstaged` where none stands and `kahua-lift-digest-moved` where it moved,
 *               and lifts the row's own body and fields, never a body from the hand; the digest rides the signed act's
 *               sources. A lift of a row the head already carries lands nothing and opens no root. Then the lōkahi CAP
 *               (Keyhive: does this device's face hold the stage), then the operator's GRANT (a current root key in hand),
 *               each refused by its own name; an AI seat's hand (the atom) never stands in for the grant.
 *   withdraw  — the same two gates, naming a held revision.
 *   carry     — the same two gates, then ONE root-signed act at the current epoch naming the earlier revisions that keep
 *               standing after a rotation (`--all`: each title's head as the history reads it); a batch re-lift.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { randomBytes } from "node:crypto";
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import {
  KAHUA_BAG, buildKahuaProposal, buildOutcome, intentEntryCid, intentId, faceRelationOf, readKahuaStagedRow, stageKahuaRow, kahuaStagedSource,
  KAHUA_CARRY_MAX, kahuaActRecords, kahuaBodyDigest, kahuaCarryCandidates, kahuaPlaneUrl, findKahuaProposal, readKahuaAct,
  readKahuaStage, signKahuaCarry, signKahuaLift, signKahuaWithdraw, writeIntentEntry, writeKahuaAct,
  type IntentVerbRegistry, type KahuaItem, type KahuaStagedRow, type KahuaRevision, type KahuaSource, type LarDoc, type PersonaProjection,
} from "@lararium/mesh";

export class KahuaRefused extends Error { override name = "KahuaRefused"; }

const sortedFields = (fields: Readonly<Record<string, string>>): [string, string][] =>
  Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

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
  readonly intents: DocHandle<LarDoc>;
  /** The operator's grant in hand: the face's root signer out of sealed custody; throws where custody holds none. */
  readonly rootSigner: () => Promise<Signer>;
  /** The lōkahi cap as the daemon island's Keyhive reads it for a presenter; null where no island stands to read it. */
  readonly cap: ((presenter: string) => Promise<{ readonly held: boolean; readonly reason?: string }>) | null;
  /** Register the stage in the vessel's catalog under its bag id (the recipe layer resolves it there). */
  readonly register: (bagId: string, url: string) => void;
  /** The session a lift by hand names in its origin. */
  readonly session: () => string;
  /**
   * The face's LOCAL canon `bags/daemon-<F>` by the face's relation: the document a lift reads its staged row from and a
   * stage writes into. Absent (a direct act, no vessel standing to open the sealed canon) or answering null: a lift refuses
   * `kahua-lift-unstaged`, never a body from the hand.
   */
  readonly faceCanon?: (relation: string) => Promise<DocHandle<LarDoc> | null>;
}

export interface KahuaLiftInput {
  /** The staged row's title in `bags/daemon-<F>`: the item's title on the stage. */
  readonly title: string;
  /** The staged row's content digest (`kahuaRowDigest`) as the person read it in the preview. */
  readonly digest: string;
  readonly taint: readonly string[]; readonly sources?: readonly KahuaSource[];
  /** The revision this lift supersedes; absent: the standing head (none for a first lift). Naming a non-head makes a sibling. */
  readonly parent?: string | null;
  /** The proposal intent id this lift answers. */
  readonly proposal?: string;
}
export interface KahuaStageInput { readonly title: string; readonly text: string; readonly fields?: Readonly<Record<string, string>> }
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
    if (!url) throw new KahuaRefused("kahua-unpinned: the face pins no stage; its founding act signs the pin, and this face's log names none");
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
    // The ward signer opens the root at its signature, so a hand that holds no root (an AI seat's atom alone) learns it there.
    return { key: signer.key, sign: async (bytes) => {
      try { return await signer.sign(bytes); }
      catch (e) { throw new KahuaRefused(`operator-grant-absent: the operator's grant opens here no root of the face (${e instanceof Error ? e.message : String(e)})`); }
    } };
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
  /** The face's local canon, refused `kahua-lift-unstaged` where the face names no relation or no canon stands here. */
  const canon = async (code: string): Promise<{ relation: string; handle: DocHandle<LarDoc> }> => {
    const relation = faceRelationOf(projection());
    if (!relation) throw new KahuaRefused(`${code}: the face's log names no relation, so no local canon bags/daemon-<F> stands to hold a row`);
    const handle = ports.faceCanon ? await ports.faceCanon(relation) : null;
    if (!handle) throw new KahuaRefused(`${code}: no local canon bags/daemon-${relation} stands open here; stand the vessel wearing the face`);
    return { relation, handle };
  };
  /** The staged row a lift names, read back from the local canon and checked against the digest the person read. */
  const stagedRow = async (title: string, digest: string): Promise<KahuaStagedRow> => {
    const { relation, handle } = await canon("kahua-lift-unstaged");
    const row = readKahuaStagedRow(handle.doc(), title);
    if (!row) throw new KahuaRefused(`kahua-lift-unstaged: bags/daemon-${relation} holds no row "${title}"; stage it there first (\`lares kahua stage\`)`);
    if (row.digest !== digest) throw new KahuaRefused(`kahua-lift-digest-moved: the row "${title}" in bags/daemon-${relation} reads digest ${row.digest}, not the ${digest} named; preview it again`);
    return row;
  };
  const proposalOf = (id: string) => {
    const found = findKahuaProposal(ports.intents.doc(), group, projection().devices, id);
    if (!found) throw new KahuaRefused(`proposal-unknown: no verified kahua proposal ${id} stands on the face's intents plane`);
    return found;
  };

  return {
    async mint(): Promise<{ readonly url: string; readonly minted: boolean }> {
      const url = kahuaPlaneUrl(projection(), group);
      if (!url) throw new KahuaRefused("kahua-mint-outside-founding: the face's founding act signs its stage's pin and this face's log names none; no act outside the founding mints it");
      ports.register(KAHUA_BAG, url);
      return { url, minted: false };
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

    async staged(title: string): Promise<KahuaStagedRow & { readonly relation: string }> {
      const { relation, handle } = await canon("kahua-lift-unstaged");
      const row = readKahuaStagedRow(handle.doc(), title);
      if (!row) throw new KahuaRefused(`kahua-lift-unstaged: bags/daemon-${relation} holds no row "${title}"; stage it there first (\`lares kahua stage\`)`);
      return { ...row, relation };
    },

    async stage(input: KahuaStageInput): Promise<{ readonly title: string; readonly digest: string; readonly relation: string; readonly staged: boolean }> {
      if (typeof input.title !== "string" || input.title.length === 0) throw new KahuaRefused("kahua-stage-title: name the row's title");
      if (typeof input.text !== "string") throw new KahuaRefused("kahua-stage-text: name the row's body");
      const { relation, handle } = await canon("kahua-stage-no-canon");
      // A row that already reads the same digest takes no write inside the change, so a replay lands nothing.
      let out: { row: KahuaStagedRow; wrote: boolean } | null = null;
      handle.change((d) => { out = stageKahuaRow(d, input, "kahua-stage"); });
      if (out === null) throw new KahuaRefused("kahua-stage-unwritten: the local canon took no change");
      const done: { row: KahuaStagedRow; wrote: boolean } = out;
      if (done.wrote) await ports.repo.flush();
      return { title: done.row.title, digest: done.row.digest, relation, staged: done.wrote };
    },

    async lift(input: KahuaLiftInput): Promise<{ readonly cid: string; readonly parent: string | null; readonly landed: boolean }> {
      stageUrl();
      if (!Array.isArray(input.taint)) throw new KahuaRefused("kahua-act-refused: taint: name the lift's taint list (empty when every input came from inside the face)");
      if (typeof input.digest !== "string" || !/^[0-9a-f]{64}$/.test(input.digest)) throw new KahuaRefused("kahua-lift-unstaged: name the staged row's digest as its preview printed it");
      // THE STAGED ROW: the body and fields the lift carries come from bags/daemon-<F> alone, checked against the digest read.
      const row = await stagedRow(input.title, input.digest);
      const text = row.text;
      let origin = { seat: "", device: ports.atom.key, session: ports.session() };
      let taint = [...input.taint];
      let sources = [kahuaStagedSource(row), ...(input.sources ?? []).filter((s) => !(s.title === row.title && s.revision === kahuaStagedSource(row).revision))];
      let proposalCause: { id: string; cid: string } | null = null;
      if (input.proposal) {
        const found = proposalOf(input.proposal);
        const proposed = found.batch.proposals.find((p) => p.title === input.title);
        if (!proposed) throw new KahuaRefused(`proposal-title: proposal ${input.proposal} names no item "${input.title}"`);
        if (proposed.digest !== kahuaBodyDigest(text)) throw new KahuaRefused("proposal-digest: the staged body differs from the one proposed");
        if ((await reading()).history(input.title).some((revision) => revision.proposal === input.proposal)) {
          throw new KahuaRefused(`proposal-spent: proposal ${input.proposal} already lifted ${input.title}; lift a fresh proposal`);
        }
        origin = { seat: found.issuer, device: found.issuer, session: found.batch.session };
        taint = [...new Set([...proposed.taint, ...taint])];
        if (!sources.some((s) => s.title === proposed.title && s.revision === proposed.revision)) sources = [...sources, { title: proposed.title, revision: proposed.revision }];
        proposalCause = { id: input.proposal, cid: found.cid };
      }
      // A REPLAY LANDS NOTHING: a lift whose staged row the item's one head already carries answers that head, signs
      // nothing and opens no root.
      if (input.parent === undefined && !input.proposal) {
        const item = (await reading()).get(input.title);
        const head = item?.status === "standing" ? item.heads[0] : undefined;
        if (head && head.text === row.text && JSON.stringify(sortedFields(head.fields)) === JSON.stringify(sortedFields(row.fields))) {
          return { cid: head.cid, parent: head.parent, landed: false };
        }
      }
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
        act = await signKahuaLift({ group, epoch: ports.epoch(), title: input.title, text, fields: { ...row.fields }, parent, origin, taint, sources,
          ...(proposalCause ? { proposal: proposalCause.id } : {}) }, root);
      } catch (e) { throw new KahuaRefused(`kahua-act-refused: ${e instanceof Error ? e.message.replace(/^kahua-act: /, "") : String(e)}`); }
      const cid = await land(act);
      if (proposalCause) {
        const outcome = await buildOutcome({ group, signer: ports.atom, cause: proposalCause.id, result: { lifted: cid, title: input.title } });
        ports.intents.change((d) => writeIntentEntry(d, outcome));
      }
      await ports.repo.flush();
      return { cid, parent, landed: true };
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
