
import * as THREE from 'three';

export enum ItemType {
  PEARL,
  SHELL
}

export class Collectibles {
  private items: { mesh: THREE.Group, type: ItemType, active: boolean }[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, count: number) {
    this.scene = scene;
    
    // GEOMETRÍA VOXEL PARA ITEMS
    const pearlGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const pearlMat = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      emissive: 0xbae6fd, 
      emissiveIntensity: 0.6,
    });

    const shellGeo = new THREE.BoxGeometry(0.6, 0.3, 0.6);
    const shellMat = new THREE.MeshStandardMaterial({ 
      color: 0xfacc15, 
      emissive: 0xca8a04,
      emissiveIntensity: 0.8
    });

    for (let i = 0; i < count; i++) {
      const type = Math.random() > 0.8 ? ItemType.SHELL : ItemType.PEARL;
      const mesh = new THREE.Group();
      const visual = new THREE.Mesh(type === ItemType.PEARL ? pearlGeo : shellGeo, type === ItemType.PEARL ? pearlMat : shellMat);
      mesh.add(visual);

      const light = new THREE.PointLight(type === ItemType.PEARL ? 0xbae6fd : 0xfacc15, 3, 6);
      mesh.add(light);

      this.spawnItem(mesh);
      this.items.push({ mesh, type, active: true });
      this.scene.add(mesh);
    }
  }

  private spawnItem(mesh: THREE.Group) {
    // Spawneamos items en el área de la isla voxel
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 45; // Dentro de la isla
    
    mesh.position.set(
      Math.cos(angle) * radius,
      -1 - Math.random() * 6,
      Math.sin(angle) * radius
    );
    mesh.visible = true;
  }

  public update(delta: number, playerPos: THREE.Vector3, time: number): { score: number, stamina: number } {
    let bonus = { score: 0, stamina: 0 };

    this.items.forEach(item => {
      if (!item.active) return;

      item.mesh.position.y += Math.sin(time * 3 + item.mesh.position.x) * 0.008;
      item.mesh.rotation.y += delta * 3;
      item.mesh.rotation.x += delta * 1.5;

      const d = item.mesh.position.distanceTo(playerPos);
      if (d < 2.0) {
        item.active = false;
        item.mesh.visible = false;
        
        if (item.type === ItemType.PEARL) {
          bonus.score += 600;
        } else {
          bonus.score += 300;
          bonus.stamina += 60;
        }

        setTimeout(() => {
          item.active = true;
          this.spawnItem(item.mesh);
        }, 15000);
      }
    });

    return bonus;
  }
}
