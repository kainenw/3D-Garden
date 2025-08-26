import * as THREE from 'three';

export class PlayerController {
  constructor(camera, domElement, physics, plantManager) {
    this.camera = camera;
    this.domElement = domElement;
    this.physics = physics;
    this.plantManager = plantManager;

    this.raycaster = new THREE.Raycaster();

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') this.interact();
    });
  }

  update(dt) {
    // TODO: implement player movement
  }

  interact() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const plantHits = this.raycaster.intersectObjects(this.plantManager.getMeshes());
    if (plantHits.length > 0) {
      const plant = this.plantManager.getPlantByMesh(plantHits[0].object);
      if (plant.stageIndex >= plant.species.stages.length - 1) {
        this.plantManager.harvestPlant(plant);
      } else {
        this.plantManager.waterPlant(plant);
      }
      return;
    }

    const groundHits = this.raycaster.intersectObject(this.plantManager.ground);
    if (groundHits.length > 0) {
      const position = groundHits[0].point;
      this.plantManager.plantAt(position, 'daisy');
    }
  }
}
