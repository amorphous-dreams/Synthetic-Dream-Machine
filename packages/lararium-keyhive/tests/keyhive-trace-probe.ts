/**
 * keyhive-trace-probe — one reading shared by the two trace vectors: stand a provider, run acts that
 * trace when Keyhive's dispatcher stands, and return every line any console channel printed.
 *
 * The dispatcher installs once per wasm instance, and a test file holds one instance, so each vector
 * keeps its own file: one reads a process where nobody asked, the other a process where a person did.
 */
import { vi } from "vitest";

const CHANNELS = ["log", "info", "debug", "warn", "error", "trace"] as const;

/** A line Keyhive's dispatcher prints: its level, then a crate path; or the hook's own first words. */
export const TRACE_LINE = /\b(TRACE|DEBUG|INFO|WARN|ERROR)\b.*\b(keyhive_wasm|keyhive_core|keyhive_crypto|beekem)\b|We've just set panic hook/;

export async function linesOfAnAct(): Promise<string[]> {
  const said: string[] = [];
  const spies = CHANNELS.map((c) => vi.spyOn(console, c).mockImplementation((...a: unknown[]) => { said.push(a.map(String).join(" ")); }));
  try {
    const { KeyhiveProvider, InMemoryEventStore } = await import("../src/index.js");
    const p = new KeyhiveProvider();
    await p.init({ seed: new Uint8Array(32).fill(7), eventStore: new InMemoryEventStore() });
    await p.whoami();
    await p.exportArchive();
  } finally {
    for (const s of spies) s.mockRestore();
  }
  return said;
}
