<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/lele-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/lele-tw5"
file-path = "packages/lararium-tw5/memes/widgets/lele-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: LeleWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "LeleWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/lele.ts
function LeleWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
LeleWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("meta");
	el.setAttribute("data-lar-kind", "lele");
	el.setAttribute("data-lar-target", this.getAttribute("target", ""));
	parent.appendChild(el);
	this.domNodes = [el];
};
LeleWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.LeleWidget = LeleWidget;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled IIFE artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "LeleWidget"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/widgets/lele`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
