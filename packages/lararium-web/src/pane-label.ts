/**
 * The projection pane names the wiki it shows. The pane's heading carries the shown surface's own name, the word the vessel card's
 * `wiki` row prints for the same surface, so a person reads which wiki the mirror (or the floor beneath it) serves; the summon
 * button beside it stays a button that names the surface it summons, never the shown one.
 */
export function paintPaneLabel(label: HTMLElement, surface: string | null): void {
  const name = surface ?? "";
  if (label.getAttribute("data-lar-pane-wiki") === name && label.textContent !== "") return;
  label.setAttribute("data-lar-pane-wiki", name);
  label.textContent = surface ?? "…";
}
