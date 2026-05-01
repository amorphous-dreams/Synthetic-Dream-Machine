<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/filters/edge-tw5 >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/filters/edge-tw5"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/filters/edge-tw5.md"
type          = "application/javascript"
module-type   = "filteroperator"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 filter operator: edge — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "registerEdgeOperator"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>
(function(){
"use strict";
exports.edge = function(source, operator) {
  var family  = operator.suffix ?? "";
  var role    = operator.operand ?? "";
  var results = [];
  source(function(tiddler, title) {
    if (!tiddler) return;
    if (role) {
      var v = tiddler.fields?.["edge-out-" + family + "-" + role];
      if (v !== undefined && v !== "") results.push(title);
    } else {
      var prefix = "edge-out-" + family + "-";
      if (Object.keys(tiddler.fields ?? {}).some(function(k) { return k.startsWith(prefix); })) results.push(title);
    }
  });
  return results;
};
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
