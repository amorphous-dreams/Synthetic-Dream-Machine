import type { PortIslandToVesselMsg, PortWireRecord, PortWidthName } from "@lararium/mesh/record-port";

export interface GlassWiki {
  addEventListener(type: "change", listener: (changes: Record<string, unknown>) => void): void;
  removeEventListener(type: "change", listener: (changes: Record<string, unknown>) => void): void;
  getTiddler(title: string): { fields: Record<string, unknown> } | undefined;
  addTiddler(tiddler: unknown): void;
  deleteTiddler(title: string): void;
}
export interface GlassTransport {
  send(message: Record<string, unknown>): unknown;
  onMessage(listener: (message: PortIslandToVesselMsg) => void): () => void;
}
export interface GlassPortOptions {
  wiki: GlassWiki;
  Tiddler: new (fields: Record<string, unknown>) => unknown;
  transport: GlassTransport;
  portId: string;
  wikiUri: string;
  actor: string;
  width: Extract<PortWidthName, "full" | "skinny" | "story">;
  fields?: string[];
  localFilter?: string[];
  mintTx: () => string;
  /** Writes a closed predecessor left unsettled; they resend under their own txId, which the island's per-actor ledger applies once. */
  adopt?: ReadonlyArray<PendingWrite>;
  /** Landed images a closed predecessor tagged whose wiki change has not fired yet; the successor must not read them as local edits. */
  inheritTags?: ReadonlyMap<string, readonly string[]>;
  /** Titles whose later edits waited behind a write the predecessor sent; the successor sends them once that write answers. */
  inheritDeferred?: readonly string[];
}
export interface PendingWrite { txId: string; title: string; record: PortWireRecord }

type Change = { title: string; fields: Record<string, string>; deleted?: true };
type Pending = { before: PortWireRecord | null; title: string; optimistic: string; generation: number;
  peerGeneration: number; record: PortWireRecord; echoed?: true };
const LOCAL = ["$:/state", "$:/temp", "$:/status", "$:/info/browser"];
const ownFields = (wiki: GlassWiki, title: string): Record<string, string> | null => {
  const tiddler = wiki.getTiddler(title);
  if (!tiddler) return null;
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(tiddler.fields))
    if (key !== "title" && value !== undefined) fields[key] = Array.isArray(value) ? value.join(" ") : String(value);
  return fields;
};
const imageOf = (fields: Record<string, string> | null) => JSON.stringify(fields);

