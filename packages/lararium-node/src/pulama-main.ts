/**
 * pulama-main — the pūlama's process: it holds a vessel's custody through the vessel's rebuild.
 *
 * Usage (each inside the pūlama's own container or process):
 *   node dist/src/pulama-main.js serve              stand the pūlama: the vessel socket, the hand door, no key held
 *   node dist/src/pulama-main.js light              the operator lights it: reads the route on a real terminal, no echo
 *   node dist/src/pulama-main.js admit [face]       the operator admits the image the host reports: reads the route on a real
 *                                                   terminal, proves it against the lit holder, opens nothing
 *   node dist/src/pulama-main.js unadmit <digest>   the operator ends an image's admission: reads the route on a real terminal,
 *                                                   proves it, and rests a signed tombstone naming the admission's tessera
 *   node dist/src/pulama-main.js lock               drop every session, zero-fill every key
 *   node dist/src/pulama-main.js status             lit or not, faces open, sessions, attempts left, the reported image
 *   node dist/src/pulama-main.js image <digest>     the host shim reports the image digest it raises; as
 *                                                   `image '{"digest":…,"seed":…}'` it carries beside it the seed line the
 *                                                   host read (the seed that image offers beside the founding record)
 *   node dist/src/pulama-main.js tessera            print the pūlama's signed tessera halves
 *
 * Environment (every name required for `serve`; the hand verbs need `LAR_PULAMA_HAND` alone):
 *   LAR_ROOT            the house root whose hearth this pūlama keeps (the same root the vessel names)
 *   LAR_PULAMA_SOCKET   the unix socket vessels dial; its directory mounts in the pūlama and the vessel, and nowhere else
 *   LAR_PULAMA_HAND     the hand door's unix socket; its directory rests inside the pūlama alone
 *   LAR_PULAMA_STATE    the pūlama's own state directory (signed records, the image report); no vessel mounts it
 *
 * ── THE PŪLAMA STARTS UNLIT AND ENDS DARK ───────────────────────────────────────────────────────
 * A start holds no key: only `light`, by the operator's own hand on a real terminal, opens one, and nothing an unlock
 * did touches disk, so a restart returns to the floor. SIGTERM and SIGINT lock before the process leaves: every session
 * drops and every key zero-fills. The pūlama takes no store claim and opens no document; it reads and writes custody
 * carriers through the same port and the same cross-process claim a vessel's holder uses.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { chmodSync, mkdirSync, rmSync } from "node:fs";
import { connect, createServer } from "node:net";
import { dirname } from "node:path";
import { makeCustodyHolder } from "./custody-holder.js";
import { FsCustodyIo } from "./custody-io.js";
import { PULAMA_SESSION_DERIVES, kukuluGate } from "./kukulu-gate.js";
import { kukuluRiteOver } from "./kukulu-lei-seat.js";
import { seatCustody } from "./custody-seat.js";
import { loadIdentityAnchors } from "./identity-anchors.js";
import { loadPersonaGroupRootVerifyingKey } from "./node-vessel-identity.js";
import { pulamaAdmissions } from "./pulama-admit.js";
import { pulamaHandDoor, type PulamaHandAnswer } from "./pulama-hand.js";
import { PulamaVerbUsage, readRoute, runHandVerb } from "./pulama-verbs.js";
import { servePulama } from "./pulama-server.js";
import { listenPulama, socketPathFits } from "./pulama-socket.js";
import { pulamaImage, pulamaRecords } from "./pulama-state.js";
import { vesselCustodyHomes } from "./vault-carriers.js";
import { wardCredential } from "./ward-credential.js";
import { wardRootSigner } from "./ward-signer.js";

class PulamaUnnamed extends Error {
  override readonly name = "PulamaUnnamed";
  constructor(variable: string) { super(`${variable} names nothing: the pūlama resolves no default for it`); }
}
const named = (variable: string): string => {
  const value = process.env[variable]?.trim();
  if (!value) throw new PulamaUnnamed(variable);
  return value;
};

async function serve(): Promise<void> {
  named("LAR_ROOT");
  const socket = socketPathFits(named("LAR_PULAMA_SOCKET")), hand = socketPathFits(named("LAR_PULAMA_HAND")), state = named("LAR_PULAMA_STATE");
  const homes = vesselCustodyHomes();
  const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
  // The pūlama's holder sits in this process's one custody seat, so the roster's reader reaches it and no other holder.
  seatCustody(holder);
  const records = pulamaRecords(state), image = pulamaImage(state), admissions = pulamaAdmissions(records);
  const log = (line: string): void => console.log(`[pulama] ${line}`);
  const server = servePulama({
    holder, derives: PULAMA_SESSION_DERIVES, onLog: log,
    // THE HAND'S KEY reads off the face's own roster row, through this pūlama's seated holder.
    gate: kukuluGate({ holder, hand: (ordinal) => loadPersonaGroupRootVerifyingKey(ordinal), rite: kukuluRiteOver(records), image: () => image.raised(), admissions }),
  });
  // THE LEI HAND reads the face's group off its anchors row and opens its root fresh under the route, through this seated holder.
  const lei = {
    group: async (ordinal: number) => (await loadIdentityAnchors(ordinal).catch(() => null))?.personaGroupId ?? null,
    signer: (ordinal: number, credentials: Parameters<typeof wardCredential>[0]) => wardRootSigner(ordinal, wardCredential(credentials), `the face root at h${ordinal}, for a lei at the pūlama's hand door`),
  };
  const door = pulamaHandDoor({ holder, server, image, records, admissions, lei, onLog: log });

  // THE VESSEL SOCKET CLAIMS FIRST: a second pūlama over the same socket refuses here, before it touches a hand door.
  const listener = await listenPulama(socket, (channel) => server.accept(channel));
  mkdirSync(dirname(hand), { recursive: true, mode: 0o700 });
  rmSync(hand, { force: true });
  const handServer = createServer((sock) => {
    let buffered = "";
    sock.setEncoding("utf8");
    sock.on("error", () => sock.destroy());
    sock.on("data", (chunk: string) => {
      buffered += chunk;
      const at = buffered.indexOf("\n");
      if (at < 0) return;
      let frame: unknown = null;
      try { frame = JSON.parse(buffered.slice(0, at)); } catch { /* answers unknown-act */ }
      buffered = "";
      door(frame).then(
        (answer) => sock.end(JSON.stringify(answer) + "\n"),
        () => sock.end(JSON.stringify({ op: "fault", reading: "hand-act-faulted" }) + "\n"),
      );
    });
  });
  await new Promise<void>((resolve, reject) => { handServer.once("error", reject); handServer.listen(hand, resolve); });
  chmodSync(hand, 0o600);
  log(`standing unlit at ${socket}; the operator lights it by hand: node dist/src/pulama-main.js light`);

  let leaving = false;
  const leave = (signal: string): void => {
    if (leaving) return;
    leaving = true;
    log(`${signal}: locking before the process leaves`);
    void (async () => {
      try { await server.lock(); } finally {
        await listener.close().catch(() => undefined);
        handServer.close();
        rmSync(hand, { force: true });
        process.exit(0);
      }
    })();
  };
  process.on("SIGTERM", () => leave("SIGTERM"));
  process.on("SIGINT", () => leave("SIGINT"));
}

