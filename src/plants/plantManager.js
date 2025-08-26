import * as THREE from 'three';
import species from './species.json' assert { type: 'json' };

export class PlantManager {
  constructor(scene, soil) {
    this.scene = scene;
    this.soil = soil;
    this.species = species;
    this.plants = [];
    this.dryRate = 0.02;
    this.preview = null;
    this.previewTile = null;
  }

  plantAt(position, speciesId) {
    const spec = this.species[speciesId];
    if (!spec) return null;

    const tile = this.soil.getTileAt(position);
    if (!tile) return null;

    const valid = tile.plantable && !tile.occupied;

    // Setup preview mesh if needed
    if (!this.preview) {
      this.preview = this.createMesh(spec, 0);
      this.preview.material = this.preview.material.clone();
      this.preview.material.transparent = true;
      this.preview.material.opacity = 0.5;
      this.scene.add(this.preview);
    }

    this.preview.material.color.set(valid ? 0x00ff00 : 0xff0000);
    this.preview.position.copy(tile.position);

    if (this.previewTile === tile && valid) {
      // Confirm placement
      this.scene.remove(this.preview);
      this.preview = null;
      this.previewTile = null;
      tile.occupied = true;
      const mesh = this.createMesh(spec, 0);
      mesh.position.copy(tile.position);
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
      return plant;
    } else {
      this.previewTile = tile;
      return null;
    }
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
  }

  waterPlant(p, amount = 0.2) {
    p.hydration = Math.min(p.species.requirements.water, p.hydration + amount);
  }

  harvestPlant(p) {
    this.scene.remove(p.mesh);
    this.plants = this.plants.filter(pl => pl !== p);
  }

  getMeshes() {
    return this.plants.map(p => p.mesh);
  }

  getPlantByMesh(mesh) {
    return this.plants.find(p => p.mesh === mesh);
  }
}
