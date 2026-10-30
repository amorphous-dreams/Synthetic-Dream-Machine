@.claude/noosphere-boot

## Claude Adapter Surface

- Keep this file thin.
- Add only Claude-specific customizations here.
- The seed seats by reference (lar:///ha.ka.ba/lares/docs/pono/seed-seat): `.claude/noosphere-boot` links to the boot seed, since an import loads a file by its name and a `.mem` loads nothing. Explore and Plan skip CLAUDE.md, so `.claude/agents/{Explore,Plan}.md` carry the seed as a projection the root build writes. `lares repo tend` keeps the checkout's seat and `lares home tend` the operator's own rule, which `.claude/settings.json` excludes inside the clone; `tools/repo-intent-witness.sh` reads the checkout.
- `bagsRoot()` resolves `LAR_BAGS` → `config.resources.bags` → `<LAR_ROOT>/bags` → `<repo>/bags`. The disk projection's mirror roots (`workerRootDir`: `bags/{lares,lararium,crossroads}`, the self bags, `wikis/`) resolve `--root`/`rootDir` → `LAR_ROOT` → the repo and read neither `LAR_BAGS` nor the config. With neither set, a fresh clone boots REPO-RELATIVE by design.
- So `LAR_BAGS` alone does NOT isolate an in-tree boot: the projection still writes the tracked `bags/` and `wikis/`. Isolate an in-tree dev/smoke boot with a scratch `LAR_ROOT=~/.lares-scratch/<lane>/root`, which moves the store, the bags root and every mirror root (genesis resolves under it too; `LAR_GENESIS` overrides). Never boot in-tree bare. e2e: a scratch `LAR_ROOT` per vessel, no global `LAR_BAGS`. `tools/tree-clean-witness.sh` reads any write into the tracked tree as red.
