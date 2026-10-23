/** The record port binds one island's store, log, asks, and clockless presence. */
import {
  readPortVesselMsg, mkPortAnswer, mkPortChanges, mkPortPresence, mkPortReset,
  mkPortSnapshot, mkPortWritten,
  type PortMsg_Open, type PortMsg_Ask, type PortMsg_Write, type PortMsg_Written, type PortWireRecord,
} from "@lararium/mesh/record-port";
import type { LarTiddlerRecord } from "@lararium/mesh";
import type { IslandCap } from "./island-caps.js";
import type { IslandContext } from "./island-context.js";
import { createPortLog, createTxLedger, validateTx, type PortEntry, type PortShape as LogShape } from "./record-port-log.js";
import { localFilter, projectRecord, load, type PortShape as ProjectionShape } from "./record-port-projection.js";
import { PresenceTracker } from "./record-port-presence.js";
import { gateInvoke, type AuthorityResult, type InvokeRequest } from "./record-port-invoke-gate.js";
import { RecordingDocument, cameraContainer, cameraDocument } from "./recording-document.js";
import { toBlocks, toLabelHtml, toText } from "./recording-serialisers.js";
import { mountCamera } from "./tw5-camera.js";

export interface RecordPortOptions {
  authority?: (req: InvokeRequest) => AuthorityResult;
  lapseRounds?: number;
  lagByteBudget?: number;
  retainEntries?: number;
  bootNonce?: string;
}

