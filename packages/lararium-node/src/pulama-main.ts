/**
 * pulama-main — the pūlama's process: it holds a vessel's custody through the vessel's rebuild.
 *
 * Usage (each inside the pūlama's own container or process):
 *   node dist/src/pulama-main.js serve              stand the pūlama: the vessel socket, the hand door, no key held
 *   node dist/src/pulama-main.js light              the operator lights it: reads the route on a real terminal, no echo
 *   node dist/src/pulama-main.js lock               drop every session, zero-fill every key
 *   node dist/src/pulama-main.js status             lit or not, faces open, sessions, attempts left, the reported image
 *   node dist/src/pulama-main.js image <digest>     the host shim reports the image digest it raises
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
import { kukuluLeiOver } from "./kukulu-lei-seat.js";
import { pulamaHandDoor, type PulamaHandAnswer } from "./pulama-hand.js";
import { servePulama } from "./pulama-server.js";
import { listenPulama, socketPathFits } from "./pulama-socket.js";
import { pulamaImage, pulamaRecords, pulamaTessera } from "./pulama-state.js";
import { vesselCustodyHomes } from "./vault-carriers.js";

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
  const records = pulamaRecords(state), image = pulamaImage(state);
  const log = (line: string): void => console.log(`[pulama] ${line}`);
  const server = servePulama({
    holder, derives: PULAMA_SESSION_DERIVES, onLog: log,
    gate: kukuluGate({ holder, lei: kukuluLeiOver(records), image: () => image.raised(), tessera: pulamaTessera(records) }),
  });
  const door = pulamaHandDoor({ holder, server, image, records, onLog: log });

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

/** Read the operator's route from a real terminal, with no echo. Anything but a terminal refuses: the route rides no pipe and no flag. */
function readRoute(label: string): Promise<string> {
  const { stdin, stderr } = process;
  if (!stdin.isTTY) return Promise.reject(new Error("the pūlama lights only from a real terminal: its route rides no pipe, no flag and no environment"));
  return new Promise((resolve, reject) => {
    stderr.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let line = "";
    const done = (act: () => void): void => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", onData); stderr.write("\n"); act(); };
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done(() => resolve(line));
        if (ch === "\u0003" || ch === "\u0004") return done(() => reject(new Error("left unlit")));
        if (ch === "\u007f" || ch === "\b") line = line.slice(0, -1);
        else if (ch >= " ") line += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const [verb = "serve", arg] = process.argv.slice(2);
  if (verb === "serve") return serve();
  const print = (answer: PulamaHandAnswer): void => console.log(JSON.stringify(answer, null, 2));
  if (verb === "light") {
    const passphrase = await readRoute("pūlama route: ");
    return print(await askHand({ op: "light", credentials: [{ kind: "passphrase", passphrase }] }));
  }
  if (verb === "lock" || verb === "status" || verb === "tessera") return print(await askHand({ op: verb }));
  if (verb === "image" && arg) return print(await askHand({ op: "image", digest: arg }));
  console.error("usage: pulama-main.js serve | light | lock | status | image <digest> | tessera");
  process.exit(2);
}

main().catch((err: unknown) => {
  console.error(`[pulama] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
