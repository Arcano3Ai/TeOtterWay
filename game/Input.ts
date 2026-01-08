
export type Action = 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'JUMP' | 'BOOST' | 'DIVE';

export class InputHandler {
  public keys: { [key: string]: boolean } = {};
  public mapping: Record<Action, string> = {
    FORWARD: 'w',
    BACKWARD: 's',
    LEFT: 'a',
    RIGHT: 'd',
    JUMP: ' ',
    BOOST: 'shift',
    DIVE: 'control'
  };

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  public setMapping(newMapping: Record<Action, string>) {
    this.mapping = { ...newMapping };
  }

  public isPressed(action: Action): boolean {
    const key = this.mapping[action];
    if (key === ' ') return !!this.keys[' '] || !!this.keys['space'];
    return !!this.keys[key.toLowerCase()];
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.keys[key] = true;
    if (key === ' ') this.keys['space'] = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    this.keys[key] = false;
    if (key === ' ') this.keys['space'] = false;
  };

  public dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
