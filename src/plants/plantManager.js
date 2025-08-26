import * as THREE from 'three';
import species from './species.json' assert { type: 'json' };

export class PlantManager {
  constructor(scene, ground) {
    this.scene = scene;
    this.ground = ground;
    this.species = species;
    this.plants = [];
    this.dryRate = 0.02;
    this.listeners = new Set();
  }

  plantAt(position, speciesId) {
    const spec = this.species[speciesId];
    if (!spec) return null;
    const mesh = this.createMesh(spec, 0);
    mesh.position.copy(position);
    this.scene.add(mesh);
    const plant = {
      speciesId,
      species: spec,
      mesh,
      position: mesh.position,
      stageIndex: 0,
      growthPoints: 0,
      hydration: spec.requirements.water
    };
    this.plants.push(plant);
    this.notifyChange();
    return plant;
  }

  createMesh(spec, stageIndex) {
    const size = 0.2 + stageIndex * 0.3;
    const geom = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({ color: spec.color });
    return new THREE.Mesh(geom, mat);
  }

  update(dt) {
    for (const p of this.plants) {
      this.tickPlant(p, dt);
    }
    if (this.plants.length > 0) {
      this.notifyChange();
    }
  }

  tickPlant(p, dt) {
    const spec = p.species;
    const sun = 1; // placeholder full sunlight
    const water = Math.min(1, p.hydration / spec.requirements.water);
    const fert = 1; // fertility not modelled yet
    const mult = Math.min(1, sun / spec.requirements.sunlight) * water * fert;
    p.growthPoints += spec.growthRate * mult * dt;
    p.hydration = Math.max(0, p.hydration - this.dryRate * dt);

    const nextStage = spec.stages[p.stageIndex + 1];
    if (nextStage && p.growthPoints >= nextStage.minGP) {
      this.advanceStage(p);
    }
  }

  advanceStage(p) {
    p.stageIndex++;
    this.scene.remove(p.mesh);
    p.mesh = this.createMesh(p.species, p.stageIndex);
    p.mesh.position.copy(p.position);
    this.scene.add(p.mesh);
    this.notifyChange();
  }

  waterPlant(p, amount = 0.2) {
    p.hydration = Math.min(p.species.requirements.water, p.hydration + amount);
    this.notifyChange();
  }

  harvestPlant(p) {
    this.scene.remove(p.mesh);
    this.plants = this.plants.filter(pl => pl !== p);
    this.notifyChange();
  }

  getMeshes() {
    return this.plants.map(p => p.mesh);
  }

  getPlantByMesh(mesh) {
    return this.plants.find(p => p.mesh === mesh);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notifyChange() {
    for (const fn of this.listeners) {
      fn(this.plants);
    }
  }
}