interface OpenPort {
  readonly open: PortMsg_Open;
  readonly shape: ProjectionShape;
  readonly logShape: LogShape;
  snapshotId?: string;
  readonly rendered: Map<string, { title: string; seq: number }>;
  readonly written: Map<string, PortMsg_Written>;
  readonly ledger: ReturnType<typeof createTxLedger>;
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

export function hasRecordPort(opts: RecordPortOptions = {}): IslandCap {
  const nonce = (opts.bootNonce ?? crypto.randomUUID()).replaceAll(".", "");
  const log = createPortLog({ bootNonce: nonce, lagByteBudget: opts.lagByteBudget ?? 1_048_576,
    ...(opts.retainEntries === undefined ? {} : { retainEntries: opts.retainEntries }) });
  const presence = new PresenceTracker(opts.lapseRounds);
  const ports = new Map<string, OpenPort>();
  const lastSeq = new Map<string, number>();
  let writes: Promise<void> = Promise.resolve();
  let presenceSource: string | undefined;

  const finish = (port: OpenPort): void => {
    if (port.snapshotId) log.finishSnapshot(port.snapshotId);
    delete port.snapshotId;
  };
  const drop = (portId: string): void => {
    const port = ports.get(portId);
    if (!port) return;
    finish(port);
    presence.close(portId);
    ports.delete(portId);
  };
  const postEntries = (ctx: IslandContext, port: OpenPort, entries: readonly PortEntry[]): void => {
    const kept = entries.filter(entry => visible(entry.title, port));
    if (!kept.length) return;
    ctx.post(mkPortChanges({ portId: port.open.portId, entries: kept.map(entry => projected(entry, port)),
      cursor: log.cursorOf(port.logShape, kept.at(-1)!.seq) }));
  };
  const open = async (msg: PortMsg_Open, ctx: IslandContext, port: OpenPort): Promise<void> => {
    if (msg.since) {
      const answer = log.changesSince(msg.since, port.logShape);
      if ("reset" in answer) ctx.post(mkPortReset({ portId: msg.portId, ...answer.reset }));
      else postEntries(ctx, port, answer.entries);
    } else {
      const entries = await ctx.composite.entries();
      if (ports.get(msg.portId) !== port) return;
      const records = entries.filter(entry => visible(entry.title, port)).map(entry => {
        const value = projectRecord({ title: entry.title, seq: lastSeq.get(entry.title) ?? 0,
          fields: fieldsOf(entry.record) }, port.shape);
        return { title: value.title, seq: value.seq ?? 0, fields: value.fields as Record<string, string>, omitted: [...value.omitted] };
      });
      try {
        const snapshot = log.openSnapshot(port.logShape, records, msg.maxBatchBytes);
        port.snapshotId = snapshot.snapshotId;
        for (const chunk of snapshot.chunks) {
          if (ports.get(msg.portId) !== port || port.snapshotId !== snapshot.snapshotId) break;
          ctx.post(mkPortSnapshot({ portId: msg.portId, snapshotId: snapshot.snapshotId,
            baseCursor: log.cursorOf(port.logShape, snapshot.baseSeq), i: chunk.i, n: chunk.n,
            records: chunk.records.map(record => ({ title: record.title, seq: record.seq ?? 0,
              fields: { ...record.fields },
              omitted: records.find(item => item.title === record.title)?.omitted ?? [],
              ...(record.deleted ? { deleted: true as const } : {}) })) }));
        }
        finish(port);
        const tail = log.changesSince(log.cursorOf(port.logShape, snapshot.baseSeq), port.logShape);
        if ("entries" in tail) postEntries(ctx, port, tail.entries);
      } catch {
        ctx.post(mkPortReset({ portId: msg.portId, reason: "lagged", floorSeq: log.floorSeq, headSeq: log.headSeq }));
      }
    }
    if (msg.presence) for (const value of presence.snapshotFor(msg.portId))
      ctx.post(mkPortPresence({ portId: msg.portId, ...value }));
  };
  const write = async (msg: PortMsg_Write, ctx: IslandContext, port: OpenPort): Promise<void> => {
    const answer = (status: "applied" | "partial" | "refused", applied: string[], failed: string[], reason?: string) => {
      const wire = mkPortWritten({ portId: msg.portId, txId: msg.txId, status, applied, failed,
        ...(reason ? { reason } : {}), cursor: log.cursorOf(port.logShape, log.headSeq) });
      if (status !== "refused") {
        port.written.set(msg.txId, wire);
        if (port.written.size > 1024) port.written.delete(port.written.keys().next().value!);
      }
      ctx.post(wire);
    };
    if (!port.open.edits) { answer("refused", [], [], "edits-not-granted"); return; }
    const prior = port.written.get(msg.txId);
    if (prior?.status === "applied") { ctx.post(prior); return; }
    if (!prior && msg.basis && msg.basis !== log.cursorOf(port.logShape, log.headSeq)) {
      answer("refused", [], [], "stale-basis"); return;
    }
    if (msg.records.some(record => record.bag && !ctx.composite.hasBag(record.bag))) {
      answer("refused", [], [], "bag-unavailable"); return;
    }
    const records = msg.records.map(record => ({ title: record.title, fields: record.fields,
      ...(record.tombstone ? { deleted: true } : {}) }));
    const verdict = validateTx(records, { maxRecordBytes: port.open.maxRecordBytes,
      maxBatchBytes: port.open.maxBatchBytes, validateRecord: record => localFilter(record.title) ? "local-title" : undefined });
    if ("refused" in verdict) { answer("refused", [], [], verdict.refused); return; }
    const families = [...new Set(msg.records.map(record => record.bag ?? "(default)"))];
    try {
      const begun = port.ledger.begin(msg.txId, families);
      if (begun.answer) {
        ctx.post(port.written.get(msg.txId) ?? mkPortWritten({ portId: msg.portId, txId: msg.txId,
          status: begun.answer.status, applied: [...begun.answer.applied], failed: [...begun.answer.failed],
          cursor: log.cursorOf(port.logShape, log.headSeq) }));
        return;
      }
      const failed: string[] = [];
      for (const family of begun.pending) {
        const members = msg.records.filter(record => (record.bag ?? "(default)") === family);
        const puts = members.filter(record => !record.tombstone).map(record => ({ tiddler: { ...record.fields, title: record.title } }));
        const tombstones = members.filter(record => record.tombstone).map(record => record.title);
        try {
          await ctx.composite.writeFamily(puts, tombstones,
            { kind: "tw-local", instanceId: `port:${msg.portId}:${msg.txId}` },
            family === "(default)" ? undefined : { bag: family });
          port.ledger.recordApplied(msg.txId, family);
        } catch { failed.push(...begun.pending.slice(begun.pending.indexOf(family))); break; }
      }
      const result = port.ledger.answer(msg.txId, failed);
      answer(result.status, [...result.applied], [...result.failed]);
    } catch (error) {
      answer("refused", [], [], error instanceof Error ? error.message : "write-failed");
    }
  };
  const ask = async (msg: PortMsg_Ask, ctx: IslandContext, port: OpenPort): Promise<void> => {
    const answered = (result: unknown) => ctx.post(mkPortAnswer({ portId: msg.portId, askId: msg.askId, status: "answered", result }));
    const refused = (reason: string) => ctx.post(mkPortAnswer({ portId: msg.portId, askId: msg.askId, status: "refused", reason }));
    if (msg.kind === "filter") {
      try { answered(ctx.tw5.$tw.wiki.filterTiddlers(msg.subject ?? "").filter(title => visible(title, port))); }
      catch { refused("filter-unavailable"); }
    } else if (msg.kind === "load") {
      const titles = msg.titles ?? (msg.subject ? [msg.subject] : []);
      const results = [];
      for (const title of titles) {
        if (!visible(title, port)) continue;
        const record = await ctx.composite.get(title);
        if (record && !record.meta?.deleted) results.push(load({ title, seq: lastSeq.get(title) ?? 0,
          fields: fieldsOf(record) }, msg.fields ?? []));
      }
      answered(results);
    } else if (msg.kind === "render") {
      const title = msg.subject ?? "";
      if (!title || !visible(title, port) || !port.open.renders?.includes(msg.form ?? "html")) {
        refused("render-unavailable"); return;
      }
      try {
        const document = new RecordingDocument();
        const container = document.createElement("div");
        const unmount = mountCamera(ctx.tw5, { rootTiddler: title, document: cameraDocument(document), container: cameraContainer(container) });
        const form = msg.form ?? "html";
        const value = form === "html" ? container.innerHTML : form === "text" ? toText(container) :
          form === "label-html" ? toLabelHtml(container) : toBlocks(container);
        unmount();
        if (typeof value === "object" && value !== null && "missing" in value) { refused("render-unavailable"); return; }
        const renderCursor = log.cursorOf(port.logShape, log.headSeq);
        port.rendered.set(renderCursor, { title, seq: lastSeq.get(title) ?? 0 });
        answered({ form, value, renderCursor });
      } catch { refused("render-unavailable"); }
    } else if (msg.kind === "invoke") {
      const req: InvokeRequest = { ...(msg.provenFace ? { provenFace: msg.provenFace } : {}),
        ...(msg.requestedBy ? { requestedBy: msg.requestedBy } : {}),
        renderCursor: msg.renderCursor ?? "", affordanceId: msg.affordanceId ?? "", action: msg.subject ?? "" };
      try {
        const result = gateInvoke(req, { ...(opts.authority ? { authority: opts.authority } : {}),
          currentRenderCursor: () => {
            const rendered = port.rendered.get(req.renderCursor);
            return rendered && (lastSeq.get(rendered.title) ?? 0) <= rendered.seq ? req.renderCursor : "";
          },
          invokeActions: request => {
            const wiki = ctx.tw5.$tw.wiki as unknown as { invokeActionString?: (action: string) => unknown };
            if (wiki.invokeActionString) return wiki.invokeActionString(request.action);
            const widget = ctx.tw5.$tw.rootWidget as unknown as { invokeActionString: (action: string) => unknown };
            return widget.invokeActionString(request.action);
          } });
        if (result.invoked) answered({ invoked: true }); else refused(result.reason);
      } catch { refused("invoke-unavailable"); }
    } else refused("ask-kind-not-wired");
  };

  return {
    name: "record-port",
    onEa(ctx) {
      const unsubscribe = ctx.composite.subscribe(change => {
        const match = change.origin.kind === "tw-local" ? /^port:([^:]+):(.+)$/.exec(change.origin.instanceId) : null;
        const causedBy = match ? [match[2]!] : [];
        const entry = { title: change.title, fields: change.record ? fieldsOf(change.record) : {},
          deleted: change.record === null || change.record.meta?.deleted === true };
        const { seq } = log.append([entry], causedBy);
        lastSeq.set(change.title, seq);
        const logged: PortEntry = { ...entry, seq, causedBy };
        for (const port of ports.values()) postEntries(ctx, port, [logged]);
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
        for (const [id, prior] of ports) if (prior.open.actor === msg.actor || id === msg.portId) {
          if (id === msg.portId) presence.close(id);
          else presence.supersede(prior.open.actor, msg.portId);
          drop(id);
        }
        const shape: ProjectionShape = { width: msg.width,
          ...(msg.localFilter ? { localFilter: msg.localFilter } : {}),
          ...(msg.fields ? { fields: msg.fields } : {}) };
        const logShape: LogShape = { width: msg.width,
          localFilter: JSON.stringify([...(msg.localFilter ?? [])].sort()), fields: msg.fields ?? [] };
        const port: OpenPort = { open: msg, shape, logShape, rendered: new Map(), written: new Map(),
          ledger: createTxLedger() };
        ports.set(msg.portId, port);
        void open(msg, ctx, port);
        return true;
      }
      const port = ports.get(msg.portId);
      if (!port) return true;
      if (msg.type === "port:close") drop(msg.portId);
      else if (msg.type === "port:presence") {
        presenceSource = msg.portId;
        try {
          if (msg.gone) presence.close(msg.portId);
          else presence.update(msg.portId, { actorKey: msg.actorKey, beat: msg.beat!, state: msg.state });
        } finally { presenceSource = undefined; }
      } else if (msg.type === "port:write") {
        writes = writes.then(() => write(msg, ctx, port));
      } else if (msg.type === "port:ask") void ask(msg, ctx, port);
      return true;
    },
  };
}
