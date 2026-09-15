/**
 * browser-weld — the founding gate, driven through a REAL browser.
 *
 * ── WHAT THIS EXISTS TO CATCH ───────────────────────────────────────────────────────────────────
 * Every leg of the browser round-trip passes alone. The vessel boots, the crossing syncs a doc both
 * ways, the projection renders, the input leg dispatches, and the disk projector writes carriers. What
 * has never run is the COMPOSITION — and this house has learned five times in one session that two
 * correct halves with nothing welding them is where the defect lives.
 *
 * ── ONE VECTOR, ONE FAILURE ─────────────────────────────────────────────────────────────────────
 * A single "an edit reaches disk" assertion fails ambiguously: it reports that the weld broke and says
 * nothing about WHERE. So each vector isolates exactly one seam and names it. Over-asserting inside a
 * vector would buy a shorter file and cost the diagnosis, which is the whole reason to run it.
 *
 * The vectors also split by PREREQUISITE, and that split does diagnostic work on its own:
 *   W1-W3 need only a browser — the app boots a sovereign island, "no node attached". A red here is
 *         browser-side and cannot be a crossing fault.
 *   W4-W5 need a node vessel — a red here cannot be a DOM fault, because W1-W3 already passed.
 *
 * Nothing here retries or waits on a wall clock beyond a bounded settle: a vector that needs patience
 * says how much and why, so a slow machine reads as slow rather than as broken.
 */
import { chromium } from "playwright";

const APP = process.env.WELD_APP_URL ?? "http://localhost:5173";
const SETTLE_MS = Number(process.env.WELD_SETTLE_MS ?? 15_000);

let failures = 0, gaps = 0;
const ok   = (n, m) => console.log(`  \x1b[32mok\x1b[0m       ${n} — ${m}`);
const bad  = (n, m) => { failures++; console.log(`  \x1b[31mFAILED\x1b[0m   ${n} — ${m}`); };
const gap  = (n, m) => { gaps++;     console.log(`  \x1b[33mgap\x1b[0m      ${n} — ${m}`); };

/** Poll a predicate to a bound. Returns the value or null — never throws, so a vector reports rather than dies. */
async function until(fn, ms = SETTLE_MS, every = 250) {
  const stop = Date.now() + ms;
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch { /* a not-yet-mounted surface is not an error */ }
    if (Date.now() > stop) return null;
    await new Promise((r) => setTimeout(r, every));
  }
}

/** The projected pane lives inside a shadow root; every read of it goes through this one accessor. */
const paneHtml = (page) => page.evaluate(() =>
  document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.innerHTML ?? "");

/**
 * Install before navigation: workers are the actual browser→island boundary, not an inference from
 * changed HTML. The trace records only protocol identifiers (never projection bodies or input values).
 * `dropDomEventRenderId` is an intentionally narrow test control: it drops one known click at that
 * boundary so W3 can prove its positive result depends on the return leg.
 */
async function installWorkerTrace(page) {
  await page.addInitScript(() => {
    const trace = {
      events: [],
      dropDomEventRenderId: null,
    };
    window.__weldWorkerTrace = trace;

    const summarize = (data) => {
      if (!data || typeof data !== "object") return { type: typeof data };
      const msg = data;
      const payload = msg.payload && typeof msg.payload === "object" ? msg.payload : null;
      return {
        type: typeof msg.type === "string" ? msg.type : "",
        renderId: typeof msg.renderId === "string" ? msg.renderId : "",
        eventType: typeof msg.eventType === "string" ? msg.eventType : "",
        listenable: typeof msg.listenable === "string" ? msg.listenable : "",
        wikiUri: typeof msg.wikiUri === "string" ? msg.wikiUri : "",
        rev: typeof payload?.rev === "number" ? payload.rev : null,
      };
    };
    const NativeWorker = window.Worker;
    let nextWorkerId = 0;
    function TracedWorker(...args) {
      const worker = new NativeWorker(...args);
      const url = String(args[0]);
      const workerId = `worker-${++nextWorkerId}`;
      let workerWikiUri = "";
      const note = (direction, data) => {
        const summary = summarize(data);
        if (summary.wikiUri) workerWikiUri = summary.wikiUri;
        trace.events.push({ direction, worker: url, workerId, ...summary, wikiUri: summary.wikiUri || workerWikiUri });
      };
      worker.addEventListener("message", (event) => {
        note("from-worker", event.data);
      });
      worker.addEventListener("error", (event) => {
        trace.events.push({ direction: "worker-error", worker: url, workerId, wikiUri: workerWikiUri, message: event.message || "" });
      });
      const post = worker.postMessage.bind(worker);
      worker.postMessage = (data, transfer) => {
        const before = trace.events.length;
        note("to-worker", data);
        const entry = trace.events[before];
        if (entry.type === "wiki:dom-event" && entry.renderId === trace.dropDomEventRenderId) {
          trace.events.push({ ...entry, direction: "dropped-to-worker" });
          return;
        }
        return transfer === undefined ? post(data) : post(data, transfer);
      };
      return worker;
    }
    TracedWorker.prototype = NativeWorker.prototype;
    Object.setPrototypeOf(TracedWorker, NativeWorker);
    window.Worker = TracedWorker;
  });
}

