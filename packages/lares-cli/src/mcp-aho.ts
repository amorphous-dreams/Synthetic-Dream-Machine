/**
 * mcp-aho — the aho (the cord): the seat a Node host holds across its vessel's sleep, `lares mcp aho`.
 *
 * THE VERB STANDS ALONE IN A HARNESS CONFIG. `lares mcp aho` resolves its own child at each spawn (`mcp-aho-child.ts`): the
 * house's surface, container or native. `lares mcp aho -- <child argv…>` names one instead, for a test or another surface.
 *
 * The core (`@lararium/mesh/iris`) holds the seat as a pure frame machine. This binding hands it the two ports a Node
 * host owns: the client on this process's stdin and stdout, and the surface as a `child_process` it spawns from the argv after
 * `--`. Each stream carries JSON-RPC as MCP's stdio transport frames it: one message per line.
 *
 * THE BINDING OWNS THE PACING. The core reads no clock; it emits `spawn` while no child stands. The first spawn, and the
 * first after a child stood, runs at once. Each spawn after a failed one waits on this binding's timer: `firstMs`, doubling
 * up to `capMs`; a child the core reports `standing` starts the pacing over. A surface down for hours costs one spawn per
 * `capMs`.
 *
 * IT LOGS NO PAYLOAD AND HOLDS NO KEY. Every line it writes to stderr reads `aho: <event> generation=N pending=N`:
 * the core's own event names, plus `frame-unparsed` for a line that parses as no JSON. No frame's bytes reach the log. This
 * module imports the core and Node's own modules, nothing of custody, the vessel or the house root. The child's stderr passes
 * through untouched, as it does with no seat between.
 *
 * A CHILD'S DEATH STAYS BOUNDED. A child the seat stops, or one whose stdout ended, gets the polite signal and then, after
 * `killMs` on this binding's timer, the hard kill (`child-kill-escalated` in the log), so a child that ignores its stop never
 * holds the seat without a surface.
 *
 * The seat ends when the client closes its stream (or this process reads a stop signal), and never on a child's death.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { iris, type IrisEvent, type IrisFrame } from "@lararium/mesh/iris";

/** `killMs`: how long a child the seat stopped may take to die before the hard kill (the watchdog's wait). */
export interface AhoPacing { readonly firstMs: number; readonly capMs: number; readonly killMs?: number }
export const AHO_PACING: AhoPacing = { firstMs: 250, capMs: 15_000, killMs: 5_000 };

/** One child as a resolver names it: its argv, and the env it adds to this process's own. */
export interface AhoChild { readonly argv: readonly string[]; readonly env?: Readonly<Record<string, string>> }

export interface AhoHostOptions {
  /** The surface's command and arguments, spawned as written (no shell); or a resolver the aho asks at EACH spawn, so what
   *  stands beneath the seat may change between two children. A resolver that names none reads as a spawn that failed. */
  readonly argv: readonly string[] | (() => AhoChild | null);
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
  readonly env?: NodeJS.ProcessEnv;
  readonly pacing?: AhoPacing;
}

export interface AhoHost {
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

export function ahoHost(opts: AhoHostOptions): AhoHost {
  const seat = iris();
  const pacing = opts.pacing ?? AHO_PACING;
  let child: ChildProcess | null = null;
  let timer: NodeJS.Timeout | null = null;
  let wait = 0, generation = 0, pending = 0, ended = false;
  let finish!: (code: number) => void;
  const done = new Promise<number>((resolve) => { finish = resolve; });

  const note = (event: string): void => { opts.stderr.write(`aho: ${event} generation=${generation} pending=${pending}\n`); };
  const write = (stream: NodeJS.WritableStream | null | undefined, frame: IrisFrame): void => {
    if (stream && (stream as { writable?: boolean }).writable !== false) stream.write(`${JSON.stringify(frame)}\n`);
  };

  /**
   * THE WATCHDOG BOUNDS A CHILD'S DEATH. A child the seat stops gets the polite signal, and one that still lives after
   * `killMs` gets the hard kill, so its `close` always arrives and the core always hears the death that lets a fresh child
   * stand. The wait rides this binding's own timer; the core reads none.
   */
  function stop(c: ChildProcess): void {
    const lives = (): boolean => c.exitCode === null && c.signalCode === null;
    if (!lives()) return;
    c.kill("SIGTERM");
    const dog = setTimeout(() => { if (lives()) { note("child-kill-escalated"); c.kill("SIGKILL"); } }, pacing.killMs ?? AHO_PACING.killMs);
    c.once("exit", () => clearTimeout(dog));
  }

  function release(): void {
    const c = child;
    child = null;
    if (!c) return;
    c.stdin?.destroy(); c.stdout?.destroy();
    stop(c);
  }

  function raise(): void {
    if (ended) return;
    let named: AhoChild | null;
    try { named = typeof opts.argv === "function" ? opts.argv() : { argv: opts.argv }; } catch { named = null; }
    if (named === null || named.argv.length === 0) { note("child-unresolved"); feed({ type: "child-down" }); return; }
    let down = false;
    const c = spawn(named.argv[0]!, named.argv.slice(1), { stdio: ["pipe", "pipe", "inherit"], env: { ...(opts.env ?? process.env), ...named.env } });
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
    // A child whose stdout ended can answer nothing more: the seat stops it, and the watchdog bounds how long it lingers.
    c.stdout!.once("end", () => { if (!down) stop(c); });
    lines(c.stdout!, (frame, parsed) => {
      if (down || child !== c) return;
      if (!parsed) { note("frame-unparsed"); return; }
      feed({ type: "child-frame", frame });
    });
  }

  function feed(event: IrisEvent): void {
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

export const AHO_USAGE = "usage: lares mcp aho [-- <child argv…>]   hold this client's MCP seat; the surface runs as a child that may fall and rise (the house's own, unless the line names one)";

/** The process entry: this process's own stdio, its stop signals, and its exit code. */
export async function ahoMain(argv: readonly string[] | null): Promise<number> {
  if (argv !== null && argv.length === 0) { process.stderr.write(`${AHO_USAGE}\n`); return 2; }
  // A line that names no child takes the house's own surface, resolved again at each spawn (`mcp-aho-child.ts`).
  const child = argv ?? (await import("./mcp-aho-child.js")).resolveAhoChild;
  const host = ahoHost({ argv: child, stdin: process.stdin, stdout: process.stdout, stderr: process.stderr });
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.once(signal, () => host.close());
  const code = await host.done;
  // The client's stream closed; stdin may still hold the loop open on a terminal.
  process.stdin.pause();
  return code;
}
