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
    this.soil = new Map();
  }

  tileKey(pos) {
    return `${Math.floor(pos.x)}_${Math.floor(pos.z)}`;
  }

  toggleSoil(position) {
    const key = this.tileKey(position);
    if (this.soil.has(key)) {
      this.soil.delete(key);
    } else {
      this.soil.set(key, 1);
    }
    this.notifyChange();
  }

  plantAt(position, speciesId) {
    const spec = this.species[speciesId];
    if (!spec) return null;
    const mesh = this.createMesh(spec, 0);
    mesh.position.copy(position);
    this.scene.add(mesh);
    const soilKey = this.tileKey(position);
    const fertility = this.soil.get(soilKey) ?? 1;
    this.soil.set(soilKey, fertility);
    const plant = {
      speciesId,
      species: spec,
      mesh,
      position: mesh.position,
      stageIndex: 0,
      growthPoints: 0,
      hydration: spec.requirements.water,
      fertility,
      soilKey,
      stall: 0
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
    let changed = false;
    for (const p of this.plants) {
      changed = this.tickPlant(p, dt) || changed;
    }
    if (changed) {
      this.notifyChange();
    }
  }

  tickPlant(p, dt) {
    const spec = p.species;
    const sun = this.sceneManager ? this.sceneManager.sunlightAt(p.position) : 1;
    const sunMult = Math.min(1, sun / spec.requirements.sunlight);
    const waterMult = Math.min(1, p.hydration / spec.requirements.water);
    const prevFertility = p.fertility;
    p.fertility = this.soil.get(p.soilKey) ?? p.fertility;
    const fertMult = Math.min(1, p.fertility / spec.requirements.fertility);
    let mult = sunMult * waterMult * fertMult;

    if (sun < spec.tolerances.shade) {
      mult *= sun / spec.tolerances.shade;
    }
    const prevStall = p.stall;
    if (p.hydration > spec.tolerances.overwater || p.hydration < spec.tolerances.underwater) {
      p.stall = 2;
    }
    if (p.stall > 0) {
      p.stall = Math.max(0, p.stall - dt);
      mult = 0;
    }

    const prevGP = p.growthPoints;
    const prevHydration = p.hydration;
    p.growthPoints += spec.growthRate * mult * dt;
    p.hydration = Math.max(0, p.hydration - this.dryRate * dt);
    const prevStage = p.stageIndex;
    const nextStage = spec.stages[p.stageIndex + 1];
    if (nextStage && p.growthPoints >= nextStage.minGP) {
      this.advanceStage(p);
    }
    return (
      p.fertility !== prevFertility ||
      p.stall !== prevStall ||
      p.growthPoints !== prevGP ||
      p.hydration !== prevHydration ||
      p.stageIndex !== prevStage
    );
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
    p.hydration = Math.min(1, p.hydration + amount);
    if (p.hydration > p.species.tolerances.overwater) {
      p.stall = 2;
    }
    this.notifyChange();
  }

  harvestPlant(p) {
    this.scene.remove(p.mesh);
    this.plants = this.plants.filter(pl => pl !== p);
    this.notifyChange();
    const store = useStore.getState();
    store.addItem({ id: `seed_${p.speciesId}`, type: 'seed', count: 2 });
    store.addItem({ id: 'decor_token', type: 'decor', count: 1 });
  }

  removePlant(p) {
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