const traceMark = (page) => page.evaluate(() => window.__weldWorkerTrace?.events.length ?? 0);
const traceSince = (page, mark) => page.evaluate((from) => window.__weldWorkerTrace?.events.slice(from) ?? [], mark);
const traceHas = (events, wanted) => events.some((event) =>
  Object.entries(wanted).every(([key, value]) => event[key] === value));
const traceTail = (events) => events.slice(-4).map((event) =>
  [event.direction, event.workerId, event.wikiUri, event.type, event.renderId, event.listenable]
    .filter(Boolean).join(":"),
).join(" | ");

/** Snapshot the particular sidebar tab W3 names, rather than accepting any clickable rid. */
const sidebarTabs = (page) => page.evaluate(() => {
  const pane = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection");
  const tab = (title) => {
    const el = pane?.querySelector(`button[data-lar-rid][data-tab-title="${title}"]`);
    return el ? {
      renderId: el.getAttribute("data-lar-rid"),
      selected: el.getAttribute("aria-selected") === "true",
    } : null;
  };
  return { open: tab("$:/core/ui/SideBar/Open"), recent: tab("$:/core/ui/SideBar/Recent") };
});

const clickRenderId = (page, renderId) => page.evaluate((rid) => {
  const pane = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection");
  const el = [...(pane?.querySelectorAll("[data-lar-rid]") ?? [])]
    .find((node) => node.getAttribute("data-lar-rid") === rid);
  if (!el) return false;
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
  return true;
}, renderId);

