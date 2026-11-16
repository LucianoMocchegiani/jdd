import { BODY_ACTIONS } from '@/game-data/actions';
import { AreaAbilityTargeting, AreaSpellVisuals } from '@/game/area-abilities';
import type { AreaSpellEvent, CellPosition } from '@/types/world-events';
import type { Camera, Scene } from 'three';
import type { TerrainStore } from '@/game/terrain/terrain-store';
import type { SimpleParticleRenderer } from '@/game/terrain/simple-particle-renderer';

export { AreaAbilityTargeting, AreaSpellVisuals };
export type { AreaSpellEvent, CellPosition };
export function createAreaAbilityTargeting(scene:Scene,camera:Camera,canvas:HTMLCanvasElement,terrain:TerrainStore,cellSize:number,cast:(actionId:string,target:CellPosition)=>void):AreaAbilityTargeting{
 return new AreaAbilityTargeting(scene,camera,canvas,terrain,cellSize,(action,target)=>cast(action.id,target));
}
