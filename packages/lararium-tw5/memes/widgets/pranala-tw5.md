<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/pranala-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/pranala-tw5"
file-path = "packages/lararium-tw5/memes/widgets/pranala-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: PranalaWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "PranalaWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/pranala.ts
function PranalaWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
PranalaWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("meta");
	el.setAttribute("data-lar-kind", "pranala");
	el.setAttribute("data-lar-from", this.getAttribute("from", ""));
	el.setAttribute("data-lar-to", this.getAttribute("to", ""));
	el.setAttribute("data-lar-family", this.getAttribute("family", ""));
	el.setAttribute("data-lar-role", this.getAttribute("role", ""));
	parent.appendChild(el);
	this.domNodes = [el];
};
PranalaWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.PranalaWidget = PranalaWidget;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "PranalaWidget"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/widgets/pranala`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
