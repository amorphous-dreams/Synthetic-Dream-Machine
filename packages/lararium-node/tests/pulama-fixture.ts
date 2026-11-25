/**
 * pulama-fixture — one scratch custody with TWO holders over the same store: the in-process holder a vessel seats today, and a
 * pūlama's own holder behind a server, reached through a `PulamaHolder` over an in-memory channel pair.
 */
import { FLOOR_REST_KEY_INFO, GATE_BUNDLE_INFO, KUKULU_VOUCH_DOMAIN } from "@lararium/mesh/domains";
import { lentFacesOf, type LentFaces } from "@lararium/mesh/lent-faces";
import { mintFck, type FaceCustodyKey } from "@lararium/mesh/fck";
import { type TreeKey } from "@lararium/mesh/tree-key";
import { makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import { makePulamaHolder, type PulamaHolder } from "../src/pulama-holder.js";
import { servePulama, type PulamaGate, type PulamaScope, type PulamaServer } from "../src/pulama-server.js";
import { pulamaChannelPair, type PulamaChannel } from "../src/pulama-wire.js";
import { FIXTURE_PASSPHRASE, seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

export const SESSION_DERIVES = [FLOOR_REST_KEY_INFO, GATE_BUNDLE_INFO, KUKULU_VOUCH_DOMAIN] as const;
export const fixtureRoute = [{ kind: "passphrase" as const, passphrase: FIXTURE_PASSPHRASE }];
export const fixtureSlots = [{ t: 1, pins: [{ kind: "passphrase" as const, passphrase: FIXTURE_PASSPHRASE }] }];

/** The lent set over these faces: ordinals, or `{fcid, ordinal}` where the admission names a custody id. */
export function lend(...faces: ReadonlyArray<number | { readonly fcid: string; readonly ordinal: number }>): LentFaces {
  const parsed = lentFacesOf(faces);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.faces;
}

/** A gate that admits every hello under one scope. */
export const openGate = (scope: PulamaScope): PulamaGate => ({ admit: async () => ({ ok: true, scope }) });

export interface PulamaFixture {
  readonly seat: SeatedScratchCustody;
  /** The in-process holder a vessel seats today. */
  readonly local: CustodyHolder;
  /** The pūlama's own holder, over the same store. */
  readonly kept: CustodyHolder;
  readonly server: PulamaServer;
  /** Every face key the pūlama's holder minted or opened through its minter. */
  readonly faceKeys: FaceCustodyKey[];
  readonly treeKey: TreeKey;
  /** Every line each end of every channel sent. */
  readonly lines: { readonly fromVessel: string[]; readonly fromPulama: string[] };
  /** A vessel-side holder over a fresh channel pair; `channel` reads the vessel's end of the latest pair. `life` rides the hello
   *  beside the offer, as a vessel names the life id its store claim minted; absent, the hello names no life. */
  vessel(offer?: unknown, life?: unknown): PulamaHolder;
  channel(): PulamaChannel | null;
  drop(): Promise<void>;
}

export async function standPulama(label: string, gate: (kept: CustodyHolder) => PulamaGate): Promise<PulamaFixture> {
  const seat = await seatScratchCustody(label);
  const faceKeys: FaceCustodyKey[] = [];
  const kept = makeCustodyHolder({ io: seat.io, homes: seat.homes, mintFck: () => { const k = mintFck(); faceKeys.push(k); return k; } });
  await kept.adopt(seat.treeKey);
  const server = servePulama({ holder: kept, gate: gate(kept), derives: SESSION_DERIVES });
  const lines = { fromVessel: [] as string[], fromPulama: [] as string[] };
  let latest: PulamaChannel | null = null;
  return {
    seat, local: seat.holder, kept, server, faceKeys, treeKey: seat.treeKey, lines,
    vessel(offer = {}, life?: unknown) {
      return makePulamaHolder({
        homes: seat.homes,
        offer: () => offer,
        ...(life !== undefined ? { life: () => life } : {}),
        dial: async () => {
          const pair = pulamaChannelPair();
          // The pair's own line logs fold into the fixture's, so a witness scans every channel a test opened.
          const tap = (sent: string[], into: string[]): void => { const push = sent.push.bind(sent); sent.push = (...l: string[]) => { into.push(...l); return push(...l); }; };
          tap(pair.lines.fromVessel, lines.fromVessel);
          tap(pair.lines.fromPulama, lines.fromPulama);
          server.accept(pair.pulama);
          latest = pair.vessel;
          return pair.vessel;
        },
      });
    },
    channel: () => latest,
    async drop() { await server.lock(); await seat.drop(); },
  };
}
