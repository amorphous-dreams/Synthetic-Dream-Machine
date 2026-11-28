"""External archive fetcher: locks, OAuth, checksum and zip-slip boundaries."""
import importlib.util
import io
import json
from pathlib import Path
import zipfile
import pytest

PATH=Path(__file__).resolve().parents[1]/'scripts/fetch_references.py'
spec=importlib.util.spec_from_file_location('fetch_ref',PATH)
ref=importlib.util.module_from_spec(spec)
spec.loader.exec_module(ref)


def zip_bytes(entries):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        for name,data in entries.items():z.writestr(name,data)
    return out.getvalue()


def test_reference_requires_reviewed_lock(tmp_path):
    b=zip_bytes({'source/test.scad':'cube([1,2,3]);','source/test.stl':'dummy stl'})
    def fake(url,*,max_bytes,token=None):return b
    with pytest.raises(ValueError,match='reviewed'):
        ref.acquire('brutalism2',tmp_path,fetch=fake,lockfile=tmp_path/'lock.json')
    receipt=ref.acquire('brutalism2',tmp_path,bootstrap=True,fetch=fake,lockfile=tmp_path/'lock.json')
    assert len(receipt['files'])==2 and receipt['sha256']==ref._sha256(b)
    assert not receipt['locked']
    again=ref.acquire('brutalism2',tmp_path,offline=True,lockfile=tmp_path/'lock.json')
    assert again['locked']
    assert (tmp_path/'extracted/brutalism2/source/test.scad').read_text()=='cube([1,2,3]);'
    assert (tmp_path/'receipts/brutalism2.json').is_file()


def test_locked_reference_evergreen_drift_refused(tmp_path):
    b=zip_bytes({'part.scad':'cube(2);'})
    original=lambda url,*,max_bytes,token=None:b
    lock=tmp_path/'lock.json'
    ref.acquire('brutalism',tmp_path,bootstrap=True,fetch=original,lockfile=lock)
    wrong=lambda url,*,max_bytes,token=None:zip_bytes({'part.scad':'cube(9);'})
    with pytest.raises(ValueError,match='changed'):
        ref.acquire('brutalism',tmp_path,fetch=wrong,lockfile=lock)


@pytest.mark.parametrize('name',('../escaped.scad','/absolute.stl','dir/../../escaped.scad','C:/other.obj','wrong.exe'))
def test_reference_archive_rejects_unsafe_paths(tmp_path,name):
    data=zip_bytes({name:'invalid'})
    with pytest.raises(ValueError,match='Unsafe|Unexpected'):
        ref.safe_extract(data,tmp_path/'extracted')
    assert not (tmp_path/'escaped.scad').exists()


def test_reject_expansion_bomb(tmp_path,monkeypatch):
    monkeypatch.setattr(ref,'MAX_UNPACKED',100)
    with pytest.raises(ValueError,match='expansion'):
        ref.safe_extract(zip_bytes({'big.obj':'x'*200}),tmp_path/'unpacked')


def test_sketchfab_needs_oauth_and_never_persists_signed_url(tmp_path):
    with pytest.raises(RuntimeError,match='OAuth'):
        ref._resolve_url(ref.SOURCES['ur-lowpoly'])
    seen=[]
    archive=zip_bytes({'scene.gltf':'{}','scene.bin':'bin'})
    def fake(url,*,token=None,max_bytes=None):
        seen.append((url,token))
        if '/download' in url:
            return json.dumps({'gltf':{'url':'https://asset.example.com/temporary.zip?token=signed-secret'}}).encode()
        return archive
    lock=tmp_path/'locked.json'
    out=ref.acquire('ur-lowpoly',tmp_path,lockfile=lock,bootstrap=True,token='my-token',fetch=fake)
    assert len(seen)==2 and all(x[1]=='my-token' or x[1] is None for x in seen)
    assert out['license']=='CC-BY-4.0'
    assert 'my-token' not in lock.read_text()
    assert 'signed-secret' not in (tmp_path/'receipts/ur-lowpoly.json').read_text()


def test_operator_official_download_can_enter_same_lock_path(tmp_path):
    archive=tmp_path/'from-browser.zip'
    archive.write_bytes(zip_bytes({'scene.gltf':'{}','scene.bin':'xxx'}))
    lock=tmp_path/'lock.json'
    receipt=ref.acquire('ur-lowpoly',tmp_path/'cache',lockfile=lock,
                        bootstrap=True,import_archive=archive)
    assert receipt['source']=='ur-lowpoly' and receipt['license']=='CC-BY-4.0'
    assert len(receipt['files'])==2
    assert ref.acquire('ur-lowpoly',tmp_path/'cache',lockfile=lock,offline=True)['locked']
