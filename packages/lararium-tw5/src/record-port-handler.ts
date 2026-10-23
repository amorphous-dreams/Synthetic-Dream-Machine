/** The record port binds one island's store, log, asks, and clockless presence. */
import {
  readPortVesselMsg, mkPortAnswer, mkPortChanges, mkPortPresence, mkPortReset,
  mkPortSnapshot, mkPortWritten,
  type PortMsg_Open, type PortMsg_Ask, type PortMsg_Write, type PortMsg_Written, type PortWireRecord,
} from "@lararium/mesh/record-port";
import { isVerbRefusal, requireKahuReach, type CapTier, type KahuReachSource, type LarTiddlerRecord, type Verb } from "@lararium/mesh";
import type { LarTiddlerChange } from "@lararium/mesh";
import type { IslandCap } from "./island-caps.js";
import type { IslandContext } from "./island-context.js";
import { createPortLog, createTxLedger, transactionDigest, validateTx, type PortEntry } from "./record-port-log.js";
import { localFilter, projectRecord, load, type PortShape } from "./record-port-projection.js";
import { PresenceTracker } from "./record-port-presence.js";
import { gateInvoke, type AuthorityResult, type InvokeRequest } from "./record-port-invoke-gate.js";
import { RecordingDocument, RecordingNode, cameraContainer, cameraDocument, fireRecorded } from "./recording-document.js";
import { toBlocks, toLabelHtml, toText, type Block } from "./recording-serialisers.js";
import { mountCamera } from "./tw5-camera.js";
import { registerActionReactors, makeTw5Deserializer } from "./action-handler.js";
import { VerbTable, type VerbContext } from "./verb-dispatcher.js";

export interface RecordPortOptions {
  authority?: (req: InvokeRequest) => AuthorityResult;
  faceOf?: (portId: string) => object | undefined;
  /** The composer lends bag grants tied to the verified face. */
  verbCap?: (face: object, portId: string) => VerbContext["cap"];
  /** The composer binds an actor to the transport; client actor labels carry presence only. */
  actorOf?: (portId: string) => string | undefined;
  /** The port builds its own ACTION table; a caller can substitute a table for a focused witness. */
  verbs?: (ctx: IslandContext) => VerbTable;
  kahuReach?: KahuReachSource;
  casTierOf?: (cid: string) => CapTier | undefined;
  /** The composer lends a server-held write grant for this port and actor. */
  mayEdit?: (portId: string, actor: string) => boolean;
  lapseRounds?: number;
  lagByteBudget?: number;
  retainEntries?: number;
  /** Maximum actor ledgers retained across port opens. */
  maxActors?: number;
  /** Writes one port may hold admitted and unsettled; the next refuses `write-queue-full` (default 16). */
  maxQueuedWrites?: number;
  /** Live ports one island serves; an open past it gets a `lagged` reset (the island could not serve it) and holds nothing (default 64). */
  maxPorts?: number;
  /** Asks one port may hold started and unanswered; the next refuses `ask-queue-full` (default 32). */
  maxAsks?: number;
  /** The composer lends the bags a port may name in a write: admin on that bag for the bound actor. Absent, every explicit bag refuses `bag-not-granted`. */
  bagGrant?: (portId: string, actor: string, bag: string) => boolean;
  bootNonce?: string;
}

interface ActorState {
  ledger: ReturnType<typeof createTxLedger>;
  written: Map<string, PortMsg_Written>;
  unanswered: Set<string>;
}

interface OpenPort {
  readonly open: PortMsg_Open;
  readonly boundActor: string;
  readonly presenceActor: string;
  readonly shape: PortShape;
  closed: boolean;
  held: boolean;
  opening: boolean;
  baseSeq: number;
  readonly dirty: Set<string>;
  readonly buffered: PortEntry[];
  readonly pending: Array<{ seq: number; bytes: number }>;
  pendingBytes: number;
  ackSeq: number;
  postedSeq: number;
  snapshotId?: string;
  rendered: { cursor: string; stale: boolean; affordances: Map<string, { node: RecordingNode; kind: string }>; stop: () => void } | undefined;
  readonly written: Map<string, PortMsg_Written>;
  readonly ledger: ReturnType<typeof createTxLedger>;
  readonly actorState: ActorState;
  readonly actorTableFull: boolean;
  /** Writes admitted and not yet settled; the queue holds each message whole, so the count is bounded at admission. */
  queuedWrites: number;
  /** Asks started and not yet answered; the count is bounded at admission like the write queue. */
  asksInFlight: number;
}