/** Send one frame to the hand door and read its one answer. */
function askHand(frame: Readonly<Record<string, unknown>>): Promise<PulamaHandAnswer> {
  const hand = socketPathFits(named("LAR_PULAMA_HAND"));
  return new Promise((resolve, reject) => {
    const sock = connect(hand);
    let buffered = "";
    sock.setEncoding("utf8");
    sock.once("error", (err: NodeJS.ErrnoException) => reject(new Error(`no pūlama answers its hand door at ${hand} (${err.code ?? err.message})`)));
    sock.on("data", (chunk: string) => { buffered += chunk; });
    sock.on("end", () => { try { resolve(JSON.parse(buffered) as PulamaHandAnswer); } catch { reject(new Error("the hand door answered no frame")); } });
    sock.once("connect", () => sock.write(JSON.stringify(frame) + "\n"));
  });
}

async function main(): Promise<void> {
  const [verb = "serve", ...args] = process.argv.slice(2);
  if (verb === "serve") return serve();
  try {
    console.log(JSON.stringify(await runHandVerb(verb, verb === "admit" ? args : args.length === 1 ? args[0] : args.length === 0 ? undefined : args, { ask: askHand, route: (label, what) => readRoute(label, what) }), null, 2));
  } catch (err) {
    if (!(err instanceof PulamaVerbUsage)) throw err;
    console.error(err.message);
    process.exit(2);
  }
}

main().catch((err: unknown) => {
  console.error(`[pulama] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
