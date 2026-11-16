import { BODY_ACTIONS } from '@/game-data/actions';
import type { ActionDefinition } from '@/types/action';
import type { AreaSpellEvent, CellPosition } from '@/types/world-events';
import { isTextInputFocused } from '@/game/input/keyboard-state';
import { DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster, RingGeometry, Scene, SphereGeometry, CylinderGeometry, Vector2, type Camera } from 'three';
import type { TerrainStore } from '@/game/terrain/terrain-store';

const TARGET_EVENT = 'area-ability-target';
type Cast = (action: ActionDefinition, target: CellPosition) => void;
export function isAreaTargetWithinRange(target: CellPosition, origin: CellPosition, range: number): boolean {
  return [target.x,target.y,target.z,origin.x,origin.y,origin.z,range].every(Number.isFinite) && range > 0 && Math.hypot(target.x-origin.x,target.y-origin.y,target.z-origin.z) <= range;
}

export class AreaAbilityTargeting {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly marker = new Mesh(new RingGeometry(0.82, 1, 40), new MeshBasicMaterial({ color: 0x55ddff, transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false }));
  private action: ActionDefinition | null = null;
  private target: CellPosition | null = null;
  private pointerX = 0;
  private pointerY = 0;
  constructor(private readonly scene: Scene, private readonly camera: Camera, private readonly canvas: HTMLCanvasElement, private readonly terrain: TerrainStore, private readonly cellSize: number, private readonly cast: Cast) {
    this.marker.rotation.x=-Math.PI/2;this.marker.visible=false;this.marker.renderOrder=5;scene.add(this.marker);
    document.addEventListener('keydown',this.onKeyDown,true);window.addEventListener(TARGET_EVENT,this.onTargetRequest);canvas.addEventListener('pointermove',this.onPointerMove);canvas.addEventListener('click',this.onClick,true);canvas.addEventListener('contextmenu',this.onContextMenu);
  }
  dispose():void{document.removeEventListener('keydown',this.onKeyDown,true);window.removeEventListener(TARGET_EVENT,this.onTargetRequest);this.canvas.removeEventListener('pointermove',this.onPointerMove);this.canvas.removeEventListener('click',this.onClick,true);this.canvas.removeEventListener('contextmenu',this.onContextMenu);this.marker.removeFromParent();this.marker.geometry.dispose();(this.marker.material as MeshBasicMaterial).dispose()}
  update(playerX:number,playerY:number,playerZ:number):void{
    if(!this.action?.area)return;this.marker.visible=false;const rect=this.canvas.getBoundingClientRect();if(document.pointerLockElement===this.canvas)this.pointer.set(0,0);else this.pointer.set((this.pointerX/rect.width)*2-1,-(this.pointerY/rect.height)*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);this.scene.updateMatrixWorld(true);
    for(const hit of this.raycaster.intersectObjects(this.scene.children,true)){if(!hit.face||hit.face.normal.y<0.7)continue;const x=hit.point.x/this.cellSize,y=hit.point.z/this.cellSize,z=hit.point.y/this.cellSize;if(!this.terrain.isCellSolid(Math.floor(x+0.5),Math.floor(y+0.5),Math.floor(z)))continue;const target={x,y,z};if(!isAreaTargetWithinRange(target,{x:playerX,y:playerY,z:playerZ},this.action.area.range))continue;this.target=target;this.marker.position.set(hit.point.x,hit.point.y+0.025*this.cellSize,hit.point.z);this.marker.scale.setScalar(this.action.area.radius*this.cellSize);(this.marker.material as MeshBasicMaterial).color.set(this.action.area.effect==='thunder'?0xa78bfa:0x55ddff);this.marker.visible=true;return}this.target=null;
  }
  private readonly onPointerMove=(event:PointerEvent):void=>{const rect=this.canvas.getBoundingClientRect();this.pointerX=event.clientX-rect.left;this.pointerY=event.clientY-rect.top};
  private readonly onKeyDown=(event:KeyboardEvent):void=>{if(isTextInputFocused())return;if(this.action&&event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.cancel();return}if(event.repeat)return;const action=BODY_ACTIONS.find((candidate)=>candidate.area&&TARGET_KEYS[candidate.control.inputIntent]?.includes(event.code));if(!action)return;event.preventDefault();this.activate(action)};
  private readonly onTargetRequest=(event:Event):void=>{const id=(event as CustomEvent<{actionId?:string}>).detail?.actionId;const action=BODY_ACTIONS.find((candidate)=>candidate.id===id&&candidate.area);if(action)this.activate(action)};
  private readonly onClick=(event:MouseEvent):void=>{if(!this.action)return;event.preventDefault();event.stopImmediatePropagation();if(this.target)this.cast(this.action,this.target);this.cancel()};
  private readonly onContextMenu=(event:MouseEvent):void=>{if(this.action){event.preventDefault();this.cancel()}};
  private activate(action:ActionDefinition):void{this.action=action;this.target=null;const rect=this.canvas.getBoundingClientRect();this.pointerX=rect.width/2;this.pointerY=rect.height/2}
  private cancel():void{this.action=null;this.target=null;this.marker.visible=false}
}
const TARGET_KEYS:Record<string,string[]>={target_orbe:['KeyR'],target_trueno:['KeyT']};

