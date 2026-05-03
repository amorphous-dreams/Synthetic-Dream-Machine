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
(function(){
"use strict";
exports.lele = function LeleWidget(parseTreeNode, options) { this.initialise(parseTreeNode, options); };
exports.lele.prototype.render = function(parent, _nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  var el = this.document.createElement("meta");
  el.setAttribute("data-lar-kind",   "lele");
  el.setAttribute("data-lar-target", this.getAttribute("target", ""));
  parent.appendChild(el);
  this.domNodes = [el];
};
exports.lele.prototype.execute = function() { this.makeChildWidgets(); };
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
