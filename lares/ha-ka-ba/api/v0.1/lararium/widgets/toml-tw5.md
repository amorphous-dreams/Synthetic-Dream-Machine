<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/toml-tw5 >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/widgets/toml-tw5"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/widgets/toml-tw5.md"
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
(function(){
"use strict";
exports.toml = function TomlWidget(parseTreeNode, options) { this.initialise(parseTreeNode, options); };
exports.toml.prototype.render = function(parent, _nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  var el = this.document.createElement("script");
  el.setAttribute("type",          "application/toml");
  el.setAttribute("data-lar-kind", "toml");
  el.textContent = this.getAttribute("content", "");
  parent.appendChild(el);
  this.domNodes = [el];
};
exports.toml.prototype.execute = function() { this.makeChildWidgets(); };
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
