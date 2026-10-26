"""Optional backend policies are explicit and never auto-installed."""
import pytest
from projection_loom.optional_studies import pyribs_archive_pilot


def test_qd_pilot_needs_separate_optional_install():
    try:
        import ribs
    except ImportError:
        with pytest.raises(ImportError):
            pyribs_archive_pilot({"candidates":[{"changed_pixels_all_views":1,"expressed_views":["front"]}]})
    else:
        output=pyribs_archive_pilot({"candidates":[
            {"changed_pixels_all_views":1,"expressed_views":["front"]},
            {"changed_pixels_all_views":10,"expressed_views":["front","back"]}]})
        assert output["candidates"]==2
        assert 1<=output["occupied_cells"]<=2
