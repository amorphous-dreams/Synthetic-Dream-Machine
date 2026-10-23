# Reference acquisition and CI: evidence, not invisible dependencies

## Sources and licenses

| ID | Provider | Source page | License | Machine path |
|---|---|---|---|---|
| `brutalism` | nosycat / OpenGameArt | https://opengameart.org/content/brutalist-architecture-models | CC0 | direct `brutalism.zip` |
| `brutalism2` | nosycat / OpenGameArt | same page | CC0 | direct `brutalism2.zip` |
| `ur-lowpoly` | History Builds / Sketchfab | https://sketchfab.com/3d-models/ziggurat-f2ffb4bd5200400eac37fbce5c010ef0 | CC BY | official authenticated Download API, or official browser download |

Source pages and licensing metadata were checked on 2026-10-23. Source content
has NOT been downloaded into the repo. The fetched archives retain their own
licenses and must not be silently redistributed as machine-derived CAD.

Sketchfab's official API requires a user OAuth token and supplies a short-lived
signed `gltf` ZIP URL; the downloader never writes that URL or token into
receipts, commits or workflow logs. GitHub PR builds MUST NOT load secrets.

## Local commands: Python 3.12 + OpenSCAD

```bash
cd tools/projection-loom
python -m pip install -r requirements-ci.txt
python -m pip install --no-deps -e .
python scripts/check_env.py
python -m pytest -q tests
python examples/necrospire/hybrid/hybrid_demo.py --out out/hybrid
```

On Ubuntu/WSL, install OpenSCAD with `sudo apt-get install openscad`.
On Windows, use the official OpenSCAD installation and ensure `openscad`
appears on `PATH`. Both commands use the same Python scripts.

## Bootstrap a third-party asset, then review and commit its hash

```bash
python scripts/fetch_references.py --source brutalism2 \
  --cache .ref-cache --lockfile references.lock.local.json --bootstrap-lock
python scripts/inspect_reference_pack.py \
  --receipt .ref-cache/receipts/brutalism2.json \
  --compile-one-scad --out .ref-cache/reference-evidence.json
```

The first run deliberately marks its receipt **unlocked**. Review its author,
license, geometry, files and SHA-256, then put a reviewed copy of the lock under
version control. Subsequent runs reject a changed archive:

```bash
python scripts/fetch_references.py --source brutalism2 \
  --cache .ref-cache --lockfile references.lock.json
```

If the provider requires browser authentication, obtain the ZIP through the
published Download action and use `--import-archive ./my-official-download.zip`
with `--bootstrap-lock`; *do not scrape the Sketchfab viewer*. To use the
API directly, set `SKETCHFAB_TOKEN` in your local shell, not in a PR job:

```bash
python scripts/fetch_references.py --source ur-lowpoly \
  --cache .ref-cache --lockfile references.lock.local.json --bootstrap-lock
```

Use `--offline` to verify local cached bytes against a reviewed lock.

## GitHub Actions

`.github/workflows/projection-loom.yml` adds an independent **read-only** CI
job for PR #84's target branch, plus push CI for the working branch. It uses
Python 3.12, explicitly constrained direct dependencies, OpenSCAD, all tests,
Ur/Brutalist validation, and a hybrid Necrospire smoke run. It uploads STEP,
preview controls and dependency/kernel receipts as short-retention artifacts.

An optional `workflow_dispatch` job fetches the public CC0 archive, runs a
bounded OpenSCAD + STL witness check, and uploads an **unreviewed** source hash.
This dispatch needs a workflow reachable from GitHub's default branch; it may
not appear in the Actions menu until that happens. No Sketchfab token enters
this workflow. The manual local fetch commands remain available meanwhile.

## Failure and scope boundaries

- A GitHub Actions runner can fetch package libraries through pip/apt; this does
  not mean it possesses the third-party models absent a successful source fetch.
- The reference ZIP parser caps compressed and expanded bytes, number of files,
  file types and path traversal. No imported geometry bypasses CAD validity.
- GitHub Actions' PR test checks code and *synthetic* model fixtures by default.
  A successful test does not certify fidelity to the third-party Ur or Brutalist
  source when neither has been downloaded and registered.
- SHA-256 pinning protects subsequent reproducibility; it does not settle the
  source's scientific quality or commercial AI reuse permission.
- Dependencies directly pinned in `requirements-ci.txt`; transitive versions
  appear in the exported `pip freeze` artifact. A full multi-platform lock is
  a future upgrade.
