import type { PortIslandToVesselMsg, PortWireRecord } from "@lararium/mesh/record-port";
import { preloadsFromCasBlob } from "./cas-preloads.js";

/** What a mirror boots from: the engine blob and the boot set's tiddlers, each verified against the name the vessel gave. */
export interface GlassBootInputs {
  coreBytes: Uint8Array;
  coreCid: string;
  preloadedTiddlers: Record<string, unknown>[];
  /** The vessel's word that its store rests sealed (S's row): the plugin gate opens on it and on nothing else. */
  sealedRest: boolean;
}
/** The names the vessel gives for a wiki's boot set: the CIDs its island booted from. The bytes come from the island, over the port. */
export interface GlassBootNames { coreCid: string; pluginCids: readonly string[]; sealedRest?: boolean }

const bytesOf = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/**
 * THE WHOLE HANDOFF, read off the port before any engine stands (`dreamdom-port-contract#/boot`). A server hands a browser its
 * store and the browser boots from it; here the island hands the port its boot set (`port:boot`: the engine blob, then each plugin
 * blob, verbatim) and then its records (`port:snapshot`), and the mirror boots from exactly that. The page reads no store of its
 * own: every byte its engine evaluates came from the vessel's island over this port.
 *
 * TWO SPEAKERS, ONE CHECK. The vessel names the CIDs (`names`); the island sends the bytes. A member whose joined bytes hash to
 * another value, a member no name covers, and a name no member answered each end the handoff by name. The island hashed the bytes
 * when it booted and again before it sent them; this third hash keeps the page's engine to the names its vessel spoke.
 *
 * `take` returns true once the first whole snapshot has landed; every message after it waits in `later` for the port adaptor.
 */
export function makeBootHandoff(names: GlassBootNames | null, portId: string, hash: (bytes: Uint8Array) => string) {
  const members = new Map<string, { n: number; parts: Map<number, Uint8Array> }>();
  const snapshots = new Map<string, { n: number; chunks: Map<number, PortWireRecord[]> }>();
  const later: PortIslandToVesselMsg[] = [];
  let records: PortWireRecord[] | null = null;
  return {
    take(msg: PortIslandToVesselMsg): boolean {
      if (msg.portId !== portId) return records !== null;
      if (records !== null) { later.push(msg); return true; }
      if (msg.type === "port:boot") {
        const member = members.get(msg.cid) ?? { n: msg.n, parts: new Map<number, Uint8Array>() };
        if (member.n !== msg.n) return false;
        members.set(msg.cid, member);
        member.parts.set(msg.i, bytesOf(msg.bytesBase64));
      } else if (msg.type === "port:snapshot") {
        const snapshot = snapshots.get(msg.snapshotId) ?? { n: msg.n, chunks: new Map<number, PortWireRecord[]>() };
        if (snapshot.n !== msg.n || msg.i < 1 || msg.i > msg.n) return false;
        snapshots.set(msg.snapshotId, snapshot);
        snapshot.chunks.set(msg.i, msg.records);
        if (snapshot.chunks.size === snapshot.n)
          records = Array.from({ length: snapshot.n }, (_, i) => snapshot.chunks.get(i + 1) ?? []).flat();
      }
      return records !== null;
    },
    /** The records of the first whole snapshot, in the island's order. */
    records(): PortWireRecord[] { return records ?? []; },
    /** Messages that arrived after the snapshot, in order; the adaptor takes them once it stands. */
    later(): PortIslandToVesselMsg[] { return later.splice(0); },
    /** The verified boot inputs, or a named refusal. */
    inputs(): GlassBootInputs {
      if (!names) throw new Error("mirror-boot-names-absent");
      const wanted = [names.coreCid, ...names.pluginCids].map(cid => cid.toLowerCase());
      for (const cid of members.keys()) if (!wanted.includes(cid)) throw new Error(`mirror-boot-member-unnamed:${cid}`);
      const whole = (cid: string): Uint8Array => {
        const member = members.get(cid);
        if (!member || member.parts.size !== member.n) throw new Error(`mirror-boot-member-missing:${cid}`);
        const parts = Array.from({ length: member.n }, (_, i) => member.parts.get(i + 1)!);
        const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
        let at = 0;
        for (const part of parts) { bytes.set(part, at); at += part.length; }
        if (hash(bytes) !== cid) throw new Error(`mirror-boot-member-mismatch:${cid}`);
        return bytes;
      };
      const coreBytes = whole(wanted[0]!);
      const preloadedTiddlers: Record<string, unknown>[] = [];
      for (const cid of wanted.slice(1)) {
        try { preloadedTiddlers.push(...preloadsFromCasBlob(whole(cid))); }
        catch (error) { if (error instanceof Error && error.message.startsWith("mirror-boot-member-")) throw error; throw new Error(`mirror-boot-member-unreadable:${cid}`); }
      }
      return { coreBytes, coreCid: wanted[0]!, preloadedTiddlers, sealedRest: names.sealedRest === true };
    },
  };
}
