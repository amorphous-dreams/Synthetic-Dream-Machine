/**
 * `lares sense flow` names the vessel's OWN daemon socket in its own words.
 *
 * The capture route ends at this vessel's owner-only daemon socket. When no daemon answers there, the
 * surface says so plainly; it never borrows the herm's closed-door phrase ("route unavailable"), which
 * names a different relation: an HTTP path a peer reached and the house refuses.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

let socketUp = false;

vi.mock("../src/local-connector.js", () => ({ udsAlive: async () => socketUp }));
vi.mock("../src/palace-procs.js", () => ({ livePalaceProcs: () => [] }));
vi.mock("../src/port-control.js", () => ({ portHolderPids: () => [] }));

const { cmdFlow } = await import("../src/commands/flow.js");
/** The herm's closed-door body (`CLOSED_DOOR.body`, `@lararium/node` `bulb-routes.ts`), a different relation. */
const CLOSED_DOOR_BODY = "route unavailable";

async function humanDaemonLine(): Promise<string> {
  const lines: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { lines.push(a.join(" ")); });
  try {
    await cmdFlow({ command: "sense", positional: ["flow"], options: {}, flags: { json: false } });
  } finally {
    log.mockRestore();
  }
  const line = lines.find((l) => l.trimStart().startsWith("daemon:"));
  expect(line, "the flow surface prints a daemon line").toBeDefined();
  return line!;
}

afterEach(() => { socketUp = false; });

describe("lares sense flow — the daemon line", () => {
  it("names a socket with no daemon behind it in its own words, never the closed door's", async () => {
    socketUp = false;
    const line = await humanDaemonLine();
    expect(line).not.toContain(CLOSED_DOOR_BODY);
    expect(line).toMatch(/no daemon answers on this vessel's own socket/);
  });

  it("names a live socket as the capture route's end (CONTROL)", async () => {
    socketUp = true;
    const line = await humanDaemonLine();
    expect(line).not.toContain(CLOSED_DOOR_BODY);
    expect(line).toMatch(/the capture route reaches it/);
  });
});