export type RecordPortCap = IslandCap & { transportGone(portId: string): void };

function affordanceNodes(block: Block, root: RecordingNode): Map<string, { node: RecordingNode; kind: string }> {
  const nodes = new Map<number, RecordingNode>();
  const walk = (node: RecordingNode): void => { nodes.set(node.nodeId, node); for (const child of node.childNodes) walk(child); };
  walk(root);
  const offered = new Map<string, { node: RecordingNode; kind: string }>();
  const visit = (part: Block): void => {
    for (const item of part.affordances) {
      const node = nodes.get(item.nodeId);
      if (node && node.listeners.some(listener => listener.type === item.kind)) offered.set(item.id, { node, kind: item.kind });
    }
    for (const child of part.children) visit(child);
  };
  visit(block);
  return offered;
}

function fieldsOf(record: LarTiddlerRecord): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(record.tiddler)) {
    if (value === undefined || value === null) continue;
    if (value instanceof Date) fields[key] = value.toISOString();
    else if (Array.isArray(value)) fields[key] = value.map(item => {
      const word = String(item);
      return /\s/.test(word) ? `[[${word}]]` : word;
    }).join(" ");
    else fields[key] = String(value);
  }
  return fields;
}

function visible(title: string, port: OpenPort): boolean {
  return !localFilter(title) && !(port.open.localFilter ?? []).some(prefix => title.startsWith(prefix));
}

function projected(entry: PortEntry, port: OpenPort): PortWireRecord & { seq: number; causedBy: string[] } {
  const value = projectRecord(entry, port.shape);
  return { title: entry.title, seq: entry.seq, fields: value.fields as Record<string, string>,
    omitted: [...value.omitted], ...(entry.deleted ? { deleted: true as const } : {}), causedBy: [...entry.causedBy] };
}

