import * as CANNON from 'cannon-es';
import { World, Vec3, Body, Plane } from 'cannon-es';

// Simple physics wrapper around cannon-es. Uses a fixed 5 Hz tick and
// exposes the world so other modules can create and manage bodies.
export class Physics {
  constructor() {
    this.world = new World({ gravity: new Vec3(0, -9.82, 0) });

    // Basic ground plane so dynamic bodies have something to rest on.
    const ground = new Body({ mass: 0, shape: new Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);

    this.fixedTimeStep = 1 / 5; // 5 Hz
    this.accumulator = 0;
  }

  addBody(body) {
    this.world.addBody(body);
    return body;
  }

  step(dt) {
    // Accumulate time and step the physics world at a fixed rate.
    this.accumulator += dt;
    while (this.accumulator >= this.fixedTimeStep) {
      this.world.step(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
    }
  }
}
