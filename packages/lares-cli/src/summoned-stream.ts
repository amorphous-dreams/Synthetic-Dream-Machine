/**
 * summoned-stream — THE STREAM A SUMMONS STARTED THIS PROCESS UNDER (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts landing
 * 17). The host launch cap (`tools/summon-launch.mjs`) sets `LARES_SUMMONED` to the instance's `<pet>#<n>`, so a summoned
 * process's `lares msg` (and the seat's `msg`) lands on its own stream with none named, and a summons it runs forks off its
 * stream's head. Null where no summons started the process, or the name reads no stream (`<pet>#<n>`, lowercase).
 */
import { readStream } from "@lararium/tw5/stream-entries";

export function summonedStream(env: Readonly<Record<string, string | undefined>>): string | null {
  const word = (env["LARES_SUMMONED"] ?? "").trim();
  return word !== "" && readStream(word) !== null ? word : null;
}
