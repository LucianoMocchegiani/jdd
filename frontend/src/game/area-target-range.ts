export interface CellPoint { x:number; y:number; z:number; }
export function isAreaTargetWithinRange(target:CellPoint,origin:CellPoint,range:number):boolean{
 return [target.x,target.y,target.z,origin.x,origin.y,origin.z,range].every(Number.isFinite)&&range>0&&Math.hypot(target.x-origin.x,target.y-origin.y,target.z-origin.z)<=range;
}