export function hasRecordPort(opts: RecordPortOptions = {}): RecordPortCap {
  const maxActors = opts.maxActors ?? 256;
  if (!Number.isSafeInteger(maxActors) || maxActors < 1) throw new RangeError("maxActors");
  const maxAsks = opts.maxAsks ?? 32;
  if (!Number.isSafeInteger(maxAsks) || maxAsks < 1) throw new RangeError("maxAsks");
  const maxPorts = opts.maxPorts ?? 64;
  if (!Number.isSafeInteger(maxPorts) || maxPorts < 1) throw new RangeError("maxPorts");
  const maxQueuedWrites = opts.maxQueuedWrites ?? 16;
  if (!Number.isSafeInteger(maxQueuedWrites) || maxQueuedWrites < 1) throw new RangeError("maxQueuedWrites");
  const nonce = (opts.bootNonce ?? crypto.randomUUID()).replaceAll(".", "");
  const log = createPortLog({ bootNonce: nonce, lagByteBudget: opts.lagByteBudget ?? 1_048_576,
    ...(opts.retainEntries === undefined ? {} : { retainEntries: opts.retainEntries }) });
  const presence = new PresenceTracker(opts.lapseRounds);
  const ports = new Map<string, OpenPort>();
  const actors = new Map<string, ActorState>();
  const tokens = new Map<string, { portId: string; txId: string }>();
  let tokenCounter = 0;
  const queued: Array<{ change: LarTiddlerChange; causedBy: string[] }> = [];
  let flushQueued = false;
  const lastSeq = new Map<string, number>();
  let writes: Promise<void> = Promise.resolve();
  let presenceSource: string | undefined;
  let verbs: VerbTable | undefined;
  const verbTable = (ctx: IslandContext): VerbTable => {
    if (verbs) return verbs;
    if (opts.verbs) return verbs = opts.verbs(ctx);
    const table = new VerbTable();
    registerActionReactors(table, { composite: ctx.composite, tw5: makeTw5Deserializer(ctx.tw5),
      ...(ctx.resolveByCid ? { resolveByCid: ctx.resolveByCid } : {}),
      ...(opts.kahuReach ? { kahuReach: opts.kahuReach } : {}) });
    return verbs = table;
  };

  const finish = (port: OpenPort): void => {
    if (port.snapshotId) log.finishSnapshot(port.snapshotId);
    delete port.snapshotId;
  };
  const drop = (portId: string): void => {
    const port = ports.get(portId);
    if (!port) return;
    port.closed = true;
    port.rendered?.stop();
    finish(port);
    presence.close(portId);
    ports.delete(portId);
  };
  const postEntries = (ctx: IslandContext, port: OpenPort, entries: readonly PortEntry[]): void => {
    if (port.closed || port.held) return;
    if (port.opening) { port.buffered.push(...entries); return; }
    const kept = entries.filter(entry => visible(entry.title, port));
    if (!kept.length) return;
    if (kept.length > 4096) {
      port.held = true;
      ctx.post(mkPortReset({ portId: port.open.portId, reason: "lagged", floorSeq: log.floorSeq, headSeq: log.headSeq }));
      return;
    }
    const wire = mkPortChanges({ portId: port.open.portId, entries: kept.map(entry => projected(entry, port)),
      cursor: log.cursorOf(port.shape, kept.at(-1)!.seq) });
    const size = new TextEncoder().encode(JSON.stringify(wire)).length;
    port.pending.push({ seq: kept.at(-1)!.seq, bytes: size });
    port.pendingBytes += size;
    if (port.pendingBytes > (opts.lagByteBudget ?? 1_048_576)) {
      port.held = true;
      port.pending.length = 0;
      port.pendingBytes = 0;
      ctx.post(mkPortReset({ portId: port.open.portId, reason: "lagged", floorSeq: log.floorSeq, headSeq: log.headSeq }));
      return;
    }
    ctx.post(wire);
    port.postedSeq = Math.max(port.postedSeq, kept.at(-1)!.seq);
  };
  const flush = (ctx: IslandContext): void => {
    flushQueued = false;
    if (!queued.length) return;
    const batch = queued.splice(0);
    const records = batch.map(({ change }) => ({ title: change.title,
      fields: change.record ? fieldsOf(change.record) : {},
      deleted: change.record === null || change.record.meta?.deleted === true }));
    const { seq } = log.append(records, batch.map(item => item.causedBy));
    const logged: PortEntry[] = records.map((record, index) => {
      const entrySeq = seq - records.length + index + 1;
      lastSeq.set(record.title, entrySeq);
      return { ...record, seq: entrySeq, causedBy: batch[index]!.causedBy };
    });
    for (const port of ports.values()) postEntries(ctx, port, logged);
  };
  const open = async (msg: PortMsg_Open, ctx: IslandContext, port: OpenPort): Promise<void> => {
    if (msg.since) {
      const answer = log.changesSince(msg.since, port.shape);
      if ("reset" in answer) ctx.post(mkPortReset({ portId: msg.portId, ...answer.reset }));
      else postEntries(ctx, port, answer.entries);
    } else {
      const reservation = log.openSnapshot(port.shape, [], msg.maxBatchBytes, port.baseSeq);
      port.snapshotId = reservation.snapshotId;
      try {
        const entries = await ctx.composite.entries();
        if (port.closed || ports.get(msg.portId) !== port) return;
        const records = entries.filter(entry => visible(entry.title, port) && !port.dirty.has(entry.title)).map(entry => {
          const value = projectRecord({ title: entry.title, seq: lastSeq.get(entry.title) ?? 0,
            fields: fieldsOf(entry.record) }, port.shape);
          return { title: value.title, seq: value.seq ?? 0, fields: value.fields as Record<string, string>, omitted: [...value.omitted] };
        });
        const snapshot = log.openSnapshot(port.shape, records, msg.maxBatchBytes, port.baseSeq);
        log.finishSnapshot(reservation.snapshotId);
        port.snapshotId = snapshot.snapshotId;
        for (const chunk of snapshot.chunks) {
          if (port.closed || ports.get(msg.portId) !== port || port.snapshotId !== snapshot.snapshotId) break;
          ctx.post(mkPortSnapshot({ portId: msg.portId, snapshotId: snapshot.snapshotId,
            baseCursor: log.cursorOf(port.shape, snapshot.baseSeq), i: chunk.i, n: chunk.n,
            records: chunk.records.map(record => ({ title: record.title, seq: record.seq ?? 0,
              fields: { ...record.fields },
              omitted: records.find(item => item.title === record.title)?.omitted ?? [],
              ...(record.deleted ? { deleted: true as const } : {}) })) }));
        }
        finish(port);
        port.opening = false;
        if (port.buffered.length) {
          const buffered = port.buffered.splice(0);
          postEntries(ctx, port, buffered);
        }
        const tail = log.changesSince(log.cursorOf(port.shape, snapshot.baseSeq), port.shape);
        if ("entries" in tail) postEntries(ctx, port, tail.entries.filter(entry => !port.dirty.has(entry.title)));
      } catch {
        port.opening = false;
        finish(port);
        port.buffered.length = 0;
        port.dirty.clear();
        // A failed store read leaves this port unable to serve its snapshot; lagged asks the client to reopen.
        port.held = true;
        if (!port.closed && ports.get(msg.portId) === port)
          ctx.post(mkPortReset({ portId: msg.portId, reason: "lagged", floorSeq: log.floorSeq, headSeq: log.headSeq }));
        return;
      }
    }
    if (!port.closed && msg.presence) for (const value of presence.snapshotFor(msg.portId))
      ctx.post(mkPortPresence({ portId: msg.portId, ...value }));
  };
  const write = async (msg: PortMsg_Write, ctx: IslandContext, port: OpenPort): Promise<void> => {
    const answer = (status: "applied" | "partial" | "refused", applied: string[], failed: string[], reason?: string) => {
      if (port.closed) return;
      const wire = mkPortWritten({ portId: msg.portId, txId: msg.txId, status, applied, failed,
        ...(reason ? { reason } : {}), cursor: log.cursorOf(port.shape, log.headSeq) });
      if (status !== "refused") {
        port.written.set(msg.txId, wire);
        if (port.written.size > 1024) port.written.delete(port.written.keys().next().value!);
      }
      ctx.post(wire);
    };
    if (port.closed) return;
    if (port.actorTableFull) { answer("refused", [], [], "actor-table-full"); return; }
    const digest = transactionDigest(msg.records);
    if (!port.ledger.matches(msg.txId, digest)) { answer("refused", [], [], "txid-payload-mismatch"); return; }
    const prior = port.ledger.has(msg.txId) ? port.written.get(msg.txId) : undefined;
    if (prior?.status === "applied") { if (!port.closed) ctx.post({ ...prior, portId: msg.portId }); return; }
    let granted = false;
    try { granted = port.open.edits === true && opts.mayEdit?.(msg.portId, port.boundActor) === true; }
    catch { /* A failed lookup grants nothing. */ }
    if (!granted) { answer("refused", [], [], "edits-not-granted"); return; }
    // An explicit bag is no edit of the wiki: the composer must lend the bag, and a system canon bag also meets
    // the Kahu predicate the verbs meet.
    for (const bag of new Set(msg.records.flatMap(record => record.bag ? [record.bag] : []))) {
      let lent = false;
      try { lent = opts.bagGrant?.(msg.portId, port.boundActor, bag) === true; } catch { /* A failed lookup grants nothing. */ }
      if (!lent) { answer("refused", [], [], "bag-not-granted"); return; }
      try { await requireKahuReach(bag, opts.kahuReach, "port write"); }
      catch { answer("refused", [], [], "kahu-reach"); return; }
    }
    if (!prior && msg.basis && msg.basis !== log.cursorOf(port.shape, log.headSeq)) {
      answer("refused", [], [], "stale-basis"); return;
    }
    const records = msg.records.map(record => ({ title: record.title, fields: record.fields,
      ...(record.tombstone ? { deleted: true } : {}) }));
    const verdict = validateTx(records, { maxRecordBytes: port.open.maxRecordBytes,
      maxBatchBytes: port.open.maxBatchBytes, validateRecord: record => localFilter(record.title) ? "local-title" : undefined });
    if ("refused" in verdict) { answer("refused", [], [], verdict.refused); return; }
    const families = [...new Set(msg.records.map(record => record.bag ?? "(default)"))];
    let familyStarted = false;
    try {
      const begun = port.ledger.begin(msg.txId, families, digest);
      if (begun.answer) {
        if (!port.closed) ctx.post(prior ? { ...prior, portId: msg.portId } : mkPortWritten({ portId: msg.portId, txId: msg.txId,
          status: begun.answer.status, applied: [...begun.answer.applied], failed: [...begun.answer.failed],
          cursor: log.cursorOf(port.shape, log.headSeq) }));
        return;
      }
      port.actorState.unanswered.add(msg.txId);
      if (begun.pending.some(family => family !== "(default)" && !ctx.composite.hasBag(family))) {
        if (port.ledger.discard(msg.txId)) port.actorState.unanswered.delete(msg.txId);
        answer("refused", [], [], "bag-unavailable"); return;
      }
      for (const family of begun.pending) {
        const members = msg.records.filter(record => (record.bag ?? "(default)") === family);
        const puts = members.filter(record => !record.tombstone).map(record => ({ tiddler: { ...record.fields, title: record.title } }));
        const tombstones = members.filter(record => record.tombstone).map(record => record.title);
        await ctx.composite.precheckFamily(puts, tombstones, family === "(default)" ? undefined : { bag: family });
        if (port.closed) { if (port.ledger.discard(msg.txId)) port.actorState.unanswered.delete(msg.txId); return; }
      }
      const failed: string[] = [];
      for (const family of begun.pending) {
        if (port.closed) { if (port.ledger.discard(msg.txId)) port.actorState.unanswered.delete(msg.txId); return; }
        const members = msg.records.filter(record => (record.bag ?? "(default)") === family);
        const puts = members.filter(record => !record.tombstone).map(record => ({ tiddler: { ...record.fields, title: record.title } }));
        const tombstones = members.filter(record => record.tombstone).map(record => record.title);
        const token = `port:${++tokenCounter}:${crypto.randomUUID()}`;
        tokens.set(token, { portId: msg.portId, txId: msg.txId });
        try {
          familyStarted = true;
          await ctx.composite.writeFamily(puts, tombstones,
            { kind: "tw-local", instanceId: token },
            family === "(default)" ? undefined : { bag: family });
          port.ledger.recordApplied(msg.txId, family);
          if (port.closed) return;
        } catch { failed.push(...begun.pending.slice(begun.pending.indexOf(family))); break; }
        finally {
          tokens.delete(token);
          flush(ctx);
        }
      }
      if (port.closed) return;
      const result = port.ledger.answer(msg.txId, failed);
      if (result.status === "applied") port.actorState.unanswered.delete(msg.txId);
      flush(ctx);
      answer(result.status, [...result.applied], [...result.failed]);
    } catch (error) {
      if (!familyStarted && port.ledger.discard(msg.txId)) port.actorState.unanswered.delete(msg.txId);
      const reason = error instanceof Error && "reason" in error && typeof error.reason === "string"
        ? error.reason : error instanceof Error ? error.message : "write-failed";
      answer("refused", [], [], reason);
    }
  };
  const ask = async (msg: PortMsg_Ask, ctx: IslandContext, port: OpenPort): Promise<void> => {
    const answered = (result: unknown) => { if (!port.closed) ctx.post(mkPortAnswer({ portId: msg.portId, askId: msg.askId, status: "answered", result })); };
    const refused = (reason: string) => { if (!port.closed) ctx.post(mkPortAnswer({ portId: msg.portId, askId: msg.askId, status: "refused", reason })); };
    if (msg.kind === "filter") {
      try { answered(ctx.tw5.$tw.wiki.filterTiddlers(msg.subject ?? "").filter(title => visible(title, port))); }
      catch { refused("filter-unavailable"); }
    } else if (msg.kind === "load") {
      const titles = msg.titles ?? (msg.subject ? [msg.subject] : []);
      const results = [];
      for (const title of titles) {
        if (!visible(title, port)) continue;
        let raced = true;
        for (let attempt = 0; attempt < 3; attempt++) {
          const before = lastSeq.get(title) ?? 0;
          const record = await ctx.composite.get(title);
          const after = lastSeq.get(title) ?? 0;
          if (before !== after) continue;
          raced = false;
          if (record && !record.meta?.deleted) results.push(load({ title, seq: before,
            fields: fieldsOf(record) }, msg.fields ?? []));
          break;
        }
        if (raced) { refused("load-raced"); return; }
      }
      answered(results);
    } else if (msg.kind === "render") {
      const title = msg.subject ?? "";
      if (!title || !visible(title, port) || !port.open.renders?.includes(msg.form ?? "html")) {
        refused("render-unavailable"); return;
      }
      try {
        port.rendered?.stop();
        port.rendered = undefined;
        const document = new RecordingDocument();
        const container = document.createElement("div");
        const unmount = mountCamera(ctx.tw5, { rootTiddler: title, document: cameraDocument(document), container: cameraContainer(container) });
        const form = msg.form ?? "html";
        const value = form === "html" ? container.innerHTML : form === "text" ? toText(container) :
          form === "label-html" ? toLabelHtml(container) : toBlocks(container);
        const blocks = toBlocks(container);
        if (typeof value === "object" && value !== null && "missing" in value || "missing" in blocks) {
          unmount(); refused("render-unavailable"); return;
        }
        flush(ctx);
        const renderCursor = log.cursorOf(port.shape, log.headSeq);
        const rendered = { cursor: renderCursor, stale: false, affordances: affordanceNodes(blocks, container), stop: () => {
          ctx.tw5.$tw.wiki.removeEventListener("change", changed);
          unmount();
        } };
        const changed = () => { rendered.stale = true; };
        ctx.tw5.$tw.wiki.addEventListener("change", changed);
        port.rendered = rendered;
        answered({ form, value, renderCursor });
      } catch { port.rendered?.stop(); port.rendered = undefined; refused("render-unavailable"); }
    } else if (msg.kind === "invoke") {
      flush(ctx);
      const face = opts.faceOf?.(msg.portId);
      const req: InvokeRequest = { ...(face ? { provenFace: face } : {}),
        renderCursor: msg.renderCursor ?? "", affordanceId: msg.affordanceId ?? "" };
      try {
        const result = gateInvoke(req, { ...(opts.authority ? { authority: opts.authority } : {}),
          currentRenderCursor: () => port.rendered?.cursor === req.renderCursor && !port.rendered.stale && log.cursorOf(port.shape, log.headSeq) === req.renderCursor ? req.renderCursor : "",
          invokeActions: request => {
            const offered = port.rendered?.affordances.get(request.affordanceId);
            if (!offered) return "unknown-affordance";
            return fireRecorded(offered.node, offered.kind);
          } });
        if (!result.invoked) refused(result.reason);
        else if (result.value === "unknown-affordance") refused("unknown-affordance");
        else answered({ invoked: result.value });
      } catch { refused("invoke-unavailable"); }
    } else if (msg.kind === "verb") {
      // The mesh source carries args; this intersection also tolerates a stale built mesh declaration.
      const args = (msg as PortMsg_Ask & { args?: Record<string, string> }).args ?? {};
      const face = opts.faceOf?.(msg.portId);
      const req: InvokeRequest = { ...(face ? { provenFace: face } : {}), renderCursor: "", affordanceId: "" };
      try {
        const gated = gateInvoke(req, { ...(opts.authority ? { authority: opts.authority } : {}),
          currentRenderCursor: () => "", invokeActions: () => true });
        if (!gated.invoked) { refused(gated.reason); return; }
        const action = msg.subject ?? "";
        const handler = verbTable(ctx).get(action);
        if (!handler) { refused("no-such-verb"); return; }
        const requestedBy = face && "id" in face && typeof face.id === "string" ? face.id : `port:${msg.portId}`;
        const invocation: Verb = { requestId: msg.askId, title: `lar:///ha.ka.ba/bags/wiki/verbs/${msg.askId}`,
          action, args, targets: msg.titles ?? [], batchMode: "best-effort",
          status: "pending", requestedBy, requestedAt: "" };
        const cap = opts.verbCap?.(face!, msg.portId) ?? (async () => ({ ok: false, reason: "no-verb-cap" }));
        answered(await handler(args, { daemon: ctx.composite, invocation, cap }));
      } catch (error) {
        if (isVerbRefusal(error)) {
          refused(error.reason);
        } else refused("verb-unavailable");
      }
    } else if (msg.kind === "cas") {
      const cid = msg.subject ?? "";
      if (!/^[a-fA-F0-9]{64}$/.test(cid)) { refused("bad-cid"); return; }
      let tier: CapTier | undefined;
      try { tier = opts.casTierOf?.(cid); } catch { /* A failed tier lookup grants nothing. */ }
      if (tier === undefined) { refused("cas-tier-unknown"); return; }
      if (tier === "contract") { refused("cas-contract"); return; }
      if (tier !== "public") { refused("cas-private"); return; }
      if (!ctx.resolveByCid) { refused("cas-unavailable"); return; }
      try {
        const bytes = await ctx.resolveByCid(cid);
        if (!bytes) { refused("cas-missing"); return; }
        if (bytes.byteLength > 786_432) { refused("cas-too-large"); return; }
        const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
        const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        if (actual !== cid.toLowerCase()) { refused("cas-corrupt"); return; }
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 32768)
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
        const result = { cid, bytesBase64: btoa(binary) };
        if (new TextEncoder().encode(JSON.stringify(result)).length > 1_048_576) {
          refused("cas-too-large"); return;
        }
        answered(result);
      } catch { refused("cas-unavailable"); }
    } else refused("ask-kind-not-wired");
  };

  return {
    name: "record-port",
    transportGone(portId) { drop(portId); },
    onEa(ctx) {
      const unsubscribe = ctx.composite.subscribe(change => {
        const tokenId = change.origin.kind === "tw-local" ? change.origin.instanceId : undefined;
        const token = tokenId ? tokens.get(tokenId) : undefined;
        for (const port of ports.values()) if (port.opening) port.dirty.add(change.title);
        // Every change joins one queue in the order the store fired it, a port write's echo naming its txId.
        const causedBy: string[] = token ? [token.txId] : [];
        queued.push({ change, causedBy });
        if (token) return;
        if (!flushQueued) { flushQueued = true; queueMicrotask(() => flush(ctx)); }
      });
      const unsubscribePresence = presence.subscribe(value => {
        for (const port of ports.values()) if (port.open.presence && port.open.portId !== presenceSource)
          ctx.post(mkPortPresence({ portId: port.open.portId, ...value }));
      });
      return () => { unsubscribe(); unsubscribePresence(); for (const id of [...ports.keys()]) drop(id); };
    },
    onSignal(type, raw, ctx) {
      if (!type.startsWith("port:")) return false;
      const msg = readPortVesselMsg(raw);
      if (!msg || msg.type !== type) return false;
      if (msg.type === "port:open") {
        if (msg.wikiUri !== ctx.wikiUri) return false;
        flush(ctx);
        if (!ports.has(msg.portId) && ports.size >= maxPorts) {
          ctx.post(mkPortReset({ portId: msg.portId, reason: "lagged", floorSeq: log.floorSeq, headSeq: log.headSeq }));
          return true;
        }
        const lentActor = opts.actorOf?.(msg.portId);
        const boundActor = lentActor ?? msg.portId;
        const presenceActor = lentActor ?? msg.actor;
        for (const [id, prior] of ports) if (prior.boundActor === boundActor || id === msg.portId) {
          if (id === msg.portId) presence.close(id);
          else presence.supersede(prior.presenceActor, msg.portId);
          drop(id);
        }
        presence.open(msg.portId);
        const shape: PortShape = { width: msg.width,
          ...(msg.localFilter ? { localFilter: msg.localFilter } : {}),
          ...(msg.fields ? { fields: msg.fields } : {}) };
        let actor = actors.get(boundActor);
        let actorTableFull = false;
        if (actor) {
          actors.delete(boundActor);
          actors.set(boundActor, actor);
        } else {
          if (actors.size >= maxActors) {
            for (const [key, candidate] of actors) {
              if (candidate.unanswered.size || [...ports.values()].some(value => value.boundActor === key)) continue;
              actors.delete(key);
              break;
            }
          }
          actor = { ledger: createTxLedger(), written: new Map(), unanswered: new Set() };
          if (actors.size < maxActors) actors.set(boundActor, actor);
          else actorTableFull = true;
        }
        const since = msg.since ? log.parseCursor(msg.since) : undefined;
        const ackSeq = since && since.bootNonce === nonce && since.shapeId === log.shapeId(shape) ? since.seq : log.headSeq;
        const port: OpenPort = { open: msg, boundActor, presenceActor, shape, closed: false, held: false, opening: !msg.since,
          baseSeq: log.headSeq, dirty: new Set(), buffered: [], pending: [], pendingBytes: 0,
          ackSeq, postedSeq: ackSeq, rendered: undefined, written: actor.written, ledger: actor.ledger,
          actorState: actor, actorTableFull, queuedWrites: 0, asksInFlight: 0 };
        ports.set(msg.portId, port);
        void open(msg, ctx, port);
        return true;
      }
      const port = ports.get(msg.portId);
      if (!port) return true;
      if (msg.type === "port:close") drop(msg.portId);
      else if (msg.type === "port:presence") {
        if (msg.actorKey !== port.presenceActor) return true;
        presenceSource = msg.portId;
        try {
          if (msg.gone) presence.close(msg.portId);
          else presence.update(msg.portId, { actorKey: msg.actorKey, beat: msg.beat!, state: msg.state });
        } finally { presenceSource = undefined; }
      } else if (msg.type === "port:write") {
        if (port.queuedWrites >= maxQueuedWrites) {
          ctx.post(mkPortWritten({ portId: msg.portId, txId: msg.txId, status: "refused", applied: [], failed: [], reason: "write-queue-full" }));
          return true;
        }
        port.queuedWrites++;
        writes = writes.then(() => write(msg, ctx, port)).finally(() => { port.queuedWrites--; });
      } else if ((msg as { type: string }).type === "port:ack") {
        const cursor = log.parseCursor((msg as unknown as { cursor: string }).cursor);
        if (cursor && cursor.bootNonce === nonce && cursor.shapeId === log.shapeId(port.shape) && cursor.seq >= port.ackSeq && cursor.seq <= port.postedSeq) {
          port.ackSeq = cursor.seq;
          while (port.pending.length && port.pending[0]!.seq <= cursor.seq) port.pendingBytes -= port.pending.shift()!.bytes;
        }
      } else if (msg.type === "port:ask") {
        if (port.asksInFlight >= maxAsks) {
          ctx.post(mkPortAnswer({ portId: msg.portId, askId: msg.askId, status: "refused", reason: "ask-queue-full" }));
          return true;
        }
        port.asksInFlight++;
        void ask(msg, ctx, port).finally(() => { port.asksInFlight--; });
      }
      return true;
    },
  };
}
