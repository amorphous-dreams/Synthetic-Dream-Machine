<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/dynamic-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/dynamic-tw5"
file-path = "bags/@lararium/tw5/widgets/dynamic-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: DynamicWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "DynamicWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/dynamic.ts
function DynamicWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
DynamicWidget.prototype.render = function(parent, nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("span");
	el.setAttribute("data-lar-kind", "dynamic");
	el.setAttribute("data-lar-sigil", this.parseTreeNode?.tag ?? "");
	parent.appendChild(el);
	this.domNodes = [el];
	this.renderChildren(el, nextSibling);
};
DynamicWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.DynamicWidget = DynamicWidget;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "DynamicWidget"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/widgets/dynamic`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
