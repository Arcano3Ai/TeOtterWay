
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Otter } from './Otter';
import { World } from './World';
import { Action, InputHandler } from './Input';
import { FishSystem } from './FishSystem';
import { Collectibles } from './Collectibles';

export const LAYERS = {
  DEFAULT: 1,
  PLAYER: 2,
  WATER: 4,
  FISH: 8,
  ENVIRONMENT: 16
};

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private physicsWorld: CANNON.World;
  public otter: Otter;
  private world: World;
  private fishSystem: FishSystem;
  private collectibles: Collectibles;
  public input: InputHandler;
  private clock: THREE.Clock;
  private onUpdate: (data: any) => void;
  private frameId: number | null = null;

  private camPos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private speedParticles: THREE.Points;
  private shakeAmount: number = 0;

  constructor(container: HTMLDivElement, onUpdate: (data: any) => void) {
    this.onUpdate = onUpdate;
    this.clock = new THREE.Clock();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020617); 
    this.scene.fog = new THREE.Fog(0x020617, 60, 250); 

    this.physicsWorld = new CANNON.World();
    this.physicsWorld.gravity.set(0, -32, 0);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupParticles();

    this.input = new InputHandler();
    this.world = new World(this.scene, this.physicsWorld);
    this.otter = new Otter(this.scene, this.physicsWorld);
    this.fishSystem = new FishSystem(this.scene, 80);
    this.collectibles = new Collectibles(this.scene, 30);

    window.addEventListener('resize', this.onWindowResize);
    this.animate();
  }

  public otterUpdateControls(mapping: Record<Action, string>) {
    this.input.setMapping(mapping);
  }

  private setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xbae6fd, 1.2);
    sun.position.set(100, 250, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);
  }

  private setupParticles() {
    const geo = new THREE.BufferGeometry();
    const count = 1500;
    const pos = new Float32Array(count * 3);
    for(let i=0; i<count*3; i++) pos[i] = (Math.random()-0.5) * 80;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.2 });
    this.speedParticles = new THREE.Points(geo, mat);
    this.scene.add(this.speedParticles);
  }

  private onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private animate = () => {
    this.frameId = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    this.physicsWorld.step(1 / 60, delta, 3);
    this.otter.update(delta, this.input);
    this.world.update(time, this.otter.getPosition());
    
    const eatenCount = this.fishSystem.update(delta, this.otter.getPosition());
    if (eatenCount > 0) {
      this.otter.score += eatenCount * 500;
      this.otter.activateSurge();
      this.shakeAmount = 0.5;
    }

    const bonus = this.collectibles.update(delta, this.otter.getPosition(), time);
    this.otter.score += bonus.score;
    this.otter.stamina = Math.min(100, this.otter.stamina + bonus.stamina);
    if (bonus.score > 0) this.shakeAmount = 0.3;

    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);

    this.onUpdate({
      state: this.otter.getStateName(),
      stamina: this.otter.stamina,
      score: this.otter.score,
      speed: this.otter.currentSpeed,
      playerPos: this.otter.getPosition(),
      fishes: this.fishSystem.getActiveFishes(),
      isBoosting: this.otter.isBoosting
    });
  };

  private updateCamera(delta: number) {
    const pos = this.otter.getPosition();
    const quat = this.otter.getQuaternion();
    const speed = this.otter.currentSpeed;
    const speedFactor = Math.min(speed / 35, 1);
    
    const distance = 16 + (speedFactor * 10);
    const height = 8 + (speedFactor * 4);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const targetPos = pos.clone().add(forward.clone().multiplyScalar(-distance)).add(new THREE.Vector3(0, height, 0));

    this.camPos.lerp(targetPos, 0.08); 
    
    if (this.shakeAmount > 0) {
      this.camPos.x += (Math.random() - 0.5) * this.shakeAmount;
      this.camPos.y += (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount *= 0.9;
    }

    this.camera.position.copy(this.camPos);
    
    const lookTarget = pos.clone().add(forward.clone().multiplyScalar(5));
    this.camTarget.lerp(lookTarget, 0.12);
    this.camera.lookAt(this.camTarget);
    
    const targetFOV = 70 + (speedFactor * 35);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.1);
    this.camera.updateProjectionMatrix();

    this.speedParticles.position.copy(pos);
    this.speedParticles.visible = speed > 20;
    this.speedParticles.rotation.y += delta * speed * 0.1;
  }

  public dispose() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.renderer.dispose();
    this.input.dispose();
  }
}
