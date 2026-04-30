<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/boot-gate >>

<<~ ahu #iam >>
```toml
uri-path     = "ha.ka.ba/api/v0.1/lararium/modules/boot-gate"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/modules/boot-gate.md"
content-type = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.87
mana         = 0.86
manao        = 0.84
manaoio      = 0.82
role         = "canonical source copy: TW5 boot gate — 3-layer trust check for corpus-promoted JS modules"
status-date   = "2026-04-30"
heleuma       = "ha"
source-file   = "packages/lararium-tw5/src/lararium-tw5.ts"
source-symbol = "_bootModules"
implements    = ["lar:///ha.ka.ba/api/v0.1/pono/heleuma/ha"]
```
<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #contract >>

## Boot Gate

Runs in `LarariumTW5._bootModules()` after TW5 `instance.boot.boot()` resolves. Queries all tiddlers that declare `implements = "lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-module-interface"` and applies three layers of trust before injecting them as live JS modules.

**This code cannot be loaded from a meme.** It requires a live `$tw` instance and is the mechanism that promotes memes into executables. It lives in `packages/lararium-tw5/src/lararium-tw5.ts` as `_bootModules()`.

<<~/ahu >>

<<~ ahu #source >>

## Source (TypeScript — compiled-in)

```typescript
private async _bootModules(): Promise<void> {
  const tw   = this._tw as any;
  const wiki = tw?.wiki;

  registerImplementorsOperator(tw);

  let injected = 0;
  try {
    const iface  = LarariumTW5.MODULE_INTERFACE_URI;
    const titles = wiki.filterTiddlers(`[all[tiddlers]implementors[${iface}]]`) ?? [];
    for (const title of titles) {
      const t = wiki.getTiddler(title);
      if (!t) continue;
      const f = t.fields as Record<string, string>;

      // Layer 1 — signal thresholds
      if (
        parseFloat(f["mana"]       ?? "0") < MODULE_MANA_THRESHOLD       ||
        parseFloat(f["manao"]      ?? "0") < MODULE_MANAO_THRESHOLD       ||
        parseFloat(f["manaoio"]    ?? "0") < MODULE_MANAOIO_THRESHOLD     ||
        parseFloat(f["confidence"] ?? "0") < MODULE_CONFIDENCE_THRESHOLD
      ) continue;

      const body = f["text"] ?? "";
      if (!body.trim() || body.startsWith("// Body injected")) continue;

      // Layer 2 — SHA-256 body hash
      const claimedHash = f["body-sha256"] ?? "";
      if (!claimedHash || !(await LarariumTW5._verifySha256(body, claimedHash))) continue;

      // Layer 3 — ceremony stamp
      if (!f["promoted-at"]) continue;

      wiki.addTiddler(new tw.Tiddler({
        title,
        type:          "application/javascript",
        "module-type": f["module-type"] ?? "library",
        text:          body,
        tags:          [],
      }));
      injected++;
    }
  } catch { /* filter unavailable — fall through */ }

  if (injected > 0) {
    try {
      const moduleText = wiki.getTiddler(
        "lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-modules"
      )?.fields?.["text"] ?? "";
      tw.modules.define(moduleText, "library", "lararium-tw5-modules");
    } catch { /* no-op */ }
    return;
  }

  // Imperative fallback: register MemeticParser, deserializer, widgets directly
  // from compiled TypeScript. See deserializer.md and widget-module.md.
}
```

<<~/ahu >>

<<~ ahu #thresholds >>

## Gate Constants

| Field | Constant | Floor |
|---|---|---|
| `mana` | `MODULE_MANA_THRESHOLD` | 0.80 |
| `manao` | `MODULE_MANAO_THRESHOLD` | 0.80 |
| `manaoio` | `MODULE_MANAOIO_THRESHOLD` | 0.75 |
| `confidence` | `MODULE_CONFIDENCE_THRESHOLD` | 0.80 |

Plus: `body-sha256` must verify via `SubtleCrypto.digest("SHA-256")`, and `promoted-at` must be non-empty.

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
