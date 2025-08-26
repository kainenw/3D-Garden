import * as CANNON from 'cannon-es';

export class Physics {
  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
  }

  step(dt) {
    this.world.step(1 / 60, dt, 3);
  }
}