/** A glass wiki mirrors port records while its local edits remain optimistic. */
export function makeGlassPortAdaptor(opts: GlassPortOptions) {
  const { wiki, Tiddler, transport, portId } = opts;
  const landed = new Map<string, PortWireRecord | null>();
  const omitted = new Map<string, string[]>();
  const tagged = new Map<string, string[]>([...(opts.inheritTags ?? [])].map(([title, images]) => [title, [...images]]));
  const pending = new Map<string, Pending>();
  const settled = new Set<string>();
  const loading = new Map<string, { title: string; generation: number; resolve: (text: string | undefined) => void }>();
  const generations = new Map<string, number>();
  const peerGenerations = new Map<string, number>();
  const tombstones = new Map<string, number>();
  const snapshots = new Map<string, { n: number; chunks: Map<number, PortWireRecord[]> }>();
  const resetTitles = new Set<string>();
  const repost = new Set<string>();
  const deferred = new Set<string>(opts.inheritDeferred ?? []);
  const landedListeners = new Set<(change: Change) => void>();
  const peerListeners = new Set<(change: Change) => void>();
  const presenceListeners = new Set<(presence: Extract<PortIslandToVesselMsg, { type: "port:presence" }>) => void>();
  const refusedListeners = new Set<(result: { title: string; txId: string; reason: string }) => void>();
  const opened = new Set<string>();
  let askNumber = 0;
  let closed = false;
  // The snapshot that answers a widen widens records the port already carries; a title the person wrote since the open is not in it, and is not dropped.
  let widening = false;
  const local = (title: string) => title === "$:/StoryList" || title === "$:/HistoryList" ||
    LOCAL.some(prefix => title === prefix || title.startsWith(`${prefix}/`)) ||
    (opts.localFilter ?? []).some(prefix => title.startsWith(prefix));
  const tag = (title: string, image: string) => tagged.set(title, [...(tagged.get(title) ?? []), image]);
  const optimistic = (title: string) => [...pending.values()].some(tx => tx.title === title);
  const land = (record: PortWireRecord, peer = false) => {
    if (local(record.title)) return;
    const { title } = record;
    const prior = landed.get(title);
    const fields = record.deleted ? null : { ...(prior && !prior.deleted ? prior.fields : {}), ...record.fields };
    if (fields) delete fields["title"];
    if (record.deleted) {
      omitted.delete(title);
      wiki.deleteTiddler(title);
      tag(title, imageOf(null));
      landed.set(title, null);
      if (record.seq !== undefined) tombstones.set(title, record.seq);
    } else {
      const missing = record.omitted ?? [];
      for (const key of missing) delete fields![key];
      omitted.set(title, missing);
      // Two images tag the landing: the wire fields (a wiki that notifies inside addTiddler matches this one) and the tiddler as TW5
      // reads it back after rewriting tags, lists and dates (TW5 notifies later and matches that one).
      const wire = imageOf(fields);
      tag(title, wire);
      wiki.addTiddler(new Tiddler({ title, ...fields }));
      const readBack = imageOf(ownFields(wiki, title));
      if (readBack !== wire) tag(title, readBack);
      landed.set(title, { ...record, fields: { ...fields! }, omitted: [...missing] });
      tombstones.delete(title);
    }
    if (peer) peerGenerations.set(title, (peerGenerations.get(title) ?? 0) + 1);
    const change: Change = { title, fields: fields ?? {}, ...(record.deleted ? { deleted: true } : {}) };
    for (const listener of landedListeners) listener(change);
    if (peer) for (const listener of peerListeners) listener(change);
  };
  const onChange = (changes: Record<string, unknown>) => {
    if (closed) return;
    for (const title of Object.keys(changes)) {
      if (local(title)) continue;
      const fields = ownFields(wiki, title);
      const image = imageOf(fields);
      const tags = tagged.get(title) ?? [];
      const taggedIndex = tags.indexOf(image);
      if (taggedIndex >= 0) {
        tags.splice(0, taggedIndex + 1);
        if (!tags.length) tagged.delete(title);
        continue;
      }
      if (tags.length) tagged.delete(title);
      const generation = (generations.get(title) ?? 0) + 1;
      generations.set(title, generation);
      // One write per title stands in flight: later keystrokes wait behind it and the follow-up carries the latest text.
      if (optimistic(title)) { deferred.add(title); continue; }
      sendLocal(title, fields, image, generation);
    }
  };
  function sendLocal(title: string, fields: Record<string, string> | null, image: string, generation: number): void {
    const txId = opts.mintTx();
    const record: PortWireRecord = { title, fields: fields ?? {}, ...(fields ? {} : { deleted: true as const }) };
    pending.set(txId, { title, before: landed.get(title) ?? null, optimistic: image, generation,
      peerGeneration: peerGenerations.get(title) ?? 0, record });
    transport.send({ type: "port:write", portId, txId, records: [{ title, fields: fields ?? {}, ...(fields ? {} : { tombstone: true }) }] });
  }
  /** The edits that waited behind a write now answered go out as one write of the title's current state. */
  const flushDeferred = (title: string): void => {
    if (!deferred.delete(title) || closed || optimistic(title)) return;
    const fields = ownFields(wiki, title);
    sendLocal(title, fields, imageOf(fields), generations.get(title) ?? 0);
  };
  wiki.addEventListener("change", onChange);
  const onMessage = (msg: PortIslandToVesselMsg) => {
    if (closed || msg.portId !== portId) return;
    if (msg.type === "port:snapshot") {
      const snapshot = snapshots.get(msg.snapshotId) ?? { n: msg.n, chunks: new Map<number, PortWireRecord[]>() };
      if (snapshot.n !== msg.n || msg.i < 1 || msg.i > msg.n) return;
      snapshots.set(msg.snapshotId, snapshot);
      snapshot.chunks.set(msg.i, msg.records);
      if (snapshot.chunks.size === snapshot.n) {
        snapshots.delete(msg.snapshotId);
        const records = Array.from({ length: snapshot.n }, (_, i) => snapshot.chunks.get(i + 1) ?? []).flat();
        const titles = new Set(records.map(record => record.title));
        const keepAbsent = widening; widening = false;
        for (const title of new Set([...landed.keys(), ...resetTitles])) if (!keepAbsent && !local(title) && !titles.has(title) && !optimistic(title))
          land({ title, fields: {}, deleted: true });
        resetTitles.clear();
        for (const record of records) {
          if (optimistic(record.title) || repost.has(record.title)) landed.set(record.title, record);
          else land(record);
        }
        for (const title of repost) {
          const fields = ownFields(wiki, title);
          const txId = opts.mintTx();
          const record: PortWireRecord = { title, fields: fields ?? {}, ...(fields ? {} : { deleted: true as const }) };
          pending.set(txId, { title, before: landed.get(title) ?? null, optimistic: imageOf(fields),
            generation: generations.get(title) ?? 0, peerGeneration: peerGenerations.get(title) ?? 0, record });
          transport.send({ type: "port:write", portId, txId,
            records: [{ title, fields: fields ?? {}, ...(fields ? {} : { tombstone: true }) }] });
        }
        repost.clear();
      }
    } else if (msg.type === "port:changes") {
      for (const entry of msg.entries) {
        const own = entry.causedBy.filter(txId => pending.has(txId) || settled.has(txId));
        if (own.length) {
          for (const txId of own) {
            settled.delete(txId);
            const tx = pending.get(txId);
            if (tx) tx.echoed = true;
          }
          continue;
        }
        if (deferred.has(entry.title)) {
          // The person's later typing waits behind a write in flight: the peer's record updates what the port holds, never the tiddler on screen, and the follow-up write carries the person's text.
          landed.set(entry.title, entry.deleted ? null : { ...entry, fields: { ...(landed.get(entry.title)?.fields ?? {}), ...entry.fields } });
          continue;
        }
        land(entry, true);
        // A peer record arrives without the body fields a skinny port omits; an opened body loads again so the editor never loses its text.
        if (entry.deleted) opened.delete(entry.title);
        else if (opened.has(entry.title) && omitted.get(entry.title)?.includes("text")) void loadBody(entry.title);
      }
      transport.send({ type: "port:ack", portId, cursor: msg.cursor });
    } else if (msg.type === "port:reset") {
      for (const title of landed.keys()) resetTitles.add(title);
      for (const [txId, tx] of pending) { repost.add(tx.title); settled.add(txId); }
      pending.clear();
      landed.clear(); omitted.clear(); tagged.clear(); snapshots.clear(); tombstones.clear();
      transport.send({ type: "port:open", portId, wikiUri: opts.wikiUri, actor: opts.actor,
        width: opts.width, edits: true, presence: true, maxRecordBytes: 65536, maxBatchBytes: 262144,
        ...(opts.fields ? { fields: opts.fields } : {}), ...(opts.localFilter ? { localFilter: opts.localFilter } : {}) });
    } else if (msg.type === "port:written") {
      const tx = pending.get(msg.txId);
      if (!tx) return;
      pending.delete(msg.txId);
      if (!tx.echoed) {
        settled.add(msg.txId);
        if (settled.size > 8192) settled.delete(settled.values().next().value!);
      }
      if (msg.status === "refused" || msg.status === "partial" && !msg.applied.length) {
        if (generations.get(tx.title) === tx.generation &&
          (peerGenerations.get(tx.title) ?? 0) === tx.peerGeneration &&
          imageOf(ownFields(wiki, tx.title)) === tx.optimistic) {
          const base = landed.get(tx.title) ?? tx.before;
          if (base) land(base);
          else land({ title: tx.title, fields: {}, deleted: true });
        }
        for (const listener of refusedListeners) listener({ title: tx.title, txId: msg.txId, reason: msg.reason ?? msg.status });
      } else {
        landed.set(tx.title, tx.record.deleted ? null : tx.record);
      }
      flushDeferred(tx.title);
    } else if (msg.type === "port:answer") {
      const ask = loading.get(msg.askId);
      if (!ask) return;
      loading.delete(msg.askId);
      if (msg.status === "answered" && Array.isArray(msg.result)) {
        const record = (msg.result as PortWireRecord[]).find(record => record.title === ask.title);
        if (record && (tombstones.get(ask.title) ?? -1) > (record.seq ?? -1)) {
          ask.resolve(undefined);
          return;
        }
        if (record) {
          const held = landed.get(ask.title);
          if (ask.generation === (generations.get(ask.title) ?? 0) &&
            (!held || (held.seq ?? 0) <= (record.seq ?? 0)) && !tombstones.has(ask.title)) {
            const fields = { ...(held && !held.deleted ? held.fields : {}), ...record.fields };
            land({ title: ask.title, ...(record.seq === undefined ? {} : { seq: record.seq }), fields,
              omitted: (omitted.get(ask.title) ?? []).filter(key => !(key in record.fields)) });
          }
          ask.resolve(record.fields.text);
          return;
        }
      }
      ask.resolve(tombstones.has(ask.title) ? undefined : ownFields(wiki, ask.title)?.text);
    } else if (msg.type === "port:presence" && msg.actorKey !== opts.actor) {
      for (const listener of presenceListeners) listener(msg);
    }
  };
  const unsubscribe = transport.onMessage(onMessage);
  transport.send({ type: "port:open", portId, wikiUri: opts.wikiUri, actor: opts.actor,
    width: opts.width, edits: true, presence: true, maxRecordBytes: 65536, maxBatchBytes: 262144,
    ...(opts.fields ? { fields: opts.fields } : {}), ...(opts.localFilter ? { localFilter: opts.localFilter } : {}) });
  transport.send({ type: "port:presence", portId, actorKey: opts.actor, beat: 0 });
  for (const write of opts.adopt ?? []) {
    const fields = ownFields(wiki, write.title);
    pending.set(write.txId, { title: write.title, before: null, optimistic: imageOf(fields), generation: generations.get(write.title) ?? 0,
      peerGeneration: 0, record: write.record });
    transport.send({ type: "port:write", portId, txId: write.txId,
      records: [{ title: write.title, fields: write.record.fields, ...(write.record.deleted ? { tombstone: true } : {}) }] });
  }
  const loadBody = (title: string): Promise<string | undefined> => {
    if (!omitted.get(title)?.includes("text")) return Promise.resolve(ownFields(wiki, title)?.text);
    const askId = `${portId}:load:${++askNumber}`;
    return new Promise(resolve => { loading.set(askId, { title, generation: generations.get(title) ?? 0, resolve });
      transport.send({ type: "port:ask", portId, askId, kind: "load", subject: title, fields: ["text"] }); });
  };
  return {
    /** Ask the island to widen this open port in place; its fresh snapshot lands through the same listener. */
    widen(next: GlassPortOptions["width"]): unknown { if (closed) return undefined; opts.width = next; widening = true; return transport.send({ type: "port:widen", portId, width: next }); },
    deferredTitles(): string[] { return [...deferred]; },
    tagImages(): ReadonlyMap<string, readonly string[]> { return new Map(tagged); },
    pendingWrites(): PendingWrite[] { return [...pending].map(([txId, tx]) => ({ txId, title: tx.title, record: tx.record })); },
    resendPending() {
      for (const [txId, tx] of pending) transport.send({ type: "port:write", portId, txId,
        records: [{ title: tx.title, fields: tx.record.fields,
          ...(tx.record.deleted ? { tombstone: true } : {}) }] });
    },
    onLanded(listener: (change: Change) => void) { landedListeners.add(listener); return () => landedListeners.delete(listener); },
    onPeerEdit(listener: (change: Change) => void) { peerListeners.add(listener); return () => peerListeners.delete(listener); },
    onPresence(listener: (presence: Extract<PortIslandToVesselMsg, { type: "port:presence" }>) => void) {
      presenceListeners.add(listener); return () => presenceListeners.delete(listener);
    },
    onRefused(listener: (result: { title: string; txId: string; reason: string }) => void) {
      refusedListeners.add(listener); return () => refusedListeners.delete(listener);
    },
    omittedFields(title: string) { return [...(omitted.get(title) ?? [])]; },
    openBody(title: string): Promise<string | undefined> { opened.add(title); return loadBody(title); },
    closeBody(title: string) { opened.delete(title); },
    openDraft(title: string) { return this.openBody(title); },
    postPresence(beat: number, state?: unknown) { transport.send({ type: "port:presence", portId, actorKey: opts.actor, beat, state }); },
    close() { if (closed) return; closed = true; wiki.removeEventListener("change", onChange); unsubscribe();
      transport.send({ type: "port:close", portId }); },
  };
}

/** The host lends both the TW5 instance and its port transport when startup runs. */
export function makeGlassPortStartup(opts: Omit<GlassPortOptions, "wiki" | "Tiddler"> & {
  tw: { wiki: GlassWiki; Tiddler: GlassPortOptions["Tiddler"] };
}) {
  return { name: "glass-port-adaptor", platforms: ["browser"] as ["browser"], after: ["startup"] as ["startup"],
    startup() { return makeGlassPortAdaptor({ ...opts, wiki: opts.tw.wiki, Tiddler: opts.tw.Tiddler }); } };
}
