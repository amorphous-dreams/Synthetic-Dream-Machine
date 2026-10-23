// Independent, simplified parametric check model for tooling tests.
// NOT the original Ur monument, NOT the CC BY History Builds mesh.
// The staged geometry borrows published approximate terrace dimensions.
module stepped_ur() {
    union() {
        translate([0,0,5.5]) cube([62.5,43,11],center=true);
        translate([0,2,13.8]) cube([36,26,6.3],center=true);
        translate([0,2.7,18.35]) cube([16,12,3.8],center=true);
        translate([0,3,21.8]) cube([8.1,6.5,4.2],center=true);
        // Axial approach, intentionally simplified and not survey-grade.
        hull() {
            translate([0,-32,1]) cube([4.4,1.4,1.8],center=true);
            translate([0,-20,10.8]) cube([4.4,1.4,1.8],center=true);
        }
        // The paired approaches approximate the historical tripartite relation.
        for (side=[-1,1]) hull() {
            translate([side*22,-24,1.2]) cube([2.9,1.4,1.8],center=true);
            translate([side*5,-20,10.8]) cube([2.9,1.4,1.8],center=true);
        }
    }
}
stepped_ur();
