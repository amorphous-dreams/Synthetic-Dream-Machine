<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/toml-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/toml-tw5"
file-path = "packages/lararium-tw5/memes/widgets/toml-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: TomlWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "TomlWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/toml.ts
function TomlWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
TomlWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const el = this.document.createElement("script");
	el.setAttribute("type", "application/toml");
	el.setAttribute("data-lar-kind", "toml");
	el.textContent = this.getAttribute("content", "");
	parent.appendChild(el);
	this.domNodes = [el];
};
TomlWidget.prototype.execute = function() {
	this.makeChildWidgets();
};
//#endregion
exports.TomlWidget = TomlWidget;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/tw5-widgets.ts` (`source-symbol = "TomlWidget"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/widgets/toml`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
