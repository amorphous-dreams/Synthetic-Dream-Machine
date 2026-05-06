<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/ahu-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/ahu-tw5"
file-path = "packages/lararium-tw5/memes/widgets/ahu-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: AhuWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "AhuWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/render-modes.ts
/**
* Dispatch text-output render modes for a child-slot sigil widget.
* Returns the raw text string to emit, or null if HTML mode should proceed.
*/
function dispatchSlotRenderMode(mode, ctx) {
	const { sigil, slot, childUri, wiki } = ctx;
	if (mode === "carrier") return {
		kind: "text",
		raw: `<<~ ${sigil} ${slot} >>\n${wiki.getTiddlerText?.(childUri, "") ?? ""}\n<<~/${sigil} >>`
	};
	if (mode === "projection") return {
		kind: "text",
		raw: `<<~ aka ${sigil} ${slot} >>`
	};
	return null;
}
//#endregion
//#region src/widgets/ahu.ts
function AhuWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
AhuWidget.prototype.render = function(parent, nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const slot = this.getAttribute("slot", "");
	const renderMode = this.getVariable?.("lar-render-mode") ?? "";
	const parentUri = this.getVariable?.("currentTiddler") ?? "";
	const childUri = this.getAttribute("uri", "") || parentUri + slot;
	const modeResult = dispatchSlotRenderMode(renderMode, {
		sigil: "ahu",
		slot,
		childUri,
		wiki: this.wiki,
		document: this.document
	});
	if (modeResult !== null) {
		const text = this.document.createTextNode(modeResult.raw);
		parent.insertBefore(text, nextSibling);
		this.domNodes = [text];
		return;
	}
	const projection = this.getAttribute("projection", "") === "true";
	const el = this.document.createElement("section");
	el.setAttribute("data-lar-kind", "ahu");
	el.setAttribute("data-lar-slot", slot);
	el.setAttribute("data-lar-uri", childUri);
	if (projection) el.setAttribute("data-lar-projection", "true");
	parent.appendChild(el);
	this.domNodes = [el];
	if (!childUri) {
		const hole = this.document.createElement("span");
		hole.setAttribute("data-lar-kind", "hole");
		hole.textContent = `? ahu ${slot}`;
		el.appendChild(hole);
		return;
	}
	this.setVariable?.("currentTiddler", childUri);
	const transclude = this.wiki?.makeTranscludeWidget?.(childUri, {
		document: this.document,
		parentWidget: this
	});
	if (transclude) {
		transclude.render(el, null);
		this.children = [transclude];
	} else {
		const hole = this.document.createElement("span");
		hole.setAttribute("data-lar-kind", "hole");
		hole.textContent = `? ahu ${slot}`;
		el.appendChild(hole);
	}
};
AhuWidget.prototype.execute = function() {};
AhuWidget.prototype.refresh = function(changedTiddlers) {
	const slot = this.getAttribute("slot", "");
	const childUri = this.getAttribute("uri", "");
	const parentUri = this.getVariable?.("currentTiddler") ?? "";
	if (changedTiddlers[childUri || parentUri + slot]) {
		this.refreshSelf();
		return true;
	}
	let changed = false;
	for (const child of this.children ?? []) if (child.refresh(changedTiddlers)) changed = true;
	return changed;
};
//#endregion
exports.AhuWidget = AhuWidget;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "AhuWidget"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/widgets/ahu`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
