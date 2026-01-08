
import * as THREE from 'three';

export class FishSystem {
  private fishes: THREE.Group[] = [];
  private velocities: THREE.Vector3[] = [];
  private active: boolean[] = [];

  constructor(scene: THREE.Scene, count: number) {
    const geo = new THREE.ConeGeometry(0.12, 0.45, 4);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.2 });

    for (let i = 0; i < count; i++) {
      const fish = new THREE.Group();
      fish.add(new THREE.Mesh(geo, mat));
      this.resetFish(fish, i);
      scene.add(fish);
      this.fishes.push(fish);
      this.active.push(true);
      this.velocities.push(new THREE.Vector3());
    }
  }

  private resetFish(fish: THREE.Group, i: number) {
    // Spawneamos peces en un área amplia, bajo el agua
    fish.position.set(
      (Math.random() - 0.5) * 300,
      -2 - Math.random() * 8,
      (Math.random() - 0.5) * 300
    );
    fish.visible = true;
    if (this.active) this.active[i] = true;
  }

  public update(delta: number, playerPos: THREE.Vector3): number {
    let eaten = 0;
    this.fishes.forEach((fish, i) => {
      if (!this.active[i]) return;

      const d = fish.position.distanceTo(playerPos);
      
      // Comer pez
      if (d < 1.4) {
        this.active[i] = false;
        fish.visible = false;
        eaten++;
        setTimeout(() => this.resetFish(fish, i), 10000);
        return;
      }

      const vel = this.velocities[i];
      if (d < 15) {
        // Huir del jugador
        const fleeDir = new THREE.Vector3().subVectors(fish.position, playerPos).normalize();
        vel.lerp(fleeDir.multiplyScalar(6), 0.1);
      } else {
        // Movimiento errático natural
        vel.x += (Math.random() - 0.5) * 0.2;
        vel.z += (Math.random() - 0.5) * 0.2;
        vel.clampLength(1, 2.5);
      }

      fish.position.add(vel.clone().multiplyScalar(delta));
      fish.lookAt(fish.position.clone().add(vel));
    });
    return eaten;
  }

  public getActiveFishes() {
    return this.fishes.filter((_, i) => this.active[i]).map(f => f.position.clone());
  }
}
