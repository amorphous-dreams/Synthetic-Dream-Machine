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



def test_opt_in_topologic_pilot_checks_all_native_assemblies(monkeypatch):
    import sys,types
    from projection_loom.optional_studies import topologic_route_pilot
    root=types.ModuleType("topologicpy")
    v=types.ModuleType("topologicpy.Vertex")
    e=types.ModuleType("topologicpy.Edge")
    g=types.ModuleType("topologicpy.TGraph")
    class Vertex:
        @staticmethod
        def ByCoordinates(x,y,z):return (x,y,z)
    class Edge:
        @staticmethod
        def ByVertices(a,b):return (a,b)
    class TGraph:
        @staticmethod
        def ByVerticesEdges(vertices,edges):return vertices,edges
        @staticmethod
        def Vertices(graph):return graph[0]
        @staticmethod
        def Edges(graph):return graph[1]
    v.Vertex=Vertex;e.Edge=Edge;g.TGraph=TGraph
    for name,module in (("topologicpy",root),("topologicpy.Vertex",v),
                        ("topologicpy.Edge",e),("topologicpy.TGraph",g)):
        monkeypatch.setitem(sys.modules,name,module)
    place={"source_witness_id":"a","assemblies":[
        {"routes":{"voids":["entry","hall"],"links":[["entry","hall"]]}},
        {"routes":{"voids":[],"links":[]}}]}
    result=topologic_route_pilot(place)
    assert result["assemblies"]==[
        {"assembly":0,"nodes":2,"edges":1,"state":"observed"},
        {"assembly":1,"nodes":0,"edges":0,"state":"empty"}]
