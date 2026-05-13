<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/filters/implementors >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/filters/implementors"
file-path = "bags/@lararium/tw5/filters/implementors.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: registerImplementorsOperator — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/filters/implementors.ts"
source-symbol = "registerImplementors"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/filters/implementors-tw5"
body-sha256 = "c82164bd84a76ffa89e956e10e9476374934ae5118a0de5d3e1349123fc534c1"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`implementors[X]` — returns tiddlers whose `implements` field (space-separated list) contains X.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
export function registerImplementors(tw: TW5Instance): void {
  tw.filterOperators["implementors"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
    const target  = operator.operand ?? "";
    const results: string[] = [];
    source(function (tiddler, title: string) {
      if (!tiddler) return;
      const raw: string    = String(tiddler.fields?.["implements"] ?? "");
      const tokens: string[] = tw.utils.parseStringArray(raw) ?? [];
      if (tokens.includes(target)) results.push(title);
    });
    return results;
  };
}
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/filters/implementors-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
