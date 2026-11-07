/**
 * page-wait — the browser weld's waits on a page, each ending on the page's own event or on a named LIVENESS bound
 * that refuses by name (clock-sweep land read: the weld's `{ timeout: 0 }` waits hung on a page alive and silent).
 *
 * A page that paints its arrival or a terminal signal (a refusing phase, an err/warn status, a ceremony refusal, a
 * refused mirror) or raises a page error ends a wait at once. A page that stands alive and paints neither says
 * nothing, and no event can say never, so each wait carries a LIVENESS bound and its lapse refuses BY NAME. A wait that
 * can read progress (the boot's phase list growing) renews its bound on each step forward, so a slow boot that keeps
 * advancing is never cut.
 */

/**
 * Wait on a page function until it answers `{ done }` (the page's verdict), `{ progress: n }` with `n` past the last
 * progress read (renews the bound), the page errors, or the bound lapses with no step forward.
 * The page function receives `{ arg, seen }` and returns `{ done: value }`, `{ progress: n }` (only when `n > seen`) or a
 * falsy value (keep polling). Answers `{ value }` or `{ refused }`, the refusal named.
 */
export async function awaitPage(page, pageFn, arg, { livenessMs, what }) {
  let onError;
  const errored = new Promise((resolve) => {
    onError = (error) => resolve({ refused: `pageerror: ${error?.message ?? String(error)}` });
    page.on("pageerror", onError);
  });
  let seen = -1;
  try {
    for (;;) {
      const step = await Promise.race([
        errored,
        // LIVENESS: a page alive that paints neither arrival, a refusal nor a step forward says nothing more.
        page.waitForFunction(pageFn, { arg, seen }, { timeout: livenessMs }).then((h) => h.jsonValue()).then(
          (answer) => ({ answer }),
          (e) => /timeout/i.test(String(e?.name ?? "") + String(e?.message ?? ""))
            ? { refused: `LIVENESS: ${what} — the page stood alive and painted no arrival, refusal or step forward within ${livenessMs}ms` }
            : { refused: `page closed: ${String(e).slice(0, 90)}` }),
      ]);
      if ("refused" in step) return step;
      const { answer } = step;
      if (answer && typeof answer === "object" && "progress" in answer && answer.progress > seen) { seen = answer.progress; continue; }
      return { value: answer?.done };
    }
  } finally {
    page.off("pageerror", onError);
  }
}

/** The bound every projection witness keeps: an applied act whose frame never lands has no terminal signal. */
export const WITNESS_LIVENESS_MS = 8_000;

/**
 * Wait for a product witness or terminal failure. A missing frame after an applied act, or an unknown render id the
 * worker never answers, has no terminal signal, so every witness keeps the LIVENESS bound, and its lapse names itself.
 * Answers true when the witness arrived, false on a terminal signal, a closed page or the named lapse.
 */
export async function waitForWitness(page, kind, mark, renderId, value, { livenessMs = WITNESS_LIVENESS_MS, log = console.log } = {}) {
  let onError, onConsole, timer;
  const terminal = new Promise((resolve) => {
    onError = () => resolve(false);
    onConsole = (message) => {
      if (/\[daemon-island:fault\]|\[mirror\] stand refused:/.test(message.text())) resolve(false);
    };
    page.on("pageerror", onError);
    page.on("console", onConsole);
    // LIVENESS: a frame that never lands, or a render id never answered, raises no terminal signal.
    timer = setTimeout(() => {
      log(`  LIVENESS: the ${kind} witness — the page stood alive and painted neither its witness nor a refusal within ${livenessMs}ms`);
      resolve(false);
    }, livenessMs);
  });
  try {
    return await Promise.race([
      terminal,
      page.waitForFunction(({ kind, mark, renderId, value }) => {
        const events = window.__weldWorkerTrace?.events.slice(mark) ?? [];
        const phase = [...document.querySelectorAll("#phases .phase")].find((p) => /refus|fault/i.test(p.textContent ?? ""));
        const status = document.querySelector("#status");
        const mirror = document.querySelector("#mirror")?.getAttribute("data-lar-mirror");
        if (events.some((e) => e.direction === "worker-error") || phase || status?.classList.contains("err") ||
            status?.classList.contains("warn") || document.querySelector(".ceremony-ask[data-refusal]") ||
            (mirror?.startsWith("none:") && mirror !== "none:mirror-inputs-absent")) return { arrived: false };
        const dispatch = events.find((e) => e.direction === "to-worker" && e.type === "lar:control-event" &&
          (renderId ? e.renderId === renderId : e.action === "lar:sense"));
        const answered = dispatch && events.some((e) => e.direction === "from-worker" && e.workerId === dispatch.workerId &&
          e.surface === dispatch.surface && e.type === "lar:control-result" && e.renderId === renderId);
        if (kind === "unknown") return answered ? { arrived: true } : false;
        const pane = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection");
        const tab = (title) => pane?.querySelector(`button[data-lar-rid][data-tab-title="${title}"]`);
        const reveal = pane?.querySelector(".tc-sidebar-header > .tc-reveal");
        const arrived = kind === "recent" ? tab("$:/core/ui/SideBar/Open")?.getAttribute("aria-selected") === "false" &&
            tab("$:/core/ui/SideBar/Recent")?.getAttribute("aria-selected") === "true" :
          kind === "hidden" ? reveal?.hidden === true && !!pane?.querySelector(".tc-show-sidebar-btn[data-lar-rid]") :
          kind === "shown" ? reveal?.hidden === false && !!pane?.querySelector(".tc-hide-sidebar-btn[data-lar-rid]") :
          (pane?.innerHTML ?? "").includes(value);
        const frame = dispatch && events.some((e) => e.direction === "from-worker" && e.workerId === dispatch.workerId &&
          e.surface === dispatch.surface && e.type === "lar:frame");
        return arrived && frame ? { arrived: true } : false;
        // PACING: the page polls its own DOM each frame; the race's terminal arm or the LIVENESS bound above ends it.
      }, { kind, mark, renderId, value }, { timeout: 0 }).then((h) => h.jsonValue()).then((r) => r.arrived),
    ]);
  } catch {
    return false; // page closed
  } finally {
    clearTimeout(timer);
    page.off("pageerror", onError);
    page.off("console", onConsole);
  }
}
