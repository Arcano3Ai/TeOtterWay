
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { LAYERS } from './GameEngine';

export class World {
  private scene: THREE.Scene;
  private physicsWorld: CANNON.World;
  private voxelSize: number = 2;
  private gridSize: number = 80; // La isla principal
  private worldLimit: number = 180; // Radio máximo de juego
  
  private water: THREE.Mesh;
  private instancedVoxels: THREE.InstancedMesh;
  private boundaryVoxels: THREE.InstancedMesh;

  constructor(scene: THREE.Scene, physicsWorld: CANNON.World) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.createVoxelWorld();
    this.createWorldBoundaries();
  }

  private createVoxelWorld() {
    // 1. Agua (Semi-transparente)
    const waterGeo = new THREE.PlaneGeometry(2000, 2000);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1
    });
    this.water = new THREE.Mesh(waterGeo, waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.5;
    this.scene.add(this.water);

    // 2. Generación de Datos de la Isla
    const voxelsToCreate: { pos: THREE.Vector3, color: THREE.Color }[] = [];
    const halfGrid = this.gridSize / 2;

    for (let x = -halfGrid; x < halfGrid; x++) {
      for (let z = -halfGrid; z < halfGrid; z++) {
        const worldX = x * this.voxelSize;
        const worldZ = z * this.voxelSize;
        const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
        
        let height = 0;
        const islandRadius = 60;
        const lakeRadius = 15;
        const isRiver = worldX > 0 && Math.abs(worldZ) < 8;

        if (dist < islandRadius) {
          height = Math.floor((1 - dist / islandRadius) * 6) + 1;
          if (dist < lakeRadius || (isRiver && worldX > lakeRadius)) height = -2;
        } else {
          height = -4; 
        }

        for (let y = -5; y <= height; y++) {
          const pos = new THREE.Vector3(worldX, y * this.voxelSize, worldZ);
          let color = new THREE.Color();
          if (y === height) {
            if (y < 0) color.set(0x78350f);
            else if (y === 0) color.set(0xfde047);
            else if (y < 3) color.set(0x22c55e);
            else color.set(0x15803d);
          } else {
            color.set(0x451a03);
          }
          voxelsToCreate.push({ pos, color });
        }

        if (height >= 1 && Math.random() > 0.98 && !isRiver) {
          this.addVoxelTree(worldX, (height + 1) * this.voxelSize, worldZ);
        }
      }
    }

    const geometry = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    this.instancedVoxels = new THREE.InstancedMesh(geometry, material, voxelsToCreate.length);
    this.instancedVoxels.castShadow = true;
    this.instancedVoxels.receiveShadow = true;

    const dummy = new THREE.Object3D();
    voxelsToCreate.forEach((v, i) => {
      dummy.position.copy(v.pos);
      dummy.updateMatrix();
      this.instancedVoxels.setMatrixAt(i, dummy.matrix);
      this.instancedVoxels.setColorAt(i, v.color);
    });
    this.scene.add(this.instancedVoxels);

    this.addPhysicsBox(0, -5, 0, 140, 10, 140); 
    this.addPhysicsBox(-40, 2, 0, 20, 4, 80); 
    this.addPhysicsBox(0, 2, 40, 100, 4, 20); 
    this.addPhysicsBox(0, 2, -40, 100, 4, 20); 
  }

  private createWorldBoundaries() {
    // 1. Muros de colisión (Norte, Sur, Este, Oeste, Techo, Suelo)
    const thickness = 10;
    const limit = this.worldLimit;
    
    // Suelo profundo
    this.addPhysicsBox(0, -25, 0, limit * 2.5, thickness, limit * 2.5);
    // Techo
    this.addPhysicsBox(0, 60, 0, limit * 2.5, thickness, limit * 2.5);
    // Muros laterales
    this.addPhysicsBox(limit, 15, 0, thickness, 100, limit * 2); // Este
    this.addPhysicsBox(-limit, 15, 0, thickness, 100, limit * 2); // Oeste
    this.addPhysicsBox(0, 15, limit, limit * 2, 100, thickness); // Norte
    this.addPhysicsBox(0, 15, -limit, limit * 2, 100, thickness); // Sur

    // 2. Barrera Visual Voxel (Un anillo de cubos brillantes)
    const boundaryVoxelsPos: THREE.Vector3[] = [];
    const segments = 120;
    for(let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      for(let y = -4; y < 8; y++) {
        boundaryVoxelsPos.push(new THREE.Vector3(
          Math.cos(angle) * (limit - 2),
          y * 3,
          Math.sin(angle) * (limit - 2)
        ));
      }
    }

    const bGeo = new THREE.BoxGeometry(2.5, 2.5, 2.5);
    const bMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.3,
      emissive: 0x06b6d4,
      emissiveIntensity: 2
    });
    
    this.boundaryVoxels = new THREE.InstancedMesh(bGeo, bMat, boundaryVoxelsPos.length);
    const dummy = new THREE.Object3D();
    boundaryVoxelsPos.forEach((pos, i) => {
      dummy.position.copy(pos);
      dummy.scale.setScalar(0.8 + Math.random() * 0.4);
      dummy.updateMatrix();
      this.boundaryVoxels.setMatrixAt(i, dummy.matrix);
    });
    this.scene.add(this.boundaryVoxels);
  }

  private addPhysicsBox(x: number, y: number, z: number, w: number, h: number, d: number) {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)),
      position: new CANNON.Vec3(x, y, z),
      collisionFilterGroup: LAYERS.ENVIRONMENT
    });
    this.physicsWorld.addBody(body);
  }

  private addVoxelTree(x: number, y: number, z: number) {
    const treeGroup = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4, 0.8), trunkMat);
    trunk.position.y = 1;
    treeGroup.add(trunk);

    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x064e3b });
    const leaves = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), leavesMat);
    leaves.position.y = 4;
    treeGroup.add(leaves);

    treeGroup.position.set(x, y, z);
    this.scene.add(treeGroup);
  }

  public update(time: number, playerPos: THREE.Vector3) {
    this.water.position.y = 0.5 + Math.sin(time * 0.8) * 0.05;
    this.water.position.x = playerPos.x;
    this.water.position.z = playerPos.z;

    // Efecto de parpadeo en la barrera
    if (this.boundaryVoxels) {
      (this.boundaryVoxels.material as THREE.MeshStandardMaterial).opacity = 0.2 + Math.sin(time * 2) * 0.15;
    }
  }
}
