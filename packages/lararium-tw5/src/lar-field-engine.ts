/**
 * lar-field-engine — the editor's engine seam, and the small table that names a page control on the frame.
 *
 * TiddlyWiki builds `$edit-text` by handing two engines to its own editor factory
 * (`$:/core/modules/editor/factory.js`): a framed engine where a toolbar shows, a simple one elsewhere. This module
 * hands that factory a THIRD engine for the fake document (page-controls#/shadow-widgets). The stock field
 * addressing, store writes, `inputActions` and toolbar dispatch stay TiddlyWiki's own; only the engine changes:
 *
 *   - The field paints inside a `<lar-field data-lar-control="lar-field">` wrapper, so the page binds its
 *     `lar-field` control there. The native child carries the first value once, as the engine floor.
 *   - `setText` writes a VALUE DESCRIPTOR on the native child: `data-lar-value` (the whole value) and
 *     `data-lar-value-rev` (the island's revision of that descriptor, rising across every field this worker
 *     stands). It never writes the child text and never the node's value: the live value belongs to the page,
 *     which reconciles from the descriptor only while it holds no newer revision of its own
 *     (dreamdom#/what-a-sink-keeps, the textarea revert row).
 *   - `getText` reads the value the page last sent (a sense or a commit lands it on the node TW5 reads).
 *   - `getSelectionRange` reads the pair the last toolbar act carried (`selection` beside `wholeValue`); a text
 *     operation runs TW5's own operation module over that pair, and `executeTextOperation` records the whole value
 *     and selection the engine wants, for the answer's `want`. An operation with no carried pair, or a
 *     selection operation over a collapsed pair, refuses `selection-unavailable`.
 *
 * On a real document the stock engines stand as TiddlyWiki chose them.
 *
 * The table: a `$reveal` whose type reads `popup` paints `data-lar-control="lar-popover"`; a `$reveal` keyed to a
 * state paints `data-lar-control="lar-disclosure"`; a `$button` that sends `tm-edit-text-operation` paints
 * `data-lar-control="lar-field-operation"`, so the page carries the field's pair on that act.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/page-controls#/shadow-widgets
 */
import type { LarRefusal } from "@lararium/mesh";

type Tw = Record<string, any>;

export const LAR_FIELD_CONTROL = "lar-field";
export const LAR_FIELD_OPERATION_CONTROL = "lar-field-operation";
export const LAR_POPOVER_CONTROL = "lar-popover";
export const LAR_DISCLOSURE_CONTROL = "lar-disclosure";

/** The operations that act on a selection: a collapsed carried pair names none for them to act on. */
const SELECTION_OPERATIONS: ReadonlySet<string> = new Set(["wrap-selection", "excise"]);

const SEAM = Symbol.for("lararium.lar-field-engine");
const STAMPED = Symbol.for("lararium.lar-control-stamp");

/** The pair a toolbar act carries: the whole value and the selection as of the act. */
export interface CarriedPair { readonly text: string; readonly selStart: number; readonly selEnd: number }
/** What a text operation left for the answer: the value and selection the engine wants, or a named refusal. */
export type OperationOutcome =
  | { readonly want: { readonly value: string; readonly selStart: number; readonly selEnd: number } }
  | { readonly refused: LarRefusal };

/** The engine's face the projection reads off a field node. */
export interface LarFieldEngineFace {
  readonly larField: true;
  /** The descriptor the engine last wrote: the store's whole value as the island holds it. */
  described(): string;
  /** The page took the descriptor whole (`lar:take-theirs`): the node now reads it. */
  takeDescribed(): void;
  carry(pair: CarriedPair): void;
  /** The outcome the carried pair's operation left, or null when none ran; the pair leaves with it. */
  takeOutcome(): OperationOutcome | null;
}

/** Every descriptor revision rises across the worker's whole life, so a re-rendered field never repeats one. */
let descriptorSeq = 0;

interface TextOperation {
  text: string; selStart: number; selEnd: number; selection: string;
  cutStart: number | null; cutEnd: number | null; replacement: string | null;
  newSelStart: number | null; newSelEnd: number | null;
}

