import type { PromotePanelSnapshot } from "@lararium/mesh";

export interface PromotePanelApi {
  snapshot(): Promise<PromotePanelSnapshot>;
  commit(wiki: string, digest: string): Promise<unknown>;
  drop(wiki: string, digest: string): Promise<unknown>;
  orphan(wiki: string, digest: string, decision: "keep" | "drop"): Promise<unknown>;
  raise(wiki: string, digest: string): Promise<unknown>;
  lower(wiki: string, digest: string): Promise<unknown>;
  subscribe?: (fn: () => void) => () => void;
}

/** Render the vessel's promotion snapshot and route gestures back to it. */
export function mountPromotePanel(host: HTMLElement, api: PromotePanelApi): { refresh(): Promise<void>; unmount(): void } {
  const root = host.attachShadow({ mode: "closed" });
  let mounted = true, generation = 0;
  host.hidden = true;
  async function refresh(): Promise<void> {
    const turn = ++generation;
    const snapshot = await api.snapshot();
    if (!mounted || turn !== generation) return;
    const heading = document.createElement("h2"); heading.textContent = "Rites waiting here";
    const content: HTMLElement[] = [heading];
    for (const entry of snapshot.wikis) {
      const section = document.createElement("section"); section.dataset.wiki = entry.wiki;
      const title = document.createElement("h3"); title.textContent = entry.wiki; section.append(title);
      if ("error" in entry) { section.append(document.createTextNode(entry.error)); content.push(section); continue; }
      if (!entry.rows.length && !entry.waiting.length) section.append(document.createTextNode("no rites waiting"));
      const button = (row: HTMLElement, act: string, digest: string, label: string, run: () => Promise<unknown>) => {
        const b = document.createElement("button"); b.dataset.act = act; b.dataset.digest = digest; b.textContent = label;
        b.addEventListener("click", (event) => {
          if (event.isTrusted !== true || event.type !== "click") {
            const message = document.createElement("span"); message.textContent = "promote-needs-hand"; row.append(message);
            return;
          }
          b.disabled = true;
          void (async () => { try { await run(); await refresh(); } catch (error) { const message = document.createElement("span"); message.textContent = error instanceof Error ? error.message : String(error); row.append(message); b.disabled = false; } })();
        }); row.append(b);
      };
      for (const item of entry.waiting) {
        const row = document.createElement("div"); row.append(document.createTextNode(`${item.title} ${item.digest.slice(0, 12)} ${item.classes.join(", ")} ${item.origin.session} `));
        button(row, "commit", item.digest, "Commit here", () => api.commit(entry.wiki, item.digest)); section.append(row);
      }
      for (const item of entry.rows) {
        const row = document.createElement("div");
        const states = { standing: "standing", "update-waits": "an update waits; promote again?", orphaned: "orphaned: its source left the wiki; it keeps running until you decide", kept: "kept" };
        row.append(document.createTextNode(`${item.title} ${states[item.state]} `));
        button(row, "drop", item.digest, "Drop", () => api.drop(entry.wiki, item.digest));
        if (item.state === "orphaned") {
          button(row, "orphan-keep", item.digest, "Keep", () => api.orphan(entry.wiki, item.digest, "keep"));
          button(row, "orphan-drop", item.digest, "Drop orphan", () => api.orphan(entry.wiki, item.digest, "drop"));
        }
        if (item.shadowed || entry.shadowed.includes(item.digest)) {
          row.append(document.createTextNode(" set aside across the fleet "));
          button(row, "lower", item.digest, "Restore everywhere", () => api.lower(entry.wiki, item.digest));
        } else button(row, "raise", item.digest, "Set aside everywhere", () => api.raise(entry.wiki, item.digest));
        section.append(row);
      }
      content.push(section);
    }
    root.replaceChildren(...content); host.hidden = false;
  }
  const unsubscribe = api.subscribe?.(() => { void refresh(); });
  return { refresh, unmount() { mounted = false; generation++; unsubscribe?.(); root.replaceChildren(); host.hidden = true; } };
}
