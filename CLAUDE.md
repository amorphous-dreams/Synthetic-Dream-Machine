@bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem

## Claude Adapter Surface

- Keep this file thin.
- Add only Claude-specific customizations here.
- `bagsRoot()` resolves `LAR_BAGS` → `config.resources.bags` → `<LAR_ROOT>/bags` → `<repo>/bags`. The disk projection's mirror roots (`workerRootDir`: `bags/{lares,lararium,crossroads}`, the self bags, `wikis/`) resolve `--root`/`rootDir` → `LAR_ROOT` → the repo and read neither `LAR_BAGS` nor the config. With neither set, a fresh clone boots REPO-RELATIVE by design.
- So `LAR_BAGS` alone does NOT isolate an in-tree boot: the projection still writes the tracked `bags/` and `wikis/`. Isolate an in-tree dev/smoke boot with a scratch `LAR_ROOT=/tmp/<scratch>`, which moves the store, the bags root and every mirror root (genesis resolves under it too; `LAR_GENESIS` overrides). Never boot in-tree bare. e2e: a scratch `LAR_ROOT` per vessel, no global `LAR_BAGS`. `tools/tree-clean-witness.sh` reads any write into the tracked tree as red.
