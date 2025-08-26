import * as THREE from 'three';

export class SoilTiles {
  constructor(scene, size = 1) {
    this.scene = scene;
    this.size = size;
    this.tiles = new Map();
  }

  _key(ix, iz) {
    return `${ix},${iz}`;
  }

  _posToIndices(pos) {
    return [Math.floor(pos.x / this.size), Math.floor(pos.z / this.size)];
  }

  _indicesToCenter(ix, iz) {
    return new THREE.Vector3((ix + 0.5) * this.size, 0, (iz + 0.5) * this.size);
  }

  toggleAt(pos) {
    const [ix, iz] = this._posToIndices(pos);
    const key = this._key(ix, iz);
    let tile = this.tiles.get(key);
    if (!tile) {
      const geom = new THREE.PlaneGeometry(this.size, this.size);
      const mat = new THREE.MeshStandardMaterial({ color: 0x553322, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = -Math.PI / 2;
      const center = this._indicesToCenter(ix, iz);
      mesh.position.set(center.x, 0.01, center.z);
      mesh.visible = false;
      this.scene.add(mesh);
      tile = { mesh, plantable: false };
      this.tiles.set(key, tile);
    }
    tile.plantable = !tile.plantable;
    tile.mesh.visible = tile.plantable;
    return tile.plantable;
  }

  isPlantable(pos) {
    const [ix, iz] = this._posToIndices(pos);
    const tile = this.tiles.get(this._key(ix, iz));
    return tile ? tile.plantable : false;
  }

  getTileCenter(pos) {
    const [ix, iz] = this._posToIndices(pos);
    return this._indicesToCenter(ix, iz);
  }
}
