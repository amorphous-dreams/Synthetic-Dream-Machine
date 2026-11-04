/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/lararium-writable
type: application/javascript
module-type: startup
\*/
/**
 * The mirror needs this task too: TW5 leaves dependents of a missing task unrun.
 * It needs no port-ready gate: the mirror holds no authority and the port snapshot
 * overwrites pre-attach writes. A faulted stand detaches its backing before this
 * task settles and dependents run.
 */
export const name = "lararium-writable";
export const after = ["load-modules", "lararium-nalu-engine", "startup"];
export const synchronous = false;

type Outcome = { state: string; reason?: string };
declare const $tw: {
  larariumWritableStand?: () => Promise<Outcome | void>;
  larariumWritableFault?: unknown;
  Tiddler: new (fields: Record<string, unknown>) => unknown;
  wiki: { addTiddler(tiddler: unknown): void };
};

export function startup(done: () => void): void {
  const stand = $tw.larariumWritableStand;
  delete $tw.larariumWritableStand;
  // A stock client or the mirror stands nothing: the task settles at once and writes no tiddler (the plugin makes no `$:/lares` title there).
  if (!stand) { done(); return; }
  void Promise.resolve().then(() => stand()).then((outcome) => {
    const result = outcome ?? { state: "standing" };
    $tw.wiki.addTiddler(new $tw.Tiddler({ title: "$:/temp/lares/writable", text: result.state, ...(result.reason !== undefined ? { reason: result.reason } : {}) }));
  }).catch((error: unknown) => {
    $tw.larariumWritableFault = error ?? new Error("writable backing failed");
    const reason = error instanceof Error ? error.message : String(error);
    $tw.wiki.addTiddler(new $tw.Tiddler({ title: "$:/temp/lares/writable", text: "fault", reason }));
  }).finally(done);
}