interface EffectView{group:Group;ring:Mesh;core:Mesh;elapsed:number;duration:number}
export class AreaSpellVisuals{
 private readonly effects:EffectView[]=[];constructor(private readonly scene:Scene,private readonly cellSize:number){}
 apply(event:AreaSpellEvent):void{const group=new Group();const color=event.effect==='thunder'?0xa78bfa:0x55ddff;const ring=new Mesh(new RingGeometry(0.08,1,40),new MeshBasicMaterial({color,transparent:true,opacity:0.9,side:DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(event.x*this.cellSize,event.z*this.cellSize+0.04*this.cellSize,event.y*this.cellSize);ring.scale.setScalar(0.1*event.radius*this.cellSize);const core=event.effect==='thunder'?new Mesh(new CylinderGeometry(0.12*this.cellSize,0.28*this.cellSize,1,8),new MeshBasicMaterial({color:0xe9d5ff,transparent:true,opacity:0.95,depthWrite:false})):new Mesh(new SphereGeometry(1,12,8),new MeshBasicMaterial({color,transparent:true,opacity:0.95,depthWrite:false}));const groundY=event.z*this.cellSize;core.position.set(event.x*this.cellSize,groundY+(event.effect==='thunder'?6:1.4)*this.cellSize,event.y*this.cellSize);if(event.effect==='thunder')core.scale.y=12*this.cellSize;else core.scale.setScalar(0.45*this.cellSize);group.userData={effect:event.effect,radius:event.radius,groundY};group.add(ring,core);this.scene.add(group);this.effects.push({group,ring,core,elapsed:0,duration:event.effect==='thunder'?0.45:0.6})}
 update(deltaTime:number):void{for(let i=this.effects.length-1;i>=0;i--){const effect=this.effects[i]!;effect.elapsed+=deltaTime;const t=Math.min(1,effect.elapsed/effect.duration);const radius=Number(effect.group.userData.radius);effect.ring.scale.setScalar((0.1+0.9*t)*radius*this.cellSize);(effect.ring.material as MeshBasicMaterial).opacity=0.9*(1-t);const coreMaterial=effect.core.material as MeshBasicMaterial;coreMaterial.opacity=0.95*(1-t);if(effect.group.userData.effect==='orb'){effect.core.position.y=Number(effect.group.userData.groundY)+(1.4*(1-t))*this.cellSize;effect.core.scale.setScalar((0.25+0.55*t)*this.cellSize)}else{effect.core.position.y=Number(effect.group.userData.groundY)+6*(1-t)*this.cellSize;effect.core.scale.y=Math.max(0.01,12*(1-t))*this.cellSize}if(effect.elapsed>=effect.duration){this.scene.remove(effect.group);effect.group.traverse((object)=>{if(object instanceof Mesh){object.geometry.dispose();const mat=object.material;if(Array.isArray(mat))mat.forEach((m)=>m.dispose());else mat.dispose()}});this.effects.splice(i,1)}}}
}
