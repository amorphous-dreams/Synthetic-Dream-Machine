/**
 * lar-order-list — a page-native reorderable list that offers its WHOLE ordered id list (page-controls#/the-control-set).
 *
 *   `<lar-order-list data-control-id="…" data-tiddler="…" data-field="list"><ol><li data-item-id="a">…</li>…</ol></lar-order-list>`
 *
 * A person reorders by dragging an item onto another (it lands before that item), or with a named move button
 * inside an item (`<button type="button" data-move="up">`, `"down"`), or with Alt+ArrowUp / Alt+ArrowDown on a
 * focused item. Each gesture moves the item on the page at once and dispatches one `lar-order` event carrying the
 * whole ordered list of `data-item-id`s; the sink relays it as `lar:order`. Membership stays the wiki's: the island
 * never deletes an id the list omits, and the next frame paints the order the wiki holds.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/page-controls#/the-control-set
 */
const ITEM_TYPE = "text/x-lar-order-item";

export interface LarOrderDetail { readonly ids: readonly string[] }

export class LarOrderList extends HTMLElement {
  private dragged: string | null = null;
  constructor() {
    super();
    this.addEventListener("dragstart", (e) => {
      const item = this.itemOf(e.target);
      if (!item || !e.dataTransfer) return;
      this.dragged = item.getAttribute("data-item-id");
      e.dataTransfer.setData(ITEM_TYPE, this.dragged ?? "");
      e.dataTransfer.effectAllowed = "move";
    });
    this.addEventListener("dragover", (e) => { if (this.itemOf(e.target) && (this.dragged || e.dataTransfer?.types.includes(ITEM_TYPE))) e.preventDefault(); });
    this.addEventListener("drop", (e) => {
      const onto = this.itemOf(e.target);
      const id = this.dragged ?? e.dataTransfer?.getData(ITEM_TYPE) ?? "";
      this.dragged = null;
      if (!onto || !id) return;
      e.preventDefault();
      e.stopPropagation();
      const ids = this.ids().filter((x) => x !== id);
      ids.splice(ids.indexOf(onto.getAttribute("data-item-id") ?? ""), 0, id);
      this.commit(ids);
    });
    this.addEventListener("click", (e) => {
      const button = (e.target as Element | null)?.closest?.("button[data-move]");
      const item = this.itemOf(button);
      if (!button || !item) return;
      e.preventDefault();
      e.stopPropagation();
      this.move(item.getAttribute("data-item-id") ?? "", button.getAttribute("data-move") === "up" ? -1 : 1);
    });
    this.addEventListener("keydown", (e) => {
      const item = this.itemOf(e.target);
      if (!item || !e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      e.stopPropagation();
      this.move(item.getAttribute("data-item-id") ?? "", e.key === "ArrowUp" ? -1 : 1);
    });
  }
  /** The ids in the order the page shows them. */
  ids(): string[] { return [...this.querySelectorAll("li[data-item-id]")].map((li) => li.getAttribute("data-item-id") ?? ""); }
  private itemOf(target: EventTarget | null | undefined): HTMLLIElement | null {
    const item = (target as Element | null)?.closest?.("li[data-item-id]") as HTMLLIElement | null;
    return item && this.contains(item) ? item : null;
  }
  private move(id: string, by: number): void {
    const ids = this.ids();
    const at = ids.indexOf(id);
    const to = at + by;
    if (at < 0 || to < 0 || to >= ids.length) return;
    ids.splice(at, 1);
    ids.splice(to, 0, id);
    this.commit(ids);
  }
  /** Show the order on the page now, then offer it whole. */
  private commit(ids: readonly string[]): void {
    const list = this.querySelector("ol, ul");
    if (list) for (const id of ids) { const li = [...list.children].find((c) => c.getAttribute("data-item-id") === id); if (li) list.appendChild(li); }
    this.dispatchEvent(new CustomEvent<LarOrderDetail>("lar-order", { bubbles: true, detail: { ids: [...ids] } }));
  }
}

/** Register the element once per page. */
export function defineLarOrderList(): void {
  if (!customElements.get("lar-order-list")) customElements.define("lar-order-list", LarOrderList);
}
