// Geometry, objectives and physics use the same coordinates on every screen.
export const SCALE=1.8;
export const HALF_X=9*SCALE, HALF_Z=6*SCALE, TILE=2*SCALE;
export const SPAWN=[-6.6*SCALE,3.5*SCALE];
export const ROCKET=[7*SCALE,0];
export const CELLS=[[-5,-3],[0,3],[4,-3]].map(([x,z])=>[x*SCALE,z*SCALE]);
export const STONES=[[-6.6,3.5,2.4,2.2],[-5,-3,2.5,2.5],[-2,-1,2.3,2.3],[0,3,2.5,2.5],[2,0,2.2,2.2],[4,-3,2.5,2.5],[7,0,3,3]].map(([x,z,w,d])=>[x*SCALE,z*SCALE,w*1.3,d*1.3]);
export const BANANAS=[[-13,-8],[-12,8],[12,8],[13,-7],[1,-8],[6,8]];
export const SPRINGS=[[-12,-2],[3,7],[10,-1],[-4,-5]];