const main = async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    await installWorkerTrace(page);

  console.log(`\n\x1b[1mBROWSER WELD — a tiddler edited in a browser, followed to the node's disk\x1b[0m`);
  console.log(`  app: ${APP}\n`);

  // ── W0 · the app answers at all ───────────────────────────────────────────────────────────────
  // Not a seam — a precondition. Separated so "the dev server is down" never reads as "the render leg
  // is broken", which is the misdiagnosis a combined vector would hand us.
  try {
    await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 20_000 });
    ok("W0 app-answers", "the shell loaded");
  } catch (e) {
    bad("W0 app-answers", `no app at ${APP} — ${String(e).slice(0, 90)}`);
    return finish();
  }

  // ── W1 · the vessel boots to a live sovereign island ──────────────────────────────────────────
  // The app writes its own verdict into #status / #vessel. Reading ITS words rather than inferring
  // from the DOM keeps this vector honest about what the app itself claims.
  const status = await until(async () => {
    const t = await page.evaluate(() => document.getElementById("vessel")?.textContent ?? "");
    return t.includes("live") ? t : null;
  });
  if (status) ok("W1 vessel-boots", "the island reports live");
  else bad("W1 vessel-boots", `no "live" in #vessel within ${SETTLE_MS}ms — the browser vessel never stood`);

  // ── W2 · the projection RENDERS, and carries render ids ───────────────────────────────────────
  // Two facts, one seam: the frame arrived AND it is addressable. A pane with html but no
  // `data-lar-rid` is a render leg that landed with the return leg unbound, which is a different
  // defect from an empty pane and must not read the same.
  const html = await until(async () => { const h = await paneHtml(page); return h && h.length > 0 ? h : null; });
  if (!html) {
    bad("W2 projection-renders", "the projection shadow root stayed empty — no `projection:frame` applied");
  } else if (!html.includes("data-lar-rid")) {
    bad("W2 projection-renders", "a frame rendered but carries NO data-lar-rid — the return leg has nothing to address");
  } else {
    ok("W2 projection-renders", `${html.length} bytes, rid-stamped`);
  }

  // ── W3 · Recent's named state transition crosses the worker boundary ───────────────────────────
  // The original driver chose the first clickable node. It happened to choose Hide sidebar, whose
  // current red says something about RevealWidget, not whether the projection return leg works. Recent
  // is a stable named widget: its exact $:/core/ui/SideBar/* title carries the target identity, Open starts
  // selected, and one Recent click must select Recent and unselect Open.
  // Three controls keep that claim honest: an unknown render id must drop safely, a deliberately dropped
  // return leg must NOT produce the transition, and the restored leg must produce it.
  if (html?.includes("data-lar-rid")) {
    const initialTabs = await sidebarTabs(page);
    const recentId = initialTabs.recent?.renderId;
    if (!initialTabs.open || !initialTabs.recent || !recentId) {
      bad("W3 Recent-tab", "missing exact data-tab-title Open or Recent rid-stamped sidebar target");
    } else if (!initialTabs.open.selected || initialTabs.recent.selected) {
      bad("W3 Recent-tab", "expected initial Open selected and Recent unselected — fixture state no longer names the transition");
    } else {
      // An unknown rendered id is sent through the same real host listener. The worker must safely drop it:
      // the trace proves transport reached the worker boundary and the state must remain untouched.
      const unknownId = `weld-unknown-rid-${Date.now()}`;
      const unknownMark = await traceMark(page);
      const unknownSent = await page.evaluate((rid) => {
        const pane = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection");
        if (!pane) return false;
        const probe = document.createElement("button");
        probe.setAttribute("data-lar-rid", rid);
        pane.appendChild(probe);
        probe.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
        probe.remove();
        return true;
      }, unknownId);
      const unknownChanged = await until(async () => {
        const tabs = await sidebarTabs(page);
        return tabs.open?.selected === false || tabs.recent?.selected === true;
      }, 8_000);
      const unknownTrace = await traceSince(page, unknownMark);
      if (!unknownSent) {
        bad("W3 unknown-rid-drop", "projection disappeared before the unknown render-id control could run");
      } else if (!traceHas(unknownTrace, { direction: "to-worker", type: "wiki:dom-event", renderId: unknownId })) {
        bad("W3 unknown-rid-drop", `unknown render id never reached a worker boundary — ${traceTail(unknownTrace)}`);
      } else if (unknownChanged || traceHas(unknownTrace, { direction: "worker-error" })) {
        bad("W3 unknown-rid-drop", `unknown render id changed the named tab state or raised a worker error — ${traceTail(unknownTrace)}`);
      } else {
        ok("W3 unknown-rid-drop", "unknown render id crossed the host boundary and left Open/Recent unchanged");
      }

      // Drop precisely the one return-leg message we will later restore. This is a negative control for
      // Recent's very same result, not a separate synthetic assertion.
      const droppedMark = await traceMark(page);
      await page.evaluate((rid) => { window.__weldWorkerTrace.dropDomEventRenderId = rid; }, recentId);
      const droppedClick = await clickRenderId(page, recentId);
      const transitionedWhileDropped = await until(async () => {
        const tabs = await sidebarTabs(page);
        return tabs.open?.selected === false && tabs.recent?.selected === true;
      }, 8_000);
      const droppedTrace = await traceSince(page, droppedMark);
      await page.evaluate(() => { window.__weldWorkerTrace.dropDomEventRenderId = null; });
      if (!droppedClick) {
        bad("W3 return-leg-control", "Recent disappeared before its deliberately dropped click could run");
      } else if (!traceHas(droppedTrace, { direction: "dropped-to-worker", type: "wiki:dom-event", renderId: recentId })) {
        bad("W3 return-leg-control", `the fixture failed to drop Recent's outgoing wiki:dom-event — ${traceTail(droppedTrace)}`);
      } else if (transitionedWhileDropped) {
        bad("W3 return-leg-control", `Recent selected despite its return leg being dropped — ${traceTail(droppedTrace)}`);
      } else {
        ok("W3 return-leg-control", "dropped Recent return leg left Open selected and Recent unselected");
      }

      const restoredMark = await traceMark(page);
      const restoredClick = await clickRenderId(page, recentId);
      const restored = await until(async () => {
        const tabs = await sidebarTabs(page);
        return tabs.open?.selected === false && tabs.recent?.selected === true ? tabs : null;
      }, 8_000);
      const restoredTrace = await traceSince(page, restoredMark);
      const recentDispatch = restoredTrace.find((event) =>
        event.direction === "to-worker" && event.type === "wiki:dom-event" && event.renderId === recentId);
      const sentRecent = !!recentDispatch;
      const projectedRecent = !!recentDispatch && traceHas(restoredTrace, {
        direction: "from-worker", workerId: recentDispatch.workerId, wikiUri: recentDispatch.wikiUri,
        type: "event", listenable: "projection:frame",
      });
      if (restored && restoredClick && sentRecent && projectedRecent) {
        ok("W3 Recent-tab", `rid ${recentId}: Open selected true→false; Recent false→true; worker re-projected`);
      } else {
        const missing = [
          !restoredClick && "Recent target",
          !sentRecent && "outgoing wiki:dom-event",
          !projectedRecent && "worker projection:frame",
          !restored && "Open→Recent state transition",
        ].filter(Boolean).join(", ");
        bad("W3 Recent-tab", `rid ${recentId}: missing ${missing}; ${traceTail(restoredTrace)}`);
      }
    }
  } else {
    gap("W3 Recent-tab", "skipped — W2 gave it nothing to click");
  }

  // The old first-click witness remains separately named. Its current failure is product evidence about
  // sidebar reveal, and must never be made green by replacing the ambiguous fixture above.
  const sidebarBefore = await page.evaluate(() => {
    const pane = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection");
    const hide = pane?.querySelector(".tc-hide-sidebar-btn[data-lar-rid]");
    const reveal = pane?.querySelector(".tc-sidebar-header > .tc-reveal");
    return {
      renderId: hide?.getAttribute("data-lar-rid") ?? null,
      shown: !!reveal && reveal.hidden === false,
    };
  });
  if (!sidebarBefore.renderId || !sidebarBefore.shown) {
    bad("W3 sidebar-hides", "Hide sidebar button or visible .tc-sidebar-header > .tc-reveal unavailable after Recent witness");
  } else {
    const sidebarMark = await traceMark(page);
    const errorCount = consoleErrors.length;
    const hideClicked = await clickRenderId(page, sidebarBefore.renderId);
    const hidden = await until(async () => page.evaluate(() => {
      const pane = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection");
      const reveal = pane?.querySelector(".tc-sidebar-header > .tc-reveal");
      return reveal?.hidden === true && !!pane?.querySelector(".tc-show-sidebar-btn[data-lar-rid]");
    }), 8_000);
    const sidebarTrace = await traceSince(page, sidebarMark);
    const sidebarDispatch = sidebarTrace.find((event) =>
      event.direction === "to-worker" && event.type === "wiki:dom-event" && event.renderId === sidebarBefore.renderId);
    const hideSent = !!sidebarDispatch;
    const sidebarProjection = !!sidebarDispatch && traceHas(sidebarTrace, {
      direction: "from-worker", workerId: sidebarDispatch.workerId, wikiUri: sidebarDispatch.wikiUri,
      type: "event", listenable: "projection:frame",
    });
    if (hideClicked && hideSent && sidebarProjection && hidden) {
      ok("W3 sidebar-hides", "$:/state/sidebar became no: sidebar reveal hidden=true and Show sidebar replaced Hide sidebar");
      const showId = await page.evaluate(() => document.getElementById("projection")?.shadowRoot
        ?.querySelector(".tc-show-sidebar-btn[data-lar-rid]")?.getAttribute("data-lar-rid") ?? null);
      if (showId) {
        await clickRenderId(page, showId);
        const shown = await until(async () => page.evaluate(() => {
          const pane = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection");
          const reveal = pane?.querySelector(".tc-sidebar-header > .tc-reveal");
          return reveal?.hidden === false && !!pane?.querySelector(".tc-hide-sidebar-btn[data-lar-rid]");
        }), 8_000);
        if (!shown) bad("W3 sidebar-restores", "Show sidebar did not restore the W4 surface after a successful hide");
        else ok("W3 sidebar-restores", "Show sidebar restored the W4 surface");
      } else {
        bad("W3 sidebar-restores", "Hide sidebar succeeded but its required Show sidebar return target is absent");
      }
    } else {
      const browserError = consoleErrors.slice(errorCount)[0];
      const missing = [!hideSent && "outgoing wiki:dom-event", !sidebarProjection && "same-worker projection:frame", !hidden && "hidden sidebar reveal plus Show sidebar"]
        .filter(Boolean).join(", ");
      bad("W3 sidebar-hides", `expected sidebar reveal hidden=true and Show sidebar; ${browserError ? `browser error: ${browserError.slice(0, 120)}` : `missing ${missing}`}; ${traceTail(sidebarTrace)}`);
    }
  }

  // ── W4 · a KEYSTROKE reaches the wiki store ───────────────────────────────────────────────────
  // The text leg relays the WHOLE value on `input`, so the assertion is that the wiki now holds it.
  // Reading it back out of the projection proves the round-trip rather than the dispatch.
  const typed = `weld-${Date.now()}`;
  const field = await page.evaluate(() => {
    const pane = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection");
    return !!pane?.querySelector("input[data-lar-rid], textarea[data-lar-rid]");
  });
  if (!field) {
    gap("W4 keystroke-lands", "no edit widget in this projection — the surface stands read-only until a tiddler opens for edit");
  } else {
    const inputMark = await traceMark(page);
    await page.evaluate((v) => {
      const pane = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection");
      const el = pane?.querySelector("input[data-lar-rid], textarea[data-lar-rid]");
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }, typed);
    const seen = await until(async () => (await paneHtml(page)).includes(typed), 8_000);
    const inputTrace = await traceSince(page, inputMark);
    const inputDispatch = inputTrace.find((event) =>
      event.direction === "to-worker" && event.type === "wiki:dom-input" && event.eventType === "input");
    const inputProjection = !!inputDispatch && traceHas(inputTrace, {
      direction: "from-worker", workerId: inputDispatch.workerId, wikiUri: inputDispatch.wikiUri,
      type: "event", listenable: "projection:frame",
    });
    if (seen && inputDispatch && inputProjection) {
      ok("W4 keystroke-lands", `"${typed}" reached ${inputDispatch.wikiUri} and re-projected from the same worker`);
    } else {
      const missing = [!seen && "typed value", !inputDispatch && "outgoing wiki:dom-input", !inputProjection && "same-worker projection:frame"]
        .filter(Boolean).join(", ");
      bad("W4 keystroke-lands", `input leg missing ${missing}; ${traceTail(inputTrace)}`);
    }
  }

  // ── W5 · the edit reaches the NODE's disk ─────────────────────────────────────────────────────
  // The founding gate. Declared here and reported as a gap while unwired, so the vector exists and
  // says what it waits on rather than being absent and forgotten.
  gap("W5 reaches-disk", "UNWIRED — wants a node vessel attached and a .mem read; W1-W4 are its precondition");

  if (consoleErrors.length) {
    console.log(`\n  \x1b[33mconsole\x1b[0m  ${consoleErrors.length} browser error(s), first: ${consoleErrors[0].slice(0, 140)}`);
  }
    return finish();
  } finally {
    await browser.close();
  }
};

function finish() {
  console.log(`\n  ── ${failures} failed · ${gaps} gap(s) ──\n`);
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((e) => { console.error("weld driver threw:", e); process.exitCode = 1; });
