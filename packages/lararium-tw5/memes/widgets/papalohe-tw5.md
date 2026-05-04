<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/papalohe-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/papalohe-tw5"
file-path = "packages/lararium-tw5/memes/widgets/papalohe-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: PapaloheWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "PapaloheWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/papalohe.ts
function PapaloheWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
PapaloheWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("meta");
	el.setAttribute("data-lar-kind", "papalohe");
	el.setAttribute("data-lar-from", this.getAttribute("from", ""));
	el.setAttribute("data-lar-to", this.getAttribute("to", ""));
	el.setAttribute("data-lar-trigger", this.getAttribute("trigger", ""));
	el.setAttribute("data-lar-fn", this.getAttribute("fn", ""));
	el.setAttribute("data-lar-slot", this.getAttribute("slot", ""));
	parent.appendChild(el);
	this.domNodes = [el];
};
PapaloheWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.PapaloheWidget = PapaloheWidget;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled IIFE artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "PapaloheWidget"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/widgets/papalohe`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
