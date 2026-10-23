"""Opt-in external witnesses with reproducible content locks, safe extraction.

No third-party archive becomes CAD-valid simply because its bytes arrived.
A first fetch produces a SHA-256 receipt; only a reviewed/committed lock may be
used by automated reproducible jobs. Sketchfab downloads use its official API.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tempfile
import urllib.request
import urllib.parse
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'brutalism': {
        'url': 'https://opengameart.org/sites/default/files/brutalism.zip',
        'source_page': 'https://opengameart.org/content/brutalist-architecture-models',
        'license': 'CC0-1.0', 'provider': 'https-zip',
    },
    'brutalism2': {
        'url': 'https://opengameart.org/sites/default/files/brutalism2.zip',
        'source_page': 'https://opengameart.org/content/brutalist-architecture-models',
        'license': 'CC0-1.0', 'provider': 'https-zip',
    },
    'ur-lowpoly': {
        'source_page': 'https://sketchfab.com/3d-models/ziggurat-f2ffb4bd5200400eac37fbce5c010ef0',
        'model_uid': 'f2ffb4bd5200400eac37fbce5c010ef0',
        'license': 'CC-BY-4.0', 'provider': 'sketchfab-oauth',
        'author': 'History Builds',
    },
}
MAX_ARCHIVE = 64 * 1024 * 1024
MAX_UNPACKED = 300 * 1024 * 1024
MAX_FILES = 1000
ALLOWED_SUFFIXES = frozenset({'.scad', '.stl', '.obj', '.mtl', '.gltf', '.glb',
    '.bin', '.png', '.jpg', '.jpeg', '.txt', '.md', '.json', '.webp', '.license'})


def _sha256(data):
    return hashlib.sha256(data).hexdigest()


def _https(url):
    u = urllib.parse.urlparse(url)
    if u.scheme != 'https' or not u.hostname or u.username or u.password or u.fragment:
        raise ValueError('Only authenticated or public HTTPS reference URLs are supported')
    return url


def fetch_bytes(url, *, token=None, max_bytes=MAX_ARCHIVE):
    url = _https(url)
    headers = {'User-Agent': 'Projection-Loom-Reference-Fetch/1.0'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        if urllib.parse.urlparse(response.url).scheme != 'https':
            raise ValueError('Reference redirect downgraded transport security')
        announced = response.headers.get('Content-Length')
        if announced and int(announced) > max_bytes:
            raise ValueError('Reference archive exceeds download limit')
        out = bytearray()
        while True:
            chunk = response.read(min(128 * 1024, max_bytes + 1 - len(out)))
            if not chunk:
                break
            out.extend(chunk)
            if len(out) > max_bytes:
                raise ValueError('Reference archive exceeded download limit')
        return bytes(out)


def _resolve_url(source, *, token=None, fetch=fetch_bytes):
    if source['provider'] == 'https-zip':
        return source['url']
    if not token:
        raise RuntimeError('Sketchfab requires a user OAuth access token in SKETCHFAB_TOKEN; '
                           'do not scrape preview geometry or commit the token')
    uid = source['model_uid']
    raw = fetch(f'https://api.sketchfab.com/v3/models/{uid}/download', token=token,
                max_bytes=200_000)
    record = json.loads(raw)
    url = record.get('gltf', {}).get('url')
    if not url:
        raise RuntimeError('Authenticated Sketchfab response supplied no glTF archive')
    return _https(url)  # Temporary signed URL; never persist it.


def safe_extract(raw, out):
    """Return deterministic listing; refuse path traversal, links and zip bombs."""
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise ValueError('Reference download did not provide a ZIP archive')
    out = Path(out)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        members = z.infolist()
        if len(members) > MAX_FILES or sum(x.file_size for x in members) > MAX_UNPACKED:
            raise ValueError('Reference ZIP exceeds expansion budget')
        planned = []
        seen = set()
        for item in members:
            normalized = item.filename.replace('\\', '/')
            p = PurePosixPath(normalized)
            if (p.is_absolute() or '..' in p.parts or not p.parts or
                    re.match(r'^[A-Za-z]:', normalized) or '\x00' in normalized):
                raise ValueError('Unsafe path in reference archive')
            if item.is_dir():
                continue
            kind = (item.external_attr >> 16) & 0o170000
            if kind == stat.S_IFLNK:
                raise ValueError('Symlinks cannot enter the reference cache')
            if p.suffix.lower() not in ALLOWED_SUFFIXES:
                raise ValueError(f'Unexpected reference file type: {p.name}')
            target = str(p)
            if target.lower() in seen:
                raise ValueError('Duplicate reference path in ZIP')
            seen.add(target.lower())
            planned.append((item, target))
        out.mkdir(parents=True, exist_ok=True)
        listing = []
        for item, relative in planned:
            target = out.joinpath(*PurePosixPath(relative).parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(item) as source, target.open('wb') as dest:
                shutil.copyfileobj(source, dest)
            data = target.read_bytes()
            listing.append({'path': relative, 'bytes': len(data), 'sha256': _sha256(data)})
        return sorted(listing, key=lambda x: x['path'])


def acquire(source_id, cache, *, lockfile=None, bootstrap=False, offline=False,
            token=None, fetch=fetch_bytes, import_archive=None):
    if source_id not in SOURCES:
        raise ValueError(f'Unknown reference: {source_id}')
    spec = SOURCES[source_id]
    cache = Path(cache)
    expected = {}
    lock = Path(lockfile) if lockfile is not None else None
    if lock and lock.exists():
        obj = json.loads(lock.read_text())
        if obj.get('schema') != 'projection-loom/reference-lock/v1':
            raise ValueError('Unrecognized reference lock schema')
        expected = dict(obj.get('sources', {}))
    if not bootstrap and source_id not in expected:
        raise ValueError('Missing independently reviewed content lock; use --bootstrap-lock '
                         'then review and commit the generated lock file')
    archive = cache / 'archives' / (source_id + '.zip')
    if import_archive is not None and offline:
        raise ValueError('Choose either offline cache or one operator-downloaded archive')
    if import_archive is not None:
        # The operator may use an official browser download, including Sketchfab OAuth.
        # The local archive still undergoes the same hashing, lock and ZIP checks.
        path = Path(import_archive)
        if path.stat().st_size > MAX_ARCHIVE:
            raise ValueError('Reference archive exceeds size limit')
        raw = path.read_bytes()
    elif offline:
        if not archive.is_file():
            raise FileNotFoundError(f'Offline reference archive missing: {archive}')
        raw = archive.read_bytes()
    else:
        url = _resolve_url(spec, token=token, fetch=fetch)
        raw = fetch(url, max_bytes=MAX_ARCHIVE)
    if len(raw) > MAX_ARCHIVE:
        raise ValueError('Reference archive exceeds size limit')
    digest = _sha256(raw)
    if source_id in expected and digest != expected[source_id].get('sha256'):
        raise ValueError('Reference changed from the recorded SHA-256 lock')
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not offline:
        with tempfile.NamedTemporaryFile(dir=archive.parent, delete=False) as f:
            f.write(raw)
            temp = Path(f.name)
        os.replace(temp, archive)
    # Extraction does not clobber previously verified samples on failure.
    extraction = cache / 'extracted' / source_id
    extraction.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=source_id+'-', dir=extraction.parent))
    try:
        listing = safe_extract(raw, stage)
        if extraction.exists():
            shutil.rmtree(extraction)
        os.replace(stage, extraction)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    receipt = {'schema': 'projection-loom/reference-receipt/v1', 'source': source_id,
               'source_page': spec['source_page'], 'license': spec['license'],
               'sha256': digest, 'bytes': len(raw), 'locked': source_id in expected,
               'files': listing, 'archive_path': str(archive),
               'extract_root': str(extraction)}
    receipts = cache / 'receipts'
    receipts.mkdir(exist_ok=True)
    (receipts / (source_id+'.json')).write_text(json.dumps(receipt, indent=2)+'\n')
    if bootstrap:
        if lock is None:
            raise ValueError('--bootstrap-lock requires a lock file path')
        if source_id in expected and expected[source_id].get('sha256') != digest:
            raise ValueError('Content changed; review and edit a new lock separately')
        expected[source_id] = {'sha256': digest, 'bytes': len(raw),
                               'source_page': spec['source_page'], 'license': spec['license']}
        lock.parent.mkdir(parents=True, exist_ok=True)
        lock.write_text(json.dumps({'schema': 'projection-loom/reference-lock/v1',
                                    'sources': dict(sorted(expected.items()))}, indent=2)+'\n')
    return receipt


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', choices=sorted(SOURCES), required=True)
    parser.add_argument('--cache', type=Path, default=ROOT/'.ref-cache')
    parser.add_argument('--lockfile', type=Path, default=ROOT/'references.lock.json')
    parser.add_argument('--bootstrap-lock', action='store_true', help='operator review required before committing resulting lock')
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--import-archive', type=Path,
                        help="ZIP obtained through the source official download page")
    args = parser.parse_args(argv)
    receipt = acquire(args.source, args.cache, lockfile=args.lockfile,
                      bootstrap=args.bootstrap_lock, offline=args.offline,
                      token=os.getenv('SKETCHFAB_TOKEN'), import_archive=args.import_archive)
    print(json.dumps({k:receipt[k] for k in ('source','sha256','bytes','locked','extract_root')}))
    return receipt


if __name__ == '__main__':
    main()
