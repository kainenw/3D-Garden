import * as THREE from 'three';
import species from './species.json' assert { type: 'json' };
import { useStore } from '../state/store.js';

export class PlantManager {
  constructor(scene, ground, sceneManager) {
    this.scene = scene;
    this.ground = ground;
    this.sceneManager = sceneManager;
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
      hydration: spec.requirements.water,
      cooldown: 0
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
    if (p.cooldown > 0) {
      p.cooldown = Math.max(0, p.cooldown - dt);
      return;
    }
    const spec = p.species;
    const sun = this.sceneManager ? this.sceneManager.sunlightAt(p.position) : 1;
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
    const store = useStore.getState();
    const yieldData = p.species.yield || {};
    if (yieldData.seeds) {
      store.addItem({ id: `seed_${p.speciesId}`, type: 'seed', count: yieldData.seeds });
    }
    if (yieldData.decor) {
      store.addItem({ id: 'decor_token', type: 'decor', count: yieldData.decor });
    }

    const post = p.species.postHarvest;
    if (post) {
      const stageIndex = typeof post.stageIndex === 'number'
        ? post.stageIndex
        : p.species.stages.findIndex(s => s.name === post.stage);
      if (stageIndex >= 0) {
        p.stageIndex = stageIndex;
        p.growthPoints = p.species.stages[stageIndex].minGP;
        this.scene.remove(p.mesh);
        p.mesh = this.createMesh(p.species, p.stageIndex);
        p.mesh.position.copy(p.position);
        this.scene.add(p.mesh);
      }
      p.cooldown = post.cooldown || 0;
    } else {
      this.scene.remove(p.mesh);
      this.plants = this.plants.filter(pl => pl !== p);
    }
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
