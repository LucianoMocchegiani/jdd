import assert from 'node:assert/strict';
import test from 'node:test';
import { isAreaTargetWithinRange } from './area-target-range.ts';
test('area target must be finite and within configured reach',()=>{assert.equal(isAreaTargetWithinRange({x:3,y:4,z:0},{x:0,y:0,z:0},5),true);assert.equal(isAreaTargetWithinRange({x:3,y:4,z:0},{x:0,y:0,z:0},4.9),false);assert.equal(isAreaTargetWithinRange({x:Number.NaN,y:0,z:0},{x:0,y:0,z:0},5),false)});