function makeLarFieldEngine(tw: Tw): new (options: Record<string, any>) => LarFieldEngineFace {
  class LarFieldEngine implements LarFieldEngineFace {
    readonly larField = true as const;
    readonly widget: Record<string, any>;
    readonly parentNode: Record<string, any>;
    readonly nextSibling: unknown;
    readonly domNode: Record<string, any>;
    readonly wrapperNode: Record<string, any>;
    private text: string;
    private lastDescribed: string;
    private carried: CarriedPair | null = null;
    private outcome: OperationOutcome | null = null;

    constructor(options: Record<string, any>) {
      this.widget = options["widget"];
      this.parentNode = options["parentNode"];
      this.nextSibling = options["nextSibling"];
      const widget = this.widget;
      const value = String(options["value"] ?? "");
      this.text = value;
      this.lastDescribed = value;
      const doc = widget["document"];
      let tag: string = widget["editTag"];
      if (tw.config.htmlUnsafeElements.indexOf(tag) !== -1) tag = "input";
      this.domNode = doc.createElement(tag);
      const engine = this;
      // The node's value reads the page's last word: TW5 reads `domNodes[0].value`, the input leg writes it.
      Object.defineProperty(this.domNode, "value", {
        configurable: true,
        get: () => engine.text,
        set: (v: unknown) => { engine.text = String(v); },
      });
      this.domNode["_larFieldEngine"] = this;
      // The engine floor: the first value paints in the native carrier once, for a page with no control bound.
      if (widget["editTag"] === "textarea") this.domNode.appendChild(doc.createTextNode(value));
      else this.domNode.setAttribute("value", value);
      if (widget["editType"] && widget["editTag"] !== "textarea") this.domNode.setAttribute("type", widget["editType"]);
      if (widget["editPlaceholder"]) this.domNode.setAttribute("placeholder", widget["editPlaceholder"]);
      if (widget["editSize"]) this.domNode.setAttribute("size", widget["editSize"]);
      if (widget["editRows"]) this.domNode.setAttribute("rows", widget["editRows"]);
      if (widget["editClass"]) this.domNode.className = widget["editClass"];
      if (widget["editTabIndex"]) this.domNode.setAttribute("tabindex", widget["editTabIndex"]);
      if (widget["editAutoComplete"]) this.domNode.setAttribute("autocomplete", widget["editAutoComplete"]);
      if (widget["isDisabled"] === "yes") this.domNode.setAttribute("disabled", true);
      this.describe(value);
      tw.utils.addEventListeners(this.domNode, [{ name: "input", handlerObject: this, handlerMethod: "handleInputEvent" }]);
      this.wrapperNode = doc.createElement("lar-field");
      this.wrapperNode.setAttribute("data-lar-control", LAR_FIELD_CONTROL);
      this.wrapperNode.appendChild(this.domNode);
      this.parentNode.insertBefore(this.wrapperNode, this.nextSibling);
      widget["domNodes"].push(this.wrapperNode);
    }

    private describe(text: string): void {
      this.lastDescribed = text;
      this.domNode.setAttribute("data-lar-value", text);
      this.domNode.setAttribute("data-lar-value-rev", String(++descriptorSeq));
    }

    /** The store moved: the descriptor says so, and the node's value stays the page's. */
    setText(text: string): void { this.describe(text); }
    updateDomNodeText(text: string): void { this.describe(text); }
    getText(): string { return this.text; }
    described(): string { return this.lastDescribed; }
    takeDescribed(): void { this.text = this.lastDescribed; }
    /** The page sizes its own field; the caret and focus live there too. */
    fixHeight(): void { /* the page's lar-field sizes itself */ }
    focus(): void { /* focus belongs to the page */ }

    handleInputEvent(event: unknown): boolean {
      this.widget["saveChanges"](this.getText());
      if (this.widget["editInputActions"]) {
        this.widget["invokeActionString"](this.widget["editInputActions"], this, event, { actionValue: this.getText() });
      }
      return true;
    }

    carry(pair: CarriedPair): void { this.carried = pair; this.outcome = null; }
    getSelectionRange(): { start: number; end: number } | null {
      return this.carried ? { start: this.carried.selStart, end: this.carried.selEnd } : null;
    }
    refuse(reason: LarRefusal): void { this.outcome = { refused: reason }; this.carried = null; }
    takeOutcome(): OperationOutcome | null { const o = this.outcome; this.outcome = null; this.carried = null; return o; }

    createTextOperation(): TextOperation | null {
      const c = this.carried;
      const range = this.getSelectionRange();
      if (!c || !range) return null;
      return {
        text: c.text, selStart: range.start, selEnd: range.end, selection: c.text.substring(range.start, range.end),
        cutStart: null, cutEnd: null, replacement: null, newSelStart: null, newSelEnd: null,
      };
    }

    executeTextOperation(operation: TextOperation): string {
      let newText = operation.text;
      if (operation.replacement !== null) {
        newText = operation.text.substring(0, operation.cutStart ?? 0) + operation.replacement + operation.text.substring(operation.cutEnd ?? 0);
      }
      this.text = newText;
      this.outcome = { want: { value: newText, selStart: operation.newSelStart ?? operation.selStart, selEnd: operation.newSelEnd ?? operation.selEnd } };
      this.carried = null;
      return newText;
    }
  }
  return LarFieldEngine;
}

