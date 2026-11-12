/** Touch movement controls feed the same held-key state as keyboard input. */
import { INTENT_KEY_CODES } from '@/ecs/domains/input/input-system';
import { setVirtualKeyHeld } from '@/game/input/keyboard-state';

const STICK_INTENTS = ['move_forward', 'move_backward', 'move_left', 'move_right'] as const;

function setIntent(intent: string, active: boolean): void {
  const code = INTENT_KEY_CODES[intent]?.[0];
  if (code) setVirtualKeyHeld(code, active);
}

export function mountMobileControls(root: HTMLElement): void {
  const stick = document.createElement('div');
  stick.className = 'mobile-controls__stick';
  stick.setAttribute('role', 'group');
  stick.setAttribute('aria-label', 'Joystick virtual: arrastrar para moverse');
  const knob = document.createElement('span');
  knob.className = 'mobile-controls__knob';
  knob.setAttribute('aria-hidden', 'true');
  stick.append(knob);

  let pointerId: number | null = null;
  const releaseStick = (): void => {
    pointerId = null;
    for (const intent of STICK_INTENTS) setIntent(intent, false);
    knob.style.left = '50%';
    knob.style.top = '50%';
  };
  const updateStick = (event: PointerEvent): void => {
    const rect = stick.getBoundingClientRect();
    const radius = rect.width * 0.34;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const scale = distance > radius ? radius / distance : 1;
    const x = dx * scale;
    const y = dy * scale;
    knob.style.left = `calc(50% + ${x}px)`;
    knob.style.top = `calc(50% + ${y}px)`;
    setIntent('move_left', x < -radius * 0.22);
    setIntent('move_right', x > radius * 0.22);
    setIntent('move_forward', y < -radius * 0.22);
    setIntent('move_backward', y > radius * 0.22);
  };
  stick.addEventListener('pointerdown', (event) => {
    if (pointerId !== null) return;
    event.preventDefault();
    pointerId = event.pointerId;
    stick.setPointerCapture(pointerId);
    updateStick(event);
  });
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === pointerId) updateStick(event);
  });
  stick.addEventListener('pointerup', (event) => {
    if (event.pointerId === pointerId) releaseStick();
  });
  stick.addEventListener('pointercancel', releaseStick);
  stick.addEventListener('lostpointercapture', releaseStick);

  const actions = document.createElement('div');
  actions.className = 'mobile-controls__actions';
  for (const [intent, label] of [['run_forward', 'Correr'], ['jump', 'Saltar']] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mobile-controls__button';
    button.textContent = label;
    button.setAttribute('aria-label', label);
    const code = INTENT_KEY_CODES[intent]?.[0];
    const down = (event: PointerEvent): void => {
      event.preventDefault();
      if (code) setVirtualKeyHeld(code, true);
      button.setPointerCapture(event.pointerId);
    };
    const up = (event: PointerEvent): void => {
      if (code) setVirtualKeyHeld(code, false);
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    actions.append(button);
  }
  root.replaceChildren(stick, actions);
}
