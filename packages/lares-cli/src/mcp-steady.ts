/**
 * mcp-steady — the Node host's binding of the steady seat: `lares mcp steady -- <child argv…>`.
 *
 * The core (`@lararium/mesh/steady-seat`) holds the seat as a pure frame machine. This binding hands it the two ports a Node
 * host owns: the client on this process's stdin and stdout, and the surface as a `child_process` it spawns from the argv after
 * `--`. Each stream carries JSON-RPC as MCP's stdio transport frames it: one message per line.
 *
 * THE BINDING OWNS THE PACING. The core reads no clock; it emits `spawn` while no child stands. The first spawn, and the
 * first after a child stood, runs at once. Each spawn after a failed one waits on this binding's timer: `firstMs`, doubling
 * up to `capMs`; a child the core reports `standing` starts the pacing over. A surface down for hours costs one spawn per
 * `capMs`.
 *
 * IT LOGS NO PAYLOAD AND HOLDS NO KEY. Every line it writes to stderr reads `steady-seat: <event> generation=N pending=N`:
 * the core's own event names, plus `frame-unparsed` for a line that parses as no JSON. No frame's bytes reach the log. This
 * module imports the core and Node's own modules, nothing of custody, the vessel or the house root. The child's stderr passes
 * through untouched, as it does with no seat between.
 *
 * The seat ends when the client closes its stream (or this process reads a stop signal), and never on a child's death.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { steadySeat, type SeatEvent, type SeatFrame } from "@lararium/mesh/steady-seat";

export interface SteadySeatPacing { readonly firstMs: number; readonly capMs: number }
export const STEADY_SEAT_PACING: SteadySeatPacing = { firstMs: 250, capMs: 15_000 };

export interface SteadySeatHostOptions {
  /** The surface's command and arguments, spawned as written (no shell). */
  readonly argv: readonly string[];
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
  readonly env?: NodeJS.ProcessEnv;
  readonly pacing?: SteadySeatPacing;
}

export interface SteadySeatHost {
  /** Settles with the seat's exit code once the client closed and the seat let its child go. */
  readonly done: Promise<number>;
  /** End the seat as the client's close does. */
  close(): void;
}

/** Split a byte stream into lines; a line that parses as no JSON reports `null`. */
function lines(stream: NodeJS.ReadableStream, each: (frame: unknown, parsed: boolean) => void): void {
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  stream.on("data", (chunk: Buffer | string) => {
    buffer += typeof chunk === "string" ? chunk : decoder.write(chunk);
    for (let at = buffer.indexOf("\n"); at !== -1; at = buffer.indexOf("\n")) {
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (line === "") continue;
      let frame: unknown;
      try { frame = JSON.parse(line); } catch { each(null, false); continue; }
      each(frame, true);
    }
  });
}

export function steadySeatHost(opts: SteadySeatHostOptions): SteadySeatHost {
  const seat = steadySeat();
  const pacing = opts.pacing ?? STEADY_SEAT_PACING;
  let child: ChildProcess | null = null;
  let timer: NodeJS.Timeout | null = null;
  let wait = 0, generation = 0, pending = 0, ended = false;
  let finish!: (code: number) => void;
  const done = new Promise<number>((resolve) => { finish = resolve; });

  const note = (event: string): void => { opts.stderr.write(`steady-seat: ${event} generation=${generation} pending=${pending}\n`); };
  const write = (stream: NodeJS.WritableStream | null | undefined, frame: SeatFrame): void => {
    if (stream && (stream as { writable?: boolean }).writable !== false) stream.write(`${JSON.stringify(frame)}\n`);
  };

  function release(): void {
    const c = child;
    child = null;
    if (!c) return;
    c.kill("SIGTERM");
    c.stdin?.destroy(); c.stdout?.destroy();
    c.unref();
  }

  function raise(): void {
    if (ended) return;
    let down = false;
    const c = spawn(opts.argv[0]!, opts.argv.slice(1), { stdio: ["pipe", "pipe", "inherit"], env: opts.env ?? process.env });
    child = c;
    const fell = (): void => {
      if (down) return;
      down = true;
      if (child === c) child = null;
      feed({ type: "child-down" });
    };
    c.once("spawn", () => { if (!down) feed({ type: "child-up" }); });
    c.once("error", fell);
    // `close` follows the child's last byte, so every frame it wrote reaches the core before its death does.
    c.once("close", fell);
    c.stdin!.on("error", () => { /* a dying child's pipe: its `close` reports the death */ });
    lines(c.stdout!, (frame, parsed) => {
      if (down || child !== c) return;
      if (!parsed) { note("frame-unparsed"); return; }
      feed({ type: "child-frame", frame });
    });
  }

  function feed(event: SeatEvent): void {
    for (const effect of seat.step(event)) {
      switch (effect.type) {
        case "to-client": write(opts.stdout, effect.frame); break;
        case "to-child": write(child?.stdin, effect.frame); break;
        case "log": generation = effect.generation; pending = effect.pending; note(effect.event); break;
        case "standing": wait = 0; break;
        case "kill": release(); break;
        case "spawn":
          if (ended || timer !== null) break;
          timer = setTimeout(() => { timer = null; raise(); }, wait);
          wait = wait === 0 ? pacing.firstMs : Math.min(wait * 2, pacing.capMs);
          break;
        case "exit":
          ended = true;
          if (timer !== null) { clearTimeout(timer); timer = null; }
          release();
          finish(0);
          break;
      }
    }
  }

  const close = (): void => { if (!ended) feed({ type: "client-closed" }); };
  lines(opts.stdin, (frame, parsed) => {
    if (ended) return;
    if (!parsed) { note("frame-unparsed"); return; }
    feed({ type: "client-frame", frame });
  });
  opts.stdin.once("end", close);
  opts.stdin.once("close", close);
  // A client that went away leaves a broken pipe behind: the seat closes as it does on the stream's end.
  opts.stdout.on("error", close);
  opts.stderr.on("error", () => { /* a log with no reader stops nothing */ });
  feed({ type: "start" });
  return { done, close };
}

export const STEADY_USAGE = "usage: lares mcp steady -- <child argv…>   hold this client's MCP seat, and spawn the surface as a child that may fall and rise";

/** The process entry: this process's own stdio, its stop signals, and its exit code. */
export async function steadySeatMain(argv: readonly string[]): Promise<number> {
  if (argv.length === 0) { process.stderr.write(`${STEADY_USAGE}\n`); return 2; }
  const host = steadySeatHost({ argv, stdin: process.stdin, stdout: process.stdout, stderr: process.stderr });
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.once(signal, () => host.close());
  const code = await host.done;
  // The client's stream closed; stdin may still hold the loop open on a terminal.
  process.stdin.pause();
  return code;
}
