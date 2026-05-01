<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/dynamic-tw5 >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/widgets/dynamic-tw5"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/widgets/dynamic-tw5.md"
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
(function(){
"use strict";
exports.dynamic = function DynamicWidget(parseTreeNode, options) { this.initialise(parseTreeNode, options); };
exports.dynamic.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  var el = this.document.createElement("span");
  el.setAttribute("data-lar-kind",  "dynamic");
  el.setAttribute("data-lar-sigil", this.parseTreeNode?.tag ?? "");
  parent.appendChild(el);
  this.domNodes = [el];
  this.renderChildren(el, nextSibling);
};
exports.dynamic.prototype.execute = function() { this.makeChildWidgets(); };
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
