/**
 * face-join-intent — a face-join request as a live vessel takes it: an intent on the face's intents plane, pinned to the
 * founding hearth, answered by that hearth's door with an outcome the plane carries.
 *
 * `requestFaceJoin` runs `lares intent issue` on the vessel `lar` (the joinee's own vessel issues its
 * own request; a rig that stands a throwaway joinee names the summons). `faceJoinOutcome` reads the plane back through
 * `lares intent show` until the intent's winning outcome stands, and returns its receipt: names, counts, flags and reasons.
 */
import type { LarInstance } from "./instance.js";

const lastJson = (stdout: string): Record<string, unknown> => {
  const line = stdout.trim().split("\n").reverse().find((l) => l.startsWith("{"));
  if (!line) throw new Error(`no JSON line in: ${stdout.slice(-300)}`);
  return JSON.parse(line) as Record<string, unknown>;
};

/** Issue the request through `lares intent issue` on the vessel `lar`; `summons` omitted means that vessel's own card and edge. */
export async function requestFaceJoin(lar: LarInstance, summons?: Record<string, unknown>): Promise<string> {
  const out = await lar.cli(["intent", "issue", "face-join", ...(summons ? ["--args", JSON.stringify({ summons })] : [])]);
  const id = out.stdout.trim().split("\n").pop() ?? "";
  if (out.code !== 0 || !/^[0-9a-f]{64}$/.test(id)) throw new Error(`the face-join request refused (${out.code}): ${out.stderr.slice(-400)} ${out.stdout.slice(-200)}`);
  return id;
}

/** The receipt of the request's winning outcome, read through `lares intent show` until the plane holds one. */
export async function faceJoinOutcome(lar: LarInstance, id: string, boundMs = 90_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + boundMs;
  let last = "no read yet";
  while (Date.now() < deadline) {
    const shown = await lar.cli(["intent", "show", "--json"]);
    if (shown.code === 0) {
      const body = lastJson(shown.stdout);
      const won = (body["outcomes"] as Array<{ cause: string; winner: boolean; result: Record<string, unknown> }> | undefined)?.find((o) => o.cause === id && o.winner);
      if (won) return won.result;
      last = JSON.stringify({ rows: body["rows"], refused: body["refused"] }).slice(0, 400);
    } else last = shown.stderr.slice(-300);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const log = lar.bootLog().split("\n").filter((l) => /intent|face-join|face intent/i.test(l)).slice(-10).join("\n  ");
  throw new Error(`the hearth's door appended no outcome for ${id} within ${boundMs}ms: ${last}\n  daemon log:\n  ${log}`);
}
