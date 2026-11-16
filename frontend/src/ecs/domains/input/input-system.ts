import { InputComponent } from '@/ecs/components/input';
import { System } from '@/ecs/core';
import { logInputIntents } from '@/game/debug/input-flow-debug';
import { logMovementWarn } from '@/game/debug/movement-debug';
import { isCameraInspectMode } from '@/game/camera/camera-access';
import { getHeldKeyCodes, isKeyHeld } from '@/game/input/keyboard-state';
const BLOCKED_IN_INSPECT = new Set(['move_forward','move_backward','move_left','move_right','run_forward','jump','attack_light','attack_projectile','continuous_attack','target_orbe','target_trueno']);
export const INTENT_KEY_CODES: Record<string, readonly string[]> = {
  move_forward:['KeyW','ArrowUp'],move_backward:['KeyS','ArrowDown'],move_left:['KeyA','ArrowLeft'],move_right:['KeyD','ArrowRight'],run_forward:['ShiftLeft','ShiftRight'],jump:['Space'],continuous_attack:['KeyQ'],attack_light:['KeyF','Mouse0'],attack_projectile:['KeyG'],target_orbe:['KeyR'],target_trueno:['KeyT'],
};
export class InputSystem extends System {
  readonly priority=0;readonly requiredComponents=['input'] as const;
  override update(_deltaTime:number):void {const entities=this.getEntities();if(entities.size===0){logMovementWarn('InputSystem: ninguna entidad con input');return}const held=getHeldKeyCodes();for(const entityId of entities){const input=this.world?.getComponent<InputComponent>(entityId,'input');if(!input)continue;input.clear();const inspect=isCameraInspectMode();for(const [intent,codes] of Object.entries(INTENT_KEY_CODES)){if(inspect&&BLOCKED_IN_INSPECT.has(intent))continue;input.setIntent(intent,codes.some((code)=>isKeyHeld(code)))}logInputIntents(entityId,input.intents,held)}}
}
