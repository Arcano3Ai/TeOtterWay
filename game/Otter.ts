
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputHandler } from './Input';
import { LAYERS } from './GameEngine';

export enum OtterState {
  LAND,
  WATER_SURFACE,
  UNDERWATER
}

export class Otter {
  private mesh: THREE.Group;
  public body: CANNON.Body;
  private state: OtterState = OtterState.LAND;
  private waterLevel: number = 0.5;
  
  public stamina: number = 100;
  public score: number = 0;
  public currentSpeed: number = 0;
  
  // Superpowers State
  public isBoosting: boolean = false;
  private surgeTimer: number = 0;
  private lastJumpTime: number = 0;
  private currentRotationY: number = 0;
  private targetRotationY: number = 0;
  
  // Visuals
  private swimCycle: number = 0;
  private tiltAmount: number = 0;
  private pitchAmount: number = 0;

  constructor(scene: THREE.Scene, world: CANNON.World) {
    this.mesh = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
    
    // Voxel Model
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.6, 1.4);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.castShadow = true;
    this.mesh.add(bodyMesh);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), mat);
    head.position.set(0, 0.1, 0.8);
    this.mesh.add(head);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.8), mat);
    tail.position.set(0, -0.1, -0.9);
    tail.name = "tail";
    this.mesh.add(tail);

    scene.add(this.mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(0.4, 0.3, 1.0));
    this.body = new CANNON.Body({
      mass: 25, 
      shape: shape,
      position: new CANNON.Vec3(0, 10, 0),
      collisionFilterGroup: LAYERS.PLAYER,
      collisionFilterMask: LAYERS.DEFAULT | LAYERS.ENVIRONMENT | LAYERS.WATER | LAYERS.FISH
    });
    
    this.body.linearDamping = 0.4;
    this.body.angularDamping = 1.0;
    world.addBody(this.body);
  }

  public update(delta: number, input: InputHandler) {
    const pos = this.body.position;
    const vel = this.body.velocity;
    this.currentSpeed = vel.length();

    // 1. Estado y Buoyancy
    if (pos.y < this.waterLevel - 1.5) this.state = OtterState.UNDERWATER;
    else if (pos.y < this.waterLevel + 0.5) this.state = OtterState.WATER_SURFACE;
    else this.state = OtterState.LAND;

    // 2. Super Surge Logic
    if (this.surgeTimer > 0) {
      this.surgeTimer -= delta;
      this.stamina = Math.min(100, this.stamina + delta * 200);
    }

    // 3. Inputs
    const moveFwd = input.isPressed('FORWARD');
    const moveBwd = input.isPressed('BACKWARD');
    const turnL = input.isPressed('LEFT');
    const turnR = input.isPressed('RIGHT');
    const jump = input.isPressed('JUMP');
    const dive = input.isPressed('DIVE');
    
    this.isBoosting = input.isPressed('BOOST') && this.stamina > 0;

    // 4. Rotación Cinemática (Inercia de giro)
    const turnSpeed = (this.isBoosting ? 6.0 : 4.0) * delta;
    if (turnL) this.targetRotationY += turnSpeed;
    if (turnR) this.targetRotationY -= turnSpeed;
    
    this.currentRotationY = THREE.MathUtils.lerp(this.currentRotationY, this.targetRotationY, 0.15);
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.currentRotationY);

    // 5. Fuerzas de Movimiento
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);

    let forceScale = this.isBoosting ? 4500 : 2500;
    if (this.surgeTimer > 0) forceScale *= 1.3;

    if (moveFwd) {
      const f = new CANNON.Vec3(forward.x, forward.y, forward.z).scale(forceScale * delta * 60);
      this.body.applyForce(f, this.body.position);
    }
    if (moveBwd) {
      const f = new CANNON.Vec3(forward.x, forward.y, forward.z).scale(-forceScale * 0.4 * delta * 60);
      this.body.applyForce(f, this.body.position);
    }

    // 6. Super Salto: Dolphin Breach
    if (jump && Date.now() - this.lastJumpTime > 500) {
      if (this.state === OtterState.WATER_SURFACE || this.state === OtterState.UNDERWATER) {
        this.body.velocity.y = 18;
        const jumpFwd = new CANNON.Vec3(forward.x, 0, forward.z).scale(20);
        this.body.velocity.addScaledVector(1, jumpFwd, this.body.velocity);
        this.lastJumpTime = Date.now();
      } else if (this.state === OtterState.LAND && Math.abs(vel.y) < 1) {
        this.body.velocity.y = 16;
        this.lastJumpTime = Date.now();
      }
    }

    // 7. Hidrodinámica
    if (this.state !== OtterState.LAND) {
      this.body.linearDamping = 0.5;
      const depth = Math.max(0, this.waterLevel - pos.y);
      const buoyancy = 30 * 9.81 * (depth + 0.8);
      this.body.applyForce(new CANNON.Vec3(0, buoyancy, 0), this.body.position);

      if (dive) this.body.applyForce(new CANNON.Vec3(0, -600, 0), this.body.position);
      
      this.swimCycle += delta * (this.isBoosting ? 15 : 8);
    } else {
      this.body.linearDamping = 0.95;
    }

    // 8. Consumo de Energía
    if (this.isBoosting && (moveFwd || moveBwd)) {
      this.stamina = Math.max(0, this.stamina - delta * 40);
    } else {
      this.stamina = Math.min(100, this.stamina + delta * 20);
    }

    // 9. Actualización Visual
    this.mesh.position.copy(this.body.position as any);
    this.mesh.quaternion.copy(this.body.quaternion as any);

    const targetTilt = (turnL ? 0.4 : 0) + (turnR ? -0.4 : 0);
    this.tiltAmount = THREE.MathUtils.lerp(this.tiltAmount, targetTilt, 0.1);
    this.mesh.rotation.z += this.tiltAmount;

    const targetPitch = -vel.y * 0.04;
    this.pitchAmount = THREE.MathUtils.lerp(this.pitchAmount, targetPitch, 0.1);
    this.mesh.rotation.x += this.pitchAmount;

    const tail = this.mesh.getObjectByName("tail");
    if (tail) {
      tail.rotation.y = Math.sin(this.swimCycle) * 0.4;
    }
  }

  public activateSurge() {
    this.surgeTimer = 3.0;
  }

  public getPosition() { return new THREE.Vector3().copy(this.body.position as any); }
  public getQuaternion() { return new THREE.Quaternion().copy(this.body.quaternion as any); }
  public getStateName() { return OtterState[this.state]; }
}
