@bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem

## Claude Adapter Surface

- Keep this file thin.
- Add only Claude-specific customizations here.
- `bagsRoot()`/`workerRootDir` default REPO-RELATIVE (by design, so a fresh clone boots with no config). An in-tree dev/smoke boot that does not set `LAR_BAGS` (or `LAR_ROOT`/`~/.lares/config.json`) to an isolated scratch dir therefore writes real projection artifacts — including boot-side-effect pointers a private-nexus-of-one mints — straight into the tracked tree.
- Always export `LAR_BAGS=/tmp/<scratch>` (or equivalent) before an in-tree dev/smoke boot; never boot in-tree bare.