/** Stamp `data-lar-control` on a widget's first fake node after its own render, where the table names one. */
function stampAfterRender(cls: Record<string | symbol, any> | undefined, read: (widget: Record<string, any>) => string | undefined): void {
  if (!cls || cls[STAMPED]) return;
  cls[STAMPED] = true;
  const render = cls.prototype.render;
  cls.prototype.render = function (this: Record<string, any>, parent: unknown, nextSibling: unknown): void {
    render.call(this, parent, nextSibling);
    const node = this["domNodes"]?.[0];
    const type = read(this);
    if (type && node?.isTiddlyWikiFakeDom && typeof node.setAttribute === "function") node.setAttribute("data-lar-control", type);
  };
}

const STATE_REVEALS: ReadonlySet<string> = new Set(["match", "nomatch", "lt", "gt", "lteq", "gteq"]);

/**
 * Hand the seam engine to TW5's editor factory, and stamp the control table, on one booted `$tw`. Idempotent;
 * the widget class map takes the seam's `edit-text` before the camera renders.
 */
export function installLarFieldEngine(tw: Tw): void {
  const classes = tw.rootWidget?.widgetClasses as Record<string, any> | undefined;
  if (!classes) throw new Error("lar-field engine: the widget class map stands only after boot");
  stampAfterRender(classes["reveal"], (w) =>
    w["type"] === "popup" ? LAR_POPOVER_CONTROL
      : (w["state"] || w["stateTitle"]) && STATE_REVEALS.has(w["type"] ?? "match") ? LAR_DISCLOSURE_CONTROL : undefined);
  stampAfterRender(classes["button"], (w) =>
    [w["message"], w["actions"]].some((s) => typeof s === "string" && s.includes("tm-edit-text-operation")) ? LAR_FIELD_OPERATION_CONTROL : undefined);
  if (classes["edit-text"]?.[SEAM]) return;
  const factory = tw.modules.execute("$:/core/modules/editor/factory.js").editTextWidgetFactory;
  const FramedEngine = tw.modules.execute("$:/core/modules/editor/engines/framed.js").FramedEngine;
  const SimpleEngine = tw.modules.execute("$:/core/modules/editor/engines/simple.js").SimpleEngine;
  const LarFieldEngine = makeLarFieldEngine(tw);
  // One engine slot for both of the factory's cases: the fake document takes the seam engine, a real one the
  // engine TiddlyWiki would have chosen.
  function SeamEngine(options: Record<string, any>): unknown {
    const widget = options["widget"];
    if (widget["document"]?.isTiddlyWikiFakeDom) return new LarFieldEngine(options);
    return new (widget["editShowToolbar"] ? FramedEngine : SimpleEngine)(options);
  }
  const EditText = factory(SeamEngine, SeamEngine);
  const stockOperation = EditText.prototype.handleEditTextOperationMessage;
  // TW5's own operation road over the carried pair: its operation module, the engine's executeTextOperation, its
  // saveChanges. What the seam adds is the refusal: no carried pair, or a collapsed pair under a selection
  // operation, names `selection-unavailable` instead of guessing at a caret the island never holds.
  EditText.prototype.handleEditTextOperationMessage = function (this: Record<string, any>, event: Record<string, any>): unknown {
    const engine = this["engine"];
    if (!(engine instanceof LarFieldEngine)) return stockOperation.call(this, event);
    const seam = engine as unknown as LarFieldEngineFace & { createTextOperation(): TextOperation | null; executeTextOperation(o: TextOperation): string; refuse(r: LarRefusal): void };
    const operation = seam.createTextOperation();
    if (!operation || (SELECTION_OPERATIONS.has(String(event["param"])) && operation.selStart === operation.selEnd)) {
      seam.refuse("selection-unavailable");
      return undefined;
    }
    const handler = this["editorOperations"][event["param"]];
    if (!handler) { seam.refuse("unsupported-control"); return undefined; }
    handler.call(this, event, operation);
    this["saveChanges"](seam.executeTextOperation(operation));
    return undefined;
  };
  EditText[SEAM] = true;
  classes["edit-text"] = EditText;
}

/** The seam engine a fake field node carries, or undefined for any other node. */
export function larFieldEngineOf(node: unknown): (LarFieldEngineFace & { readonly widget: Record<string, any> }) | undefined {
  const engine = (node as { _larFieldEngine?: unknown } | null | undefined)?._larFieldEngine;
  return engine && (engine as LarFieldEngineFace).larField ? engine as LarFieldEngineFace & { readonly widget: Record<string, any> } : undefined;
}
