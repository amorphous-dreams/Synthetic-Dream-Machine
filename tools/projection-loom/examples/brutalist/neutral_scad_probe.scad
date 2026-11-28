// Original, subject-neutral test fixture written for Projection Loom.
// This is NOT a copy of nosycat's CC0 Brutalist archive.
// Model units are abstract units; no surveyed scale claimed.
$fn = 18;
module massing() {
    union() {
        translate([0,0,4]) cube([26,16,8],center=true);
        translate([2.8,0,10.7]) cube([19,13,6],center=true);
        translate([-5.5,-0.7,17]) cube([14,11,7],center=true);
        translate([11,0,11.5]) cube([13,9,2.8],center=true); // cantilever
    }
}
difference() {
  massing();
  translate([0,-7.6,3.1]) cube([3.0,3.0,5.8],center=true); // entrance
  for (z=[8.8,11.0]) for (x=[-4.5,0,4.5,9])
    translate([x,-6.4,z]) cube([1.8,3.7,1.3],center=true);
}
