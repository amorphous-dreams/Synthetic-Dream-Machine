import unittest
import numpy as np
from projection_loom.evidence import prepare_reference, tolerant_line_agreement, three_area_report, DiversityArchive
class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.r=np.zeros((120,80,4),dtype=np.uint8)
        self.r[8:115,22:55,3]=255
        self.r[11:38,25:52,:3]=150
        self.r[36:48,25:52,:3]=230
        self.r[48:114,25:52,:3]=75
    def test_regions_overlap(self):
        e=prepare_reference(self.r,shape=(80,120))
        self.assertTrue(np.any((e.regions['fortress']>.05)&(e.regions['joining']>.05)))
    def test_alpha_invariant_color(self):
        e=prepare_reference(self.r)
        q=self.r.copy();q[:,:,:3]=255-q[:,:,:3]
        self.assertTrue(np.array_equal(e.reference_mask,prepare_reference(q).reference_mask))
    def test_no_blank_cheating(self):
        e=prepare_reference(self.r,shape=(80,120))
        self.assertEqual(tolerant_line_agreement(np.zeros((120,80)),e.edges['horizontal'],e.regions['fortress']),0)
    def test_identity_iou(self):
        e=prepare_reference(self.r,shape=(80,120))
        d=three_area_report(e,e.reference_mask)
        self.assertTrue(all(v['silhouette_loss']<1e-8 for v in d.values()))
    def test_diversity_keeps_distinct_niches(self):
        a=DiversityArchive((4,4))
        self.assertTrue(a.consider((.1,.1),.5,{'a':1},True))
        self.assertTrue(a.consider((.8,.9),.6,{'a':2},True))
        self.assertFalse(a.consider((.1,.1),.7,{'a':3},True))
        self.assertEqual(len(a.cells),2)
    def test_invalid_cannot_enter_archive(self):
        self.assertFalse(DiversityArchive().consider((.5,.5),0,{},False))
if __name__=='__main__':unittest.main()
