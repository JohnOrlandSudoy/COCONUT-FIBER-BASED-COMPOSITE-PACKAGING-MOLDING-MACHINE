import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const CYCLE_DURATION = 15;
const MODEL_URL = '/models/molding-machine.fbx';

const PART_INFO: Record<string, string> = {
  Comp_PunchAssembly: 'Hydraulic Punch — Compresses coconut fiber into mold',
  Punch_Body: 'Hydraulic Punch — Compresses coconut fiber into mold',
  Punch_Tip: 'Punch Tip — Forms the pot shape inside the mold',
  Punch_Platen: 'Punch Platen — Transfers press force to the punch tip',
  HydCyl_PistonRod: 'Hydraulic Cylinder Rod — Drives the punch press motion',
  Comp_EjectorRod: 'Ejector Rod — Pushes finished product out of mold',
  Comp_MixerRotor: 'Mixer Rotor — Blends coconut fiber with binder resin',
  Comp_ConvBelt: 'Conveyor Belt — Transports finished packaging out',
  Comp_PasoA: 'Feed Gate A — Controls fiber flow into mold cavity',
  Comp_PasoB: 'Output Gate B — Releases finished product to conveyor',
  Comp_MixerGate: 'Mixer Gate — Discharges mixed material to mold',
  Comp_DriveRoller: 'Drive Roller — Powers the conveyor belt movement',
};

const MOVING_PART_NAMES = [
  'Comp_PunchAssembly',
  'Punch_Body',
  'Punch_Tip',
  'Punch_Platen',
  'HydCyl_PistonRod',
  'Comp_EjectorRod',
  'Comp_PasoA',
  'Comp_PasoB',
  'Comp_MixerRotor',
  'Comp_MixerGate',
  'Comp_ConvBelt',
  'Comp_DriveRoller',
] as const;

interface MoldingMachineProps {
  playing: boolean;
  speed: number;
  pressingTime: number;
  onPhaseChange: (phase: string) => void;
  onProgress: (progress: number) => void;
  onPartClick: (name: string, info: string, x: number, y: number) => void;
  resetTrigger: number;
  onMissClick?: () => void;
}

function getPhase(t: number, pressingTime: number): string {
  // Basic phase timing based on pressingTime
  // Standard duration is 8s pressing time in default
  const pressStart = 6;
  const pressDuration = pressingTime * 0.25; 
  const holdDuration = pressingTime * 0.25;
  
  if (t < 2) return 'IDLE';
  if (t < 3) return 'FEEDING';
  if (t < 5) return 'FILLING';
  if (t < pressStart) return 'READY';
  if (t < pressStart + pressDuration) return 'PRESSING';
  if (t < pressStart + pressDuration + holdDuration) return 'HOLDING';
  if (t < pressStart + pressDuration + holdDuration + 1) return 'RELEASING';
  if (t < pressStart + pressDuration + holdDuration + 2) return 'EJECTING';
  if (t < pressStart + pressDuration + holdDuration + 3) return 'OUTPUT';
  return 'CONVEYING';
}

function expAlpha(dt: number, speed: number) {
  return 1 - Math.exp(-dt * speed);
}

function ramp(t: number, a: number, b: number) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return THREE.MathUtils.smoothstep(t, a, b);
}

function pulse(t: number, openStart: number, openEnd: number, closeStart: number, closeEnd: number) {
  if (t < openStart) return 0;
  if (t < openEnd) return ramp(t, openStart, openEnd);
  if (t < closeStart) return 1;
  if (t < closeEnd) return 1 - ramp(t, closeStart, closeEnd);
  return 0;
}

function normalizePartName(raw: string) {
  const parts = raw.split('::');
  return parts[parts.length - 1] || raw;
}

function keyify(raw: string) {
  return normalizePartName(raw).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export default function MoldingMachine({
  playing,
  speed,
  pressingTime,
  onPhaseChange,
  onProgress,
  onPartClick,
  resetTrigger,
  onMissClick,
}: MoldingMachineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<TrackballControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const moldRef = useRef<THREE.Object3D | null>(null);
  const modelRadiusRef = useRef(10);

  const clockRef = useRef(new THREE.Clock(false));
  const tRef = useRef(0);
  const beltTravelRef = useRef(0);
  const lastPhaseRef = useRef('');
  const manualPressStartRef = useRef<number | null>(null);
  const manualPressDurationRef = useRef(1600);
  const pressStrokeWorldRef = useRef<number | null>(null);
  const potBinRef = useRef<THREE.Object3D | null>(null);
  const potBinBoxRef = useRef<THREE.Box3 | null>(null);
  const cycleIndexRef = useRef(0);
  const potDropRecordedCycleRef = useRef(-1);
  const potInBinCountRef = useRef(0);

  const originalTransforms = useRef<Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion }>>(
    new Map(),
  );
  const originalWorldPositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const partSizes = useRef<Map<string, THREE.Vector3>>(new Map());
  const partRefs = useRef<Map<string, THREE.Object3D>>(new Map());
  const initialized = useRef(false);
  const motionDirs = useRef<Map<string, THREE.Vector3>>(new Map());

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouseNdc = useMemo(() => new THREE.Vector2(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpQuat2 = useMemo(() => new THREE.Quaternion(), []);
  const tmpAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const tmpV1 = useMemo(() => new THREE.Vector3(), []);
  const tmpV2 = useMemo(() => new THREE.Vector3(), []);
  const tmpV3 = useMemo(() => new THREE.Vector3(), []);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onProgressRef = useRef(onProgress);
  const onPartClickRef = useRef(onPartClick);
  const onMissClickRef = useRef(onMissClick);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onPartClickRef.current = onPartClick;
  }, [onPartClick]);

  useEffect(() => {
    onMissClickRef.current = onMissClick;
  }, [onMissClick]);

  const resetPartsToOriginal = () => {
    partRefs.current.forEach((obj, name) => {
      const orig = originalTransforms.current.get(name);
      if (!orig) return;
      obj.position.copy(orig.position);
      obj.quaternion.copy(orig.quaternion);
    });
  };

  const getPartMagnitude = (name: string) => {
    const s = partSizes.current.get(name);
    if (!s) return 1;
    return Math.max(s.x, s.y, s.z) || 1;
  };

  const getMotionDirLocal = (key: string) => {
    return motionDirs.current.get(key);
  };

  useEffect(() => {
    if (resetTrigger <= 0) return;
    tRef.current = 0;
    beltTravelRef.current = 0;
    clockRef.current.stop();
    clockRef.current.elapsedTime = 0;
    if (playing) clockRef.current.start();
    resetPartsToOriginal();
    onPhaseChange('IDLE');
    onProgress(0);
  }, [resetTrigger, playing, onPhaseChange, onProgress]);

  useEffect(() => {
    if (playing) clockRef.current.start();
    else clockRef.current.stop();
  }, [playing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const originalTransformsMap = originalTransforms.current;
    const partSizesMap = partSizes.current;
    const partRefsMap = partRefs.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    (renderer as unknown as { physicallyCorrectLights: boolean }).physicallyCorrectLights = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a0f');
    scene.fog = new THREE.Fog('#0a0a0f', 18, 60);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    );
    camera.position.set(8, 6, 8);

    const controls = new TrackballControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.rotateSpeed = 2.4;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.9;
    (controls as unknown as { noRoll: boolean }).noRoll = true;
    controls.staticMoving = false;
    controls.dynamicDampingFactor = 0.12;
    controls.update();

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(10, 20, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 80;
    dir.shadow.camera.left = -20;
    dir.shadow.camera.right = 20;
    dir.shadow.camera.top = 20;
    dir.shadow.camera.bottom = -20;
    scene.add(dir);

    const moldPoint = new THREE.PointLight(0x00ff88, 0.9, 30, 2);
    moldPoint.position.set(0, 3, 0);
    scene.add(moldPoint);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x07070c, roughness: 1, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3;
    ground.receiveShadow = true;
    scene.add(ground);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;

    const fxGroup = new THREE.Group();
    fxGroup.renderOrder = 999; // Force render on top of machine geometry
    scene.add(fxGroup);

    const fiberCount = 220;
    const fiberGeom = new THREE.SphereGeometry(0.08, 8, 8); // Even larger for guaranteed visibility
    const fiberMat = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.7,
      metalness: 0.1,
      emissive: 0x221100, // Add subtle glow to pop out
    });
    const fiberMesh = new THREE.InstancedMesh(fiberGeom, fiberMat, fiberCount);
    fiberMesh.castShadow = true;
    fxGroup.add(fiberMesh);

    const potGeom = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 20, 1, false);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x7c5b3a, roughness: 0.95, metalness: 0.02 });
    const potMesh = new THREE.Mesh(potGeom, potMat);
    potMesh.visible = false;
    potMesh.castShadow = true;
    potMesh.receiveShadow = true;
    fxGroup.add(potMesh);

    const potBinMax = 16;
    const potBinMesh = new THREE.InstancedMesh(potGeom, potMat, potBinMax);
    potBinMesh.visible = true;
    potBinMesh.castShadow = true;
    potBinMesh.receiveShadow = true;
    fxGroup.add(potBinMesh);

    const hopperFiberCount = 80; // Increased from 40
    const hopperFiberMesh = new THREE.InstancedMesh(fiberGeom, fiberMat, hopperFiberCount);
    hopperFiberMesh.castShadow = true;
    fxGroup.add(hopperFiberMesh);

    const pressGapFillGeom = new THREE.CylinderGeometry(1, 1, 1, 36, 1, false);
    const pressGapFillMat = new THREE.MeshStandardMaterial({
      color: 0xd7d7de,
      roughness: 0.45,
      metalness: 0.55,
      transparent: true,
      opacity: 0.0,
    });
    const pressGapFillMesh = new THREE.Mesh(pressGapFillGeom, pressGapFillMat);
    pressGapFillMesh.visible = false;
    pressGapFillMesh.castShadow = true;
    pressGapFillMesh.receiveShadow = true;
    fxGroup.add(pressGapFillMesh);

    const smokeGroup = new THREE.Group();
    smokeGroup.name = '__PRESS_SMOKE__';
    fxGroup.add(smokeGroup);

    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = 64;
    smokeCanvas.height = 64;
    const smokeCtx = smokeCanvas.getContext('2d');
    if (smokeCtx) {
      const g = smokeCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0.0, 'rgba(240,240,245,0.40)');
      g.addColorStop(0.4, 'rgba(220,220,230,0.20)');
      g.addColorStop(1.0, 'rgba(240,240,245,0.0)');
      smokeCtx.fillStyle = g;
      smokeCtx.fillRect(0, 0, 64, 64);
    }
    const smokeTex = new THREE.CanvasTexture(smokeCanvas);
    smokeTex.colorSpace = THREE.SRGBColorSpace;
    const smokeSprites: { sprite: THREE.Sprite; seed: { a: number; r: number; vy: number; vx: number; vz: number } }[] = [];
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.SpriteMaterial({
        map: smokeTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const spr = new THREE.Sprite(mat);
      spr.visible = false;
      smokeGroup.add(spr);
      smokeSprites.push({
        sprite: spr,
        seed: {
          a: Math.random() * Math.PI * 2,
          r: 0.02 + Math.random() * 0.12,
          vy: 0.35 + Math.random() * 0.6,
          vx: (Math.random() - 0.5) * 0.2,
          vz: (Math.random() - 0.5) * 0.2,
        },
      });
    }
    let smokeActive = false;
    let smokeT = 0;
    let smokeCooldown = 0;

    const finishTray = new THREE.Group();
    finishTray.name = '__FINISH_TRAY__';
    fxGroup.add(finishTray);

    const finishTrayMat = new THREE.MeshStandardMaterial({ color: 0x2b2b35, roughness: 0.9, metalness: 0.08 });
    const finishTrayBase = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.7), finishTrayMat);
    const finishTrayWallL = new THREE.Mesh(new THREE.BoxGeometry(1, 0.18, 0.04), finishTrayMat);
    const finishTrayWallR = new THREE.Mesh(new THREE.BoxGeometry(1, 0.18, 0.04), finishTrayMat);
    const finishTrayWallF = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.7), finishTrayMat);
    const finishTrayWallB = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.7), finishTrayMat);
    finishTray.add(finishTrayBase, finishTrayWallL, finishTrayWallR, finishTrayWallF, finishTrayWallB);

    const fiberSeeds = Array.from({ length: fiberCount }, (_, i) => ({
      phase: (i / fiberCount) * Math.PI * 2,
      speed: 0.6 + Math.random() * 0.7,
      offset: Math.random(),
      radius: 0.02 + Math.random() * 0.03,
    }));

    const tmpMat4 = new THREE.Matrix4();
    const tmpPos = new THREE.Vector3();
    const tmpPos2 = new THREE.Vector3();
    const tmpDir = new THREE.Vector3();
    const tmpUp = new THREE.Vector3(0, 1, 0);
    const tmpQuatLocal = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();
    const tmpBoxA = new THREE.Box3();
    const tmpBoxB = new THREE.Box3();
    const tmpM4 = new THREE.Matrix4();
    const tmpM4_2 = new THREE.Matrix4();

    let fiberCurve: THREE.CatmullRomCurve3 | null = null;
    const potStart = new THREE.Vector3();
    const potEnd = new THREE.Vector3();
    const moldPos = new THREE.Vector3();
    const potMoldExitPos = new THREE.Vector3();
    let potConveyorCurve: THREE.CatmullRomCurve3 | null = null;
    const potDropAbovePos = new THREE.Vector3();
    const potDropInsidePos = new THREE.Vector3();
    
    // Refs for hopper animation
    const hopperUpperRef = { current: null as THREE.Object3D | null };
    const hopperPosRef = { current: new THREE.Vector3() };
    const hopperTopPosRef = { current: new THREE.Vector3() };
    
    let moldTopRingObj: THREE.Object3D | null = null;
    let moldInnerCavityObj: THREE.Object3D | null = null;
    let pressTargetWorldYRef = { current: 0 };
    let pressContactTipObj: THREE.Object3D | null = null;
    let radius = 1;

    let disposed = false;

    const loader = new FBXLoader();
    loader.load(
      MODEL_URL,
      (model) => {
        if (disposed) return;

        const removeSet = new Set([
          'Blade_16_74',
          'Mixer_Shaft',
          'Blade_74_16',
          'Blade_74_16_(1)',
        ]);
        const removeTargets: THREE.Object3D[] = [];

        const fixMaterial = (m: THREE.Material) => {
          if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            const mat = m as THREE.MeshStandardMaterial;
            mat.envMapIntensity = 1.0;
            mat.needsUpdate = true;
            return mat;
          }

          if ((m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
            const mat = m as THREE.MeshPhysicalMaterial;
            mat.envMapIntensity = 1.0;
            mat.needsUpdate = true;
            return mat;
          }

          if ((m as THREE.MeshPhongMaterial).isMeshPhongMaterial) {
            const src = m as THREE.MeshPhongMaterial;
            const mat = new THREE.MeshStandardMaterial({
              color: src.color,
              map: src.map ?? null,
              normalMap: (src as unknown as { normalMap?: THREE.Texture | null }).normalMap ?? null,
              emissive: src.emissive,
              emissiveMap: src.emissiveMap ?? null,
              transparent: src.transparent,
              opacity: src.opacity,
              metalness: 0.15,
              roughness: 0.65,
            });
            mat.envMapIntensity = 1.0;
            mat.needsUpdate = true;
            return mat;
          }

          if ((m as THREE.MeshLambertMaterial).isMeshLambertMaterial) {
            const src = m as THREE.MeshLambertMaterial;
            const mat = new THREE.MeshStandardMaterial({
              color: src.color,
              map: src.map ?? null,
              emissive: src.emissive,
              emissiveMap: src.emissiveMap ?? null,
              transparent: src.transparent,
              opacity: src.opacity,
              metalness: 0.05,
              roughness: 0.8,
            });
            mat.envMapIntensity = 0.9;
            mat.needsUpdate = true;
            return mat;
          }

          return m;
        };

        model.traverse((obj) => {
          const n0 = normalizePartName(obj.name || '');
          if (n0 && removeSet.has(n0)) removeTargets.push(obj);

          obj.matrixAutoUpdate = true;
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => fixMaterial(m));
          } else if (mesh.material) {
            mesh.material = fixMaterial(mesh.material);
          }
        });

        for (const obj of removeTargets) {
          obj.visible = false;
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            (mesh.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              if (!m) continue;
              (m as THREE.Material).dispose?.();
            }
          }
          obj.parent?.remove(obj);
        }

        const findByNames = (names: string[]): THREE.Object3D | null => {
          const set = new Set(names);
          let found: THREE.Object3D | null = null;
          model.traverse((obj) => {
            if (found) return;
            const n = normalizePartName(obj.name || '');
            if (set.has(n)) found = obj;
          });
          return found;
        };

        const legObjects: THREE.Object3D[] = [];
        model.traverse((obj) => {
          const n = normalizePartName(obj.name || '');
          if (!n) return;
          if (n.startsWith('Leg_') || n.toLowerCase().includes('leg')) legObjects.push(obj);
        });

        const baseQ = model.quaternion.clone();
        const tmpQ = new THREE.Quaternion();
        const scoreOrientation = () => {
          if (legObjects.length === 0) return -Infinity;
          let score = 0;
          for (const leg of legObjects) {
            const b = new THREE.Box3().setFromObject(leg);
            const s = new THREE.Vector3();
            b.getSize(s);
            const horiz = Math.max(s.x, s.z, 1e-6);
            score += s.y / horiz;
          }
          const punch = findByNames(['Punch_Tip', 'Punch_Body', 'HydCyl_PistonRod', 'Comp_PunchAssembly']);
          const mold = findByNames(['Mold_OuterWall', 'Mold_InnerCavity', 'Mold_TopRing', 'Mold_BaseRing']);
          if (punch && mold) {
            const p = new THREE.Vector3();
            const m = new THREE.Vector3();
            punch.getWorldPosition(p);
            mold.getWorldPosition(m);
            if (p.y > m.y) score += 5;
          }
          return score;
        };

        const orientationCandidates = [
          new THREE.Quaternion(),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2)),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI)),
        ];

        let bestScore = -Infinity;
        let bestQ = baseQ.clone();
        for (const cq of orientationCandidates) {
          tmpQ.copy(baseQ).multiply(cq);
          model.quaternion.copy(tmpQ);
          model.updateMatrixWorld(true);
          const s = scoreOrientation();
          if (s > bestScore) {
            bestScore = s;
            bestQ = tmpQ.clone();
          }
        }
        model.quaternion.copy(bestQ);
        model.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        model.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const desired = 10;
        const scale = maxDim > 0 ? desired / maxDim : 1;
        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);

        const box2 = new THREE.Box3().setFromObject(model);
        const center2 = new THREE.Vector3();
        box2.getCenter(center2);
        const sphere = new THREE.Sphere();
        box2.getBoundingSphere(sphere);

        radius = Math.max(1, sphere.radius);
        modelRadiusRef.current = radius;
        camera.near = Math.max(0.01, radius / 200);
        camera.far = radius * 50;
        camera.updateProjectionMatrix();

        controls.target.copy(center2);
        camera.position.set(center2.x + radius * 1.2, center2.y + radius * 0.7, center2.z + radius * 1.2);
        camera.lookAt(center2);
        controls.update();

        const pressDirWorld = new THREE.Vector3(0, -1, 0);
        const findFuzzy = (target: string): THREE.Object3D | null => {
          const tk = keyify(target);
          let found: THREE.Object3D | null = null;
          model.traverse((obj) => {
            if (found || !obj.name) return;
            const k = keyify(obj.name);
            if (k === tk || k.includes(tk) || tk.includes(k)) found = obj;
          });
          return found;
        };

        const findAnyFuzzy = (targets: string[]) => {
          for (const t of targets) {
            const obj = findFuzzy(t);
            if (obj) return obj;
          }
          return null;
        };

        const tipObj =
          findFuzzy('Punch_Tip') ?? findFuzzy('Punch_Platen') ?? findFuzzy('Punch_Body') ?? findFuzzy('Comp_PunchAssembly');
        moldTopRingObj =
          findAnyFuzzy(['Mold_TopRing', 'Mold_TopRing_0', 'Mold_TopRing_1', 'Mold_TopRing_(1)', 'TopRing', 'MoldTop']) ??
          findFuzzy('Mold_TopRing');

        pressStrokeWorldRef.current = null;

        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const n = normalizePartName(mesh.name || '');
          const isFrame =
            n.startsWith('Leg_') || n.startsWith('Beam') || n.startsWith('Frame') || n.includes('Frame');
          if (!isFrame) return;

          const apply = (m: THREE.Material) => {
            const mat = m as THREE.MeshStandardMaterial;
            if (!mat.isMeshStandardMaterial) return;
            mat.color.set('#facc15');
            mat.metalness = 0.2;
            mat.roughness = 0.55;
          };

          if (Array.isArray(mesh.material)) mesh.material.forEach(apply);
          else if (mesh.material) apply(mesh.material);
        });

        const candidates: { key: string; name: string; obj: THREE.Object3D }[] = [];
        model.traverse((obj) => {
          if (!obj.name) return;
          candidates.push({ key: keyify(obj.name), name: normalizePartName(obj.name), obj });
        });

        const findPart = (root: THREE.Object3D, targetName: string) => {
          const direct = root.getObjectByName(targetName);
          if (direct) return direct;

          const targetKey = keyify(targetName);
          const requiredTokens: string[] = [];
          if (targetKey.includes('conv') || targetKey.includes('belt')) requiredTokens.push('conv', 'belt');
          if (targetKey.includes('mold') && targetKey.includes('cavity')) requiredTokens.push('mold', 'cavity');
          else if (targetKey.includes('mold')) requiredTokens.push('mold');
          if (targetKey.includes('punch')) requiredTokens.push('punch');
          if (targetKey.includes('body')) requiredTokens.push('body');
          if (targetKey.includes('platen')) requiredTokens.push('platen');
          if (targetKey.includes('tip')) requiredTokens.push('tip');
          if (targetKey.includes('comp') && targetKey.includes('punch')) requiredTokens.push('comp', 'punch');
          if (targetKey.includes('piston') || targetKey.includes('hydcyl') || targetKey.includes('rod'))
            requiredTokens.push('piston', 'hyd', 'cyl', 'rod');

          let best: { obj: THREE.Object3D; score: number } | null = null;

          for (const c of candidates) {
            if (requiredTokens.length > 0) {
              let ok = false;
              for (const tok of requiredTokens) {
                if (tok && c.key.includes(tok)) {
                  ok = true;
                  break;
                }
              }
              if (!ok) continue;
            }

            let score = 0;
            if (c.name === targetName) score += 1000;
            if (c.key === targetKey) score += 900;
            if (c.key.includes(targetKey)) score += 300 + (targetKey.length / Math.max(1, c.key.length)) * 100;
            if (targetKey.includes(c.key) && c.key.length >= 6) score += 120;

            let commonPrefix = 0;
            const len = Math.min(c.key.length, targetKey.length);
            for (let i = 0; i < len; i++) {
              if (c.key[i] !== targetKey[i]) break;
              commonPrefix++;
            }
            score += commonPrefix * 6;

            if (!best || score > best.score) best = { obj: c.obj, score };
          }

          if (!best || best.score < 120) return null;
          return best.obj;
        };


        const findAny = (root: THREE.Object3D, names: string[]) => {
          for (const n of names) {
            const obj = findPart(root, n);
            if (obj) return obj;
          }
          return null;
        };

        const repositionAttachedToMold = () => {
          const mold = findAny(model, ['Mold_OuterWall', 'Mold_InnerCavity', 'Mold_TopRing', 'Mold_BaseRing']);
          if (!mold) return;

          const moldBox = new THREE.Box3().setFromObject(mold);
          const moldCenter = new THREE.Vector3();
          const moldSize = new THREE.Vector3();
          moldBox.getCenter(moldCenter);
          moldBox.getSize(moldSize);

          const hpuParts = [
            findPart(model, 'HPU_Tank'),
            findPart(model, 'HPU_TankLid'),
            findPart(model, 'HPU_Motor'),
            findPart(model, 'HPU_Fan'),
            findPart(model, 'HPU_Gauge'),
          ].filter((x): x is THREE.Object3D => !!x);

          if (hpuParts.length === 0) return;

          const gap = modelRadiusRef.current * 0.02;
          for (const part of hpuParts) {
            const partBox = new THREE.Box3().setFromObject(part);
            const partCenter = new THREE.Vector3();
            const partSize = new THREE.Vector3();
            partBox.getCenter(partCenter);
            partBox.getSize(partSize);

            const dir = partCenter.clone().sub(moldCenter);
            dir.y = 0;
            if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
            dir.normalize();

            const useX = Math.abs(dir.x) >= Math.abs(dir.z);
            const moldHalf = (useX ? moldSize.x : moldSize.z) / 2;
            const partHalf = (useX ? partSize.x : partSize.z) / 2;
            const distance = moldHalf + partHalf + gap;

            const targetCenter = moldCenter.clone().addScaledVector(dir, distance);
            const delta = targetCenter.sub(partCenter);

            const originWorld = part.getWorldPosition(new THREE.Vector3());
            const newOriginWorld = originWorld.add(delta);
            if (part.parent) {
              part.parent.updateMatrixWorld(true);
              part.position.copy(part.parent.worldToLocal(newOriginWorld.clone()));
            } else {
              part.position.copy(newOriginWorld);
            }
            part.updateMatrix();
            part.updateMatrixWorld(true);
          }
        };

        for (const name of MOVING_PART_NAMES) {
          const obj = findPart(model, name) ?? findFuzzy(name);
          if (obj) {
            obj.matrixAutoUpdate = true;
            originalTransforms.current.set(name, {
              position: obj.position.clone(),
              quaternion: obj.quaternion.clone(),
            });
            originalWorldPositions.current.set(name, obj.getWorldPosition(new THREE.Vector3()));
            partRefs.current.set(name, obj);
            const pb = new THREE.Box3().setFromObject(obj);
            const ps = new THREE.Vector3();
            pb.getSize(ps);
            partSizes.current.set(name, ps);
          }
        }

        repositionAttachedToMold();

        const moldObj =
          findAny(model, ['Mold_InnerCavity', 'Mold_TopRing', 'Mold_OuterWall', 'Mold_BaseRing', 'Mold_TopRing_0']) ??
          null;
        moldRef.current = moldObj;
        
        // Save initial references for cavity and ring early
        moldInnerCavityObj = findPart(model, 'Mold_InnerCavity');
        moldTopRingObj = findPart(model, 'Mold_TopRing');

        const removeLegacyConveyorBins = () => {
          const removeTargets: THREE.Object3D[] = [];
          model.traverse((obj) => {
            if (!obj.name) return;
            const k = keyify(obj.name);
            if (!k.includes('conv')) return;
            if (k.includes('belt') || k.includes('roller') || k.includes('frame') || k.includes('bed')) return;
            if (!(k.includes('bin') || k.includes('tray') || k.includes('box'))) return;
            removeTargets.push(obj);
          });

          for (const obj of removeTargets) {
            obj.visible = false;
            obj.parent?.remove(obj);
          }
        };

        const raiseMoldOuterWall = () => {
          const moldOuter = findPart(model, 'Mold_OuterWall');
          if (!moldOuter) return;

          const raise = Math.max(0.02, modelRadiusRef.current * 0.03);
          const wp = moldOuter.getWorldPosition(new THREE.Vector3());
          wp.y += raise;

          if (moldOuter.parent) {
            moldOuter.parent.updateMatrixWorld(true);
            moldOuter.position.copy(moldOuter.parent.worldToLocal(wp));
          } else {
            moldOuter.position.copy(wp);
          }
          moldOuter.updateMatrix();
          moldOuter.updateMatrixWorld(true);
        };

        raiseMoldOuterWall();
        removeLegacyConveyorBins();
        potBinRef.current = finishTray;

        const ensureMoldCenterHole = () => {
          const moldOuter = findPart(model, 'Mold_OuterWall');
          if (!moldOuter) return;

          const existing = moldOuter.getObjectByName('__MOLD_CENTER_HOLE__') as THREE.Group | null;
          const mb = new THREE.Box3().setFromObject(moldOuter);
          const ms = new THREE.Vector3();
          const mc = new THREE.Vector3();
          mb.getSize(ms);
          mb.getCenter(mc);

          const minXZ = Math.max(0.001, Math.min(ms.x, ms.z));
          const potRadius = 0.22;
          const minR = minXZ * 0.12;
          const maxR = minXZ * 0.45;
          const desiredR = potRadius * 1.2;
          const holeRadius = THREE.MathUtils.clamp(desiredR, minR, maxR);
          const holeHeight = Math.max(ms.y * 1.4, potRadius * 5);
          const discThickness = Math.max(0.001, ms.y * 0.02);
          const eps = Math.max(0.001, modelRadiusRef.current * 0.002);

          const mkStandardDark = () => {
            const mat = new THREE.MeshStandardMaterial({
              color: 0x050508,
              roughness: 1,
              metalness: 0,
              side: THREE.DoubleSide,
            });
            mat.polygonOffset = true;
            mat.polygonOffsetFactor = -6;
            mat.polygonOffsetUnits = -6;
            return mat;
          };

          const mkDiscMat = () => {
            const mat = new THREE.MeshStandardMaterial({
              color: 0x020203,
              roughness: 1,
              metalness: 0,
              side: THREE.DoubleSide,
            });
            mat.depthWrite = false;
            mat.polygonOffset = true;
            mat.polygonOffsetFactor = -10;
            mat.polygonOffsetUnits = -10;
            return mat;
          };

          const holeGroup = existing ?? new THREE.Group();
          holeGroup.name = '__MOLD_CENTER_HOLE__';

          let cyl = holeGroup.getObjectByName('__MOLD_CENTER_HOLE_CYL__') as THREE.Mesh | null;
          let disc = holeGroup.getObjectByName('__MOLD_CENTER_HOLE_DISC__') as THREE.Mesh | null;

          if (!cyl) {
            cyl = new THREE.Mesh(new THREE.CylinderGeometry(holeRadius, holeRadius, holeHeight, 40, 1, true), mkStandardDark());
            cyl.name = '__MOLD_CENTER_HOLE_CYL__';
            cyl.castShadow = false;
            cyl.receiveShadow = false;
            cyl.renderOrder = 9;
            holeGroup.add(cyl);
          } else {
            (cyl.geometry as THREE.BufferGeometry).dispose();
            cyl.geometry = new THREE.CylinderGeometry(holeRadius, holeRadius, holeHeight, 40, 1, true);
          }

          if (!disc) {
            disc = new THREE.Mesh(new THREE.CircleGeometry(holeRadius * 1.02, 48), mkDiscMat());
            disc.name = '__MOLD_CENTER_HOLE_DISC__';
            disc.castShadow = false;
            disc.receiveShadow = false;
            disc.renderOrder = 10;
            disc.rotation.x = -Math.PI / 2;
            holeGroup.add(disc);
          } else {
            (disc.geometry as THREE.BufferGeometry).dispose();
            disc.geometry = new THREE.CircleGeometry(holeRadius * 1.02, 48);
            disc.rotation.x = -Math.PI / 2;
          }

          if (holeGroup.parent !== moldOuter) moldOuter.add(holeGroup);
          moldOuter.updateMatrixWorld(true);

          const worldCylPos = new THREE.Vector3(mc.x, (mb.min.y + mb.max.y) / 2, mc.z);
          const worldDiscPos = new THREE.Vector3(mc.x, mb.max.y + eps, mc.z);
          cyl.position.copy(moldOuter.worldToLocal(worldCylPos.clone()));
          disc.position.copy(moldOuter.worldToLocal(worldDiscPos.clone()));

          holeGroup.updateMatrixWorld(true);
        };

        ensureMoldCenterHole();

        const computePressStrokeToTopRing = () => {
          const tip =
            tipObj ?? findPart(model, 'Punch_Tip') ?? findFuzzy('Punch_Tip') ?? findFuzzy('Punch_Platen') ?? findFuzzy('Punch_Body') ?? findFuzzy('Comp_PunchAssembly');
          
          // Priority 1: Mold_InnerCavity
          // Priority 2: Mold_TopRing (only if cavity is missing)
          const target = moldInnerCavityObj ?? moldTopRingObj ?? findPart(model, 'Mold_InnerCavity') ?? findFuzzy('Mold_InnerCavity');

          if (!tip || !target) {
            pressStrokeWorldRef.current = null;
            return;
          }

          tmpBoxA.setFromObject(tip);
          
          // We want the top surface of the actual cavity mesh.
          // If the target has children (like sensors) that are higher, we ignore them.
          let targetMaxY = -Infinity;
          target.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
              const n = keyify(mesh.name || '');
              // Ignore sensors or top parts when calculating the cavity top
              if (n.includes('sens') || n.includes('top')) return;
              
              tmpBoxB.setFromObject(mesh);
              if (tmpBoxB.max.y > targetMaxY) targetMaxY = tmpBoxB.max.y;
            }
          });

          // Fallback if no meshes found or if we are targeting TopRing directly
          if (targetMaxY === -Infinity) {
            tmpBoxB.setFromObject(target);
            targetMaxY = tmpBoxB.max.y;
          }

          // targetGap is the final vertical distance between tip and target surface.
           // Setting this to a negative value ensures they "collide" or "isagad"
           // for a visible compression effect.
           const targetGap = -Math.max(0.04, radius * 0.012); 
          const gapY = tmpBoxA.min.y - targetMaxY;
          pressTargetWorldYRef.current = targetMaxY;
          const stroke = Math.max(0, gapY - targetGap);
          // Increased limit from 0.9 to 1.5 to allow the punch to reach the mold
          pressStrokeWorldRef.current = THREE.MathUtils.clamp(stroke, 0, radius * 1.5);
        };

        motionDirs.current.clear();
        const worldDown = new THREE.Vector3(0, -1, 0);
        const worldUp = new THREE.Vector3(0, 1, 0);
        const worldRight = new THREE.Vector3(1, 0, 0);
        const worldForward = new THREE.Vector3(0, 0, 1);

        const dirLocalFromWorld = (obj: THREE.Object3D, worldDir: THREE.Vector3) => {
          const parent = obj.parent;
          if (!parent) return null;
          obj.getWorldPosition(tmpV1);
          parent.updateMatrixWorld(true);
          const a = parent.worldToLocal(tmpV1.clone());
          const b = parent.worldToLocal(tmpV1.clone().add(worldDir));
          const d = b.sub(a).normalize();
          if (d.length() < 1e-6) return null;
          return d;
        };

        if (moldTopRingObj) {
          const localUp = dirLocalFromWorld(moldTopRingObj, worldUp);
          if (localUp) {
            const absX = Math.abs(localUp.x);
            const absY = Math.abs(localUp.y);
            const absZ = Math.abs(localUp.z);
            // Thickening logic for Mold_TopRing
            if (absX > absY && absX > absZ) moldTopRingObj.scale.x *= 1.50;
            else if (absY > absX && absY > absZ) moldTopRingObj.scale.y *= 1.50;
            else moldTopRingObj.scale.z *= 1.50;
            moldTopRingObj.updateMatrix();
            moldTopRingObj.updateMatrixWorld(true);
          }
        }

        // Taasan ang Mold_OuterWall para lumapat sa punch
        const moldOuterWall = findPart(model, 'Mold_OuterWall');
        if (moldOuterWall) {
          const localUp = dirLocalFromWorld(moldOuterWall, worldUp);
          if (localUp) {
            const absX = Math.abs(localUp.x);
            const absY = Math.abs(localUp.y);
            const absZ = Math.abs(localUp.z);
            const scaleFactor = 1.0; // Ibinalik sa original na height (1.0x)
            if (absX > absY && absX > absZ) moldOuterWall.scale.x *= scaleFactor;
            else if (absY > absX && absY > absZ) moldOuterWall.scale.y *= scaleFactor;
            else moldOuterWall.scale.z *= scaleFactor;
            moldOuterWall.updateMatrix();
            moldOuterWall.updateMatrixWorld(true);

            // Taasan ang Mold_InnerCavity nang signipikante (2.8x) para maabot ng punch
            const cavity = findPart(model, 'Mold_InnerCavity');
            moldInnerCavityObj = cavity;
            if (cavity) {
              const cLocalUp = dirLocalFromWorld(cavity, worldUp);
              if (cLocalUp) {
                const cAbsX = Math.abs(cLocalUp.x);
                const cAbsY = Math.abs(cLocalUp.y);
                const cAbsZ = Math.abs(cLocalUp.z);
                const cScale = 2.1; 
                if (cAbsX > cAbsY && cAbsX > cAbsZ) cavity.scale.x *= cScale;
                else if (cAbsY > cAbsX && cAbsY > cAbsZ) cavity.scale.y *= cScale;
                else cavity.scale.z *= cScale;
                cavity.updateMatrix();
                cavity.updateMatrixWorld(true);
              }
            }

            // Ilipat natin ang Cavity at TopRing sa taas ng OuterWall
            const outerBox = new THREE.Box3().setFromObject(moldOuterWall);
            const targetTopY = outerBox.max.y;

            [moldInnerCavityObj, moldTopRingObj].forEach((obj) => {
              if (obj) {
                const objBox = new THREE.Box3().setFromObject(obj);
                const diff = targetTopY - objBox.max.y;
                if (Math.abs(diff) > 0.001) {
                  const wp = obj.getWorldPosition(new THREE.Vector3());
                  wp.y += diff;
                  if (obj.parent) {
                    obj.parent.updateMatrixWorld(true);
                    obj.position.copy(obj.parent.worldToLocal(wp.clone()));
                  } else {
                    obj.position.copy(wp);
                  }
                  obj.updateMatrix();
                  obj.updateMatrixWorld(true);
                }
              }
            });

            // Final adjustment para sa TopRing: Dapat nakapatong ito sa pinakataas ng InnerCavity
            if (moldInnerCavityObj && moldTopRingObj) {
              const cavityBox = new THREE.Box3().setFromObject(moldInnerCavityObj);
              const ringBox = new THREE.Box3().setFromObject(moldTopRingObj);
              const cTop = cavityBox.max.y;
              const rBottom = ringBox.min.y;
              const rDiff = cTop - rBottom;
              if (Math.abs(rDiff) > 0.001) {
                const rWp = moldTopRingObj.getWorldPosition(new THREE.Vector3());
                rWp.y += rDiff;
                if (moldTopRingObj.parent) {
                  moldTopRingObj.parent.updateMatrixWorld(true);
                  moldTopRingObj.position.copy(moldTopRingObj.parent.worldToLocal(rWp.clone()));
                } else {
                  moldTopRingObj.position.copy(rWp);
                }
                moldTopRingObj.updateMatrix();
                moldTopRingObj.updateMatrixWorld(true);
              }
            }
          }
        }

        // Siguraduhin na ang lahat ng moving parts ay nahanap bago mag-compute ng stroke
        // Re-find and update references to ensure they are current after model modifications
        for (const name of MOVING_PART_NAMES) {
          const obj = findPart(model, name);
          if (obj) {
            obj.matrixAutoUpdate = true;
            originalTransforms.current.set(name, {
              position: obj.position.clone(),
              quaternion: obj.quaternion.clone(),
            });
            originalWorldPositions.current.set(name, obj.getWorldPosition(new THREE.Vector3()));
            partRefs.current.set(name, obj);
            const pb = new THREE.Box3().setFromObject(obj);
            const ps = new THREE.Vector3();
            pb.getSize(ps);
            partSizes.current.set(name, ps);
          }
        }

        const mixerGateObj = findPart(model, 'Comp_MixerGate') ?? findFuzzy('MixerGate');
        const mixerGateHandle = findFuzzy('Mixer_GateHandle') ?? findFuzzy('GateHandle') ?? findFuzzy('Handle');
        if (mixerGateHandle && mixerGateObj) {
          // Parenting the handle to the gate to prevent separation
          // Use .attach() to maintain world transform automatically
          mixerGateObj.attach(mixerGateHandle);
          
          partRefs.current.set('Mixer_GateHandle', mixerGateHandle);
          originalTransforms.current.set('Mixer_GateHandle', {
            position: mixerGateHandle.position.clone(),
            quaternion: mixerGateHandle.quaternion.clone(),
          });
        }

        computePressStrokeToTopRing();

        let beltObj = findAny(model, ['Comp_ConvBelt', 'Conv_BedPlate', 'Conv_FrameL', 'Conv_FrameR']);
        if (beltObj) {
          const k = keyify(beltObj.name || '');
          if (!(k.includes('conv') || k.includes('belt'))) beltObj = null;
        }
        let beltAxisWorld = worldRight;
        let beltSize: THREE.Vector3 | null = null;
        if (beltObj) {
          const beltBox = new THREE.Box3().setFromObject(beltObj);
          beltSize = new THREE.Vector3();
          beltBox.getSize(beltSize);
          beltAxisWorld = beltSize.x >= beltSize.z ? worldRight : worldForward;
          const d = dirLocalFromWorld(beltObj, beltAxisWorld);
          if (d) motionDirs.current.set('Comp_ConvBelt', d);
        }

        const pressAxisWorld = worldDown;

        const pressKeysInit = ['Comp_PunchAssembly', 'Punch_Body', 'Punch_Tip', 'Punch_Platen', 'HydCyl_PistonRod'];
        for (const k of pressKeysInit) {
          const obj = partRefs.current.get(k);
          if (!obj) continue;
          const d = dirLocalFromWorld(obj, pressAxisWorld);
          if (d) motionDirs.current.set(k, d);
        }

        const ejector = partRefs.current.get('Comp_EjectorRod');
        if (ejector) {
          const d = dirLocalFromWorld(ejector, worldUp);
          if (d) motionDirs.current.set('Comp_EjectorRod', d);
        }

        const pasoA = partRefs.current.get('Comp_PasoA');
        if (pasoA) {
          const d = dirLocalFromWorld(pasoA, worldRight);
          if (d) motionDirs.current.set('Comp_PasoA', d);
        }

        const pasoB = partRefs.current.get('Comp_PasoB');
        if (pasoB) {
          const d = dirLocalFromWorld(pasoB, worldRight);
          if (d) motionDirs.current.set('Comp_PasoB', d);
        }

        modelRef.current = model;
        scene.add(model);
        model.updateMatrixWorld(true);
        initialized.current = true;
        setLoading(false);
        setLoadError(null);

        const modelBox = new THREE.Box3().setFromObject(model);
        const modelSize = new THREE.Vector3();
        const modelCenter = new THREE.Vector3();
        modelBox.getSize(modelSize);
        modelBox.getCenter(modelCenter);

        const hopperUpper = findAny(model, ['Hopper_UpperBody', 'Hopper_TopRim', 'Hopper_Taper1', 'Hopper_Neck']);
        hopperUpperRef.current = hopperUpper;
        const mixerObj = findAny(model, ['Mixer_Drum', 'Mixer_DischargePort', 'Mixer_Lid']);

        const hopperPos = new THREE.Vector3();
        const hopperTopPos = new THREE.Vector3();
        const mixerPos = new THREE.Vector3();
        if (hopperUpper) {
          hopperUpper.getWorldPosition(hopperPos);
          const hb = new THREE.Box3().setFromObject(hopperUpper);
          const hc = new THREE.Vector3();
          hb.getCenter(hc);
          hopperPos.copy(hc);
          hopperTopPos.set(hc.x, hb.max.y, hc.z);
          hopperPosRef.current.copy(hopperPos);
          hopperTopPosRef.current.copy(hopperTopPos);
        } else {
          hopperPos.copy(modelCenter).add(new THREE.Vector3(-modelSize.x * 0.28, modelSize.y * 0.18, 0));
          hopperTopPos.copy(hopperPos).add(new THREE.Vector3(0, modelSize.y * 0.12, 0));
          hopperPosRef.current.copy(hopperPos);
          hopperTopPosRef.current.copy(hopperTopPos);
        }

        if (mixerObj) mixerObj.getWorldPosition(mixerPos);
        else mixerPos.copy(modelCenter).add(new THREE.Vector3(-modelSize.x * 0.18, modelSize.y * 0.02, 0));

        if (moldObj) moldObj.getWorldPosition(moldPos);
        else moldPos.copy(modelCenter).add(new THREE.Vector3(0, -modelSize.y * 0.03, 0));

        if (moldObj) {
          const mb = new THREE.Box3().setFromObject(moldObj);
          const mc = new THREE.Vector3();
          mb.getCenter(mc);
          const potHeight = 0.35;
          potMoldExitPos.set(mc.x, mb.max.y + potHeight / 2 + Math.max(0.01, modelRadiusRef.current * 0.005), mc.z);
        } else {
          potMoldExitPos.copy(moldPos).add(new THREE.Vector3(0, modelRadiusRef.current * 0.08, 0));
        }

        const inletStart = hopperTopPos.clone().add(new THREE.Vector3(0, Math.max(0.25, modelRadiusRef.current * 0.08), 0));
        const inletIntoHopper = hopperPos.clone().lerp(hopperTopPos, 0.35);
        fiberCurve = new THREE.CatmullRomCurve3(
          [inletStart, inletIntoHopper, hopperPos, mixerPos, moldPos],
          false,
          'centripetal',
          0.5,
        );

        const potHeight = 0.35;
        const clearance = Math.max(0.02, modelRadiusRef.current * 0.01);

        const beltTopObj =
          findAny(model, ['Conv_BeltTop', 'Conv_BeltTop_(1)', 'Conv_BeltTop_1', 'Conv_BeltTop_0']) ?? null;
        const beltSurface = beltTopObj ?? beltObj;

        if (beltSurface) {
          const bb = new THREE.Box3().setFromObject(beltSurface);
          const bc = new THREE.Vector3();
          const bs = new THREE.Vector3();
          bb.getCenter(bc);
          bb.getSize(bs);

          const axisWorld = bs.x >= bs.z ? worldRight : worldForward;
          const halfLen = (bs.x >= bs.z ? bs.x : bs.z) * 0.48;
          const endA = bc.clone().addScaledVector(axisWorld, -halfLen);
          const endB = bc.clone().addScaledVector(axisWorld, halfLen);
          const useA = endA.distanceToSquared(moldPos) <= endB.distanceToSquared(moldPos);
          const entry = useA ? endA : endB;
          const exit = useA ? endB : endA;

          const beltTopY = bb.max.y;
          potStart.set(entry.x, beltTopY + potHeight / 2 + clearance, entry.z);
          potEnd.set(exit.x, beltTopY + potHeight / 2 + clearance, exit.z);
          potConveyorCurve = new THREE.CatmullRomCurve3([potStart.clone(), potEnd.clone()], false, 'centripetal', 0.5);

          const alongLen = Math.max(potHeight * 2.4, Math.min(1.6, modelRadiusRef.current * 0.25));
          const across = Math.max(potHeight * 2.0, (bs.x >= bs.z ? bs.z : bs.x) * 0.9);
          const baseThick = Math.max(0.03, modelRadiusRef.current * 0.01);
          const wallH = Math.max(0.14, potHeight * 0.8);
          const wallT = Math.max(0.02, baseThick * 0.8);

          const trayCenter = potEnd.clone().addScaledVector(axisWorld, Math.max(potHeight * 1.2, modelRadiusRef.current * 0.05));
          trayCenter.y = beltTopY + baseThick / 2;
          finishTray.position.copy(trayCenter);
          finishTray.rotation.set(0, axisWorld.equals(worldForward) ? Math.PI / 2 : 0, 0);

          const base = finishTrayBase.geometry as THREE.BufferGeometry;
          const wl = finishTrayWallL.geometry as THREE.BufferGeometry;
          const wr = finishTrayWallR.geometry as THREE.BufferGeometry;
          const wf = finishTrayWallF.geometry as THREE.BufferGeometry;
          const wb2 = finishTrayWallB.geometry as THREE.BufferGeometry;
          base.dispose();
          wl.dispose();
          wr.dispose();
          wf.dispose();
          wb2.dispose();

          finishTrayBase.geometry = new THREE.BoxGeometry(alongLen, baseThick, across);
          finishTrayWallL.geometry = new THREE.BoxGeometry(alongLen, wallH, wallT);
          finishTrayWallR.geometry = new THREE.BoxGeometry(alongLen, wallH, wallT);
          finishTrayWallF.geometry = new THREE.BoxGeometry(wallT, wallH, across);
          finishTrayWallB.geometry = new THREE.BoxGeometry(wallT, wallH, across);

          finishTrayBase.position.set(0, 0, 0);
          finishTrayWallL.position.set(0, wallH / 2 + baseThick / 2, -(across / 2 - wallT / 2));
          finishTrayWallR.position.set(0, wallH / 2 + baseThick / 2, across / 2 - wallT / 2);
          finishTrayWallF.position.set(-(alongLen / 2 - wallT / 2), wallH / 2 + baseThick / 2, 0);
          finishTrayWallB.position.set(alongLen / 2 - wallT / 2, wallH / 2 + baseThick / 2, 0);

          finishTray.updateMatrixWorld(true);
          potBinBoxRef.current = new THREE.Box3().setFromObject(finishTray);
        } else {
          potStart.copy(moldPos).add(new THREE.Vector3(modelSize.x * 0.02, modelSize.y * 0.02, modelSize.z * 0.12));
          potEnd.copy(potStart).add(new THREE.Vector3(modelSize.x * 0.45, 0, 0));
          potConveyorCurve = new THREE.CatmullRomCurve3([potStart.clone(), potEnd.clone()], false, 'centripetal', 0.5);
        }

        const configureBinBAsTerminal = () => {
          const baseCandidates: THREE.Object3D[] = [];
          const wallCandidates: THREE.Object3D[] = [];
          const removeBinA: THREE.Object3D[] = [];

          const isBinBBase = (n: string) => {
            const nn = normalizePartName(n);
            if (!nn) return false;
            if (nn === 'BinB_Base') return true;
            if (nn.startsWith('BinB_Base_') || nn.startsWith('BinB_Base(')) return true;
            const k = keyify(nn);
            return k.includes('binb') && k.includes('base');
          };

          const isBinBWallBk = (n: string) => {
            const nn = normalizePartName(n);
            if (!nn) return false;
            if (nn === 'BinB_WallBk') return true;
            if (nn.startsWith('BinB_WallBk_') || nn.startsWith('BinB_WallBk(')) return true;
            const k = keyify(nn);
            return k.includes('binb') && k.includes('wall') && (k.includes('bk') || k.includes('back'));
          };

          const getBinBRoot = (obj: THREE.Object3D) => {
            let cur: THREE.Object3D | null = obj;
            let best: THREE.Object3D = obj;
            while (cur && cur !== model) {
              const nk = keyify(cur.name || '');
              if (nk.includes('binb')) best = cur;
              cur = cur.parent;
            }
            return best;
          };

          model.traverse((obj) => {
            const n = normalizePartName(obj.name || '');
            if (!n) return;
            if (n.startsWith('BinA_') || keyify(n).includes('bina')) removeBinA.push(obj);
            if (isBinBBase(n)) baseCandidates.push(obj);
            if (isBinBWallBk(n)) wallCandidates.push(obj);
          });

          for (const obj of removeBinA) {
            obj.visible = false;
            obj.parent?.remove(obj);
          }

          if (baseCandidates.length === 0) return;

          const baseCenters = baseCandidates.map((b) => {
            const bx = new THREE.Box3().setFromObject(b);
            const c = new THREE.Vector3();
            bx.getCenter(c);
            return { obj: b, center: c };
          });

          baseCenters.sort((a, b) => a.center.distanceToSquared(potEnd) - b.center.distanceToSquared(potEnd));
          const chosenBase = baseCenters[0].obj;
          const chosenBaseRoot = getBinBRoot(chosenBase);

          const seenRoots = new Set<THREE.Object3D>();
          for (const bc of baseCenters) {
            const root = getBinBRoot(bc.obj);
            if (root === chosenBaseRoot) continue;
            if (seenRoots.has(root)) continue;
            seenRoots.add(root);
            root.visible = false;
            root.parent?.remove(root);
          }

          for (const bc of baseCenters) {
            const root = getBinBRoot(bc.obj);
            if (root !== chosenBaseRoot) continue;
            if (bc.obj === chosenBase) continue;
            let cur: THREE.Object3D | null = chosenBase;
            let bcIsAncestor = false;
            while (cur && cur !== model) {
              if (cur === bc.obj) {
                bcIsAncestor = true;
                break;
              }
              cur = cur.parent;
            }
            cur = bc.obj;
            let chosenIsAncestor = false;
            while (cur && cur !== model) {
              if (cur === chosenBase) {
                chosenIsAncestor = true;
                break;
              }
              cur = cur.parent;
            }
            if (bcIsAncestor || chosenIsAncestor) continue;
            bc.obj.visible = false;
            bc.obj.parent?.remove(bc.obj);
          }

          let chosenWall: THREE.Object3D | null = null;
          if (wallCandidates.length > 0) {
            const baseBox = new THREE.Box3().setFromObject(chosenBaseRoot);
            const baseCenter = new THREE.Vector3();
            baseBox.getCenter(baseCenter);

            const wallInfos = wallCandidates.map((w) => {
              const root = getBinBRoot(w);
              const wb = new THREE.Box3().setFromObject(w);
              const wc = new THREE.Vector3();
              wb.getCenter(wc);
              const sameGroup = root === chosenBaseRoot ? 0 : 1;
              const dist = wc.distanceToSquared(baseCenter);
              return { obj: w, root, sameGroup, dist };
            });
            wallInfos.sort((a, b) => a.sameGroup - b.sameGroup || a.dist - b.dist);
            chosenWall = wallInfos[0]?.obj ?? null;

            const keepRoot = chosenBaseRoot;
            const keepWall = chosenWall;
            const removed = new Set<THREE.Object3D>();
            for (const wi of wallInfos) {
              if (wi.obj === keepWall) continue;
              if (wi.root !== keepRoot) {
                if (removed.has(wi.root)) continue;
                removed.add(wi.root);
                wi.root.visible = false;
                wi.root.parent?.remove(wi.root);
              } else {
                let cur: THREE.Object3D | null = keepWall;
                let wiIsAncestor = false;
                while (cur && cur !== model) {
                  if (cur === wi.obj) {
                    wiIsAncestor = true;
                    break;
                  }
                  cur = cur.parent;
                }
                cur = wi.obj;
                let keepIsAncestor = false;
                while (cur && cur !== model) {
                  if (cur === keepWall) {
                    keepIsAncestor = true;
                    break;
                  }
                  cur = cur.parent;
                }
                if (wiIsAncestor || keepIsAncestor) continue;
                wi.obj.visible = false;
                wi.obj.parent?.remove(wi.obj);
              }
            }
          }

          const combo = new THREE.Box3();
          combo.union(new THREE.Box3().setFromObject(chosenBaseRoot));
          if (chosenWall) combo.union(new THREE.Box3().setFromObject(chosenWall));
          potBinBoxRef.current = combo;

          potBinRef.current = chosenBaseRoot;
          finishTray.visible = false;
        };

        configureBinBAsTerminal();

        const computeBinDrop = () => {
          const bin = potBinRef.current;
          if (!bin) return false;
          const bb = potBinBoxRef.current?.clone() ?? new THREE.Box3().setFromObject(bin);
          potBinBoxRef.current = bb.clone();
          const bc = new THREE.Vector3();
          bb.getCenter(bc);
          const potHeight = 0.35;
          const clearance = Math.max(0.01, modelRadiusRef.current * 0.005);

          potDropAbovePos.set(bc.x, bb.max.y + potHeight / 2 + clearance, bc.z);
          potDropInsidePos.set(bc.x, bb.min.y + potHeight / 2 + clearance * 2, bc.z);
          return true;
        };

        computeBinDrop();

      },
      undefined,
      (err) => {
        if (disposed) return;
        setLoading(false);
        const msg = err instanceof Error ? err.message : `Failed to load ${MODEL_URL}`;
        setLoadError(msg);
      },
    );

    const onResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };

    const onPointerDown = (ev: MouseEvent) => {
      const cam = cameraRef.current;
      const sc = sceneRef.current;
      const mdl = modelRef.current;
      const dom = rendererRef.current?.domElement;
      if (!cam || !sc || !dom || !mdl) return;

      const rect = dom.getBoundingClientRect();
      mouseNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNdc.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(mouseNdc, cam);

      const hits = raycaster.intersectObject(mdl, true);
      if (!hits.length) {
        onMissClickRef.current?.();
        return;
      }

      let cur: THREE.Object3D | null = hits[0].object;
      while (cur && !cur.name) cur = cur.parent;
      const rawName = cur?.name || hits[0].object.name || 'Unknown Part';
      const name = normalizePartName(rawName);
      const info = PART_INFO[name] ?? 'Machine Component';

      if (cur) {
        const isKnown =
          name in PART_INFO ||
          name === 'Comp_PunchAssembly' ||
          name === 'Punch_Body' ||
          name === 'Punch_Platen' ||
          name === 'Punch_Tip' ||
          name === 'HydCyl_PistonRod' ||
          name === 'Comp_EjectorRod' ||
          name === 'Comp_PasoA' ||
          name === 'Comp_PasoB' ||
          name === 'Comp_MixerRotor' ||
          name === 'Comp_MixerGate' ||
          name === 'Comp_ConvBelt' ||
          name === 'Comp_DriveRoller';

        if (isKnown) {
          if (name === 'Punch_Body' || name === 'Punch_Platen' || name === 'HydCyl_PistonRod' || name === 'Punch_Tip' || name === 'Comp_PunchAssembly') {
            manualPressStartRef.current = performance.now();
          }

          cur.matrixAutoUpdate = true;
          let p = cur.parent;
          while (p) {
            p.matrixAutoUpdate = true;
            p = p.parent;
          }

          partRefs.current.set(name, cur);
          if (!originalTransforms.current.has(name)) {
            originalTransforms.current.set(name, {
              position: cur.position.clone(),
              quaternion: cur.quaternion.clone(),
            });
          }
          if (!originalWorldPositions.current.has(name)) {
            originalWorldPositions.current.set(name, cur.getWorldPosition(new THREE.Vector3()));
          }
          if (!partSizes.current.has(name)) {
            const pb = new THREE.Box3().setFromObject(cur);
            const ps = new THREE.Vector3();
            pb.getSize(ps);
            partSizes.current.set(name, ps);
          }
        }
      }

      onPartClickRef.current(name, info, ev.clientX, ev.clientY);
    };

    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('click', onPointerDown);

    const isAncestorOf = (ancestor: THREE.Object3D, node: THREE.Object3D) => {
      let p: THREE.Object3D | null = node.parent;
      while (p) {
        if (p === ancestor) return true;
        p = p.parent;
      }
      return false;
    };
    const pressGroupKeys = ['Comp_PunchAssembly', 'Punch_Body', 'Punch_Platen', 'Punch_Tip', 'HydCyl_PistonRod'] as const;

    let raf = 0;
    const animate = () => {
      raf = window.requestAnimationFrame(animate);

      const r = rendererRef.current;
      const s = sceneRef.current;
      const cam = cameraRef.current;
      const controlsNow = controlsRef.current;
      if (!r || !s || !cam || !controlsNow) return;

      controlsNow.update();

      if (!initialized.current) {
        r.render(s, cam);
        return;
      }

      const delta = playingRef.current ? clockRef.current.getDelta() * speedRef.current : 0;
      if (delta > 0) {
        const next = tRef.current + delta;
        if (next >= CYCLE_DURATION) {
          tRef.current = next % CYCLE_DURATION;
          beltTravelRef.current = 0;
          cycleIndexRef.current += 1;
          resetPartsToOriginal();
        } else {
          tRef.current = next;
        }
      }

      const t = tRef.current;
      const phase = getPhase(t, pressingTime);
      if (phase !== lastPhaseRef.current) {
        lastPhaseRef.current = phase;
        onPhaseChangeRef.current(phase);
      }
      onProgressRef.current(t / CYCLE_DURATION);

      const alpha = expAlpha(delta, 10);
      const alphaPress = expAlpha(delta, 18);

      const rotor = partRefs.current.get('Comp_MixerRotor');
      if (rotor) rotor.rotation.y += delta * 2;

      // Hopper Fiber Addition Animation
      if (hopperUpperRef.current) {
        const hTop = hopperTopPosRef.current.y;
        const hBottom = hopperPosRef.current.y;
        const hRange = hTop - hBottom;
        const hopperActive = t < 5; // Active during feeding and filling
        const fiberCountToLoop = 80; // Match the new hopperFiberCount
        
        for (let i = 0; i < fiberCountToLoop; i++) {
          if (!hopperActive) {
            tmpM4.makeScale(0, 0, 0);
            hopperFiberMesh.setMatrixAt(i, tmpM4);
            continue;
          }
          
          const offset = (i / fiberCountToLoop) * 2;
          const progress = ((t * 1.5 + offset) % 1.0);
          const y = hTop - progress * hRange;
          
          // Add some jitter/spiral effect
          const angle = i * 0.5 + t * 2;
          const r = 0.25 * (1 - progress * 0.4); // Increased spiral radius
          const x = hopperTopPosRef.current.x + Math.cos(angle) * r;
          const z = hopperTopPosRef.current.z + Math.sin(angle) * r;
          
          tmpV1.set(x, y, z);
          const s = 1.0 + Math.sin(i + t) * 0.4; // Larger scale factor for hopper fibers
          tmpM4.makeTranslation(tmpV1.x, tmpV1.y, tmpV1.z);
          tmpM4.multiply(tmpM4_2.makeScale(s, s, s));
          hopperFiberMesh.setMatrixAt(i, tmpM4);
        }
        hopperFiberMesh.instanceMatrix.needsUpdate = true;
        hopperFiberMesh.visible = hopperActive;
      } else {
        hopperFiberMesh.visible = false;
      }

      const roller = partRefs.current.get('Comp_DriveRoller');
      if (roller) roller.rotation.x += delta * 4;

      const belt = partRefs.current.get('Comp_ConvBelt');
      const origBelt = originalTransforms.current.get('Comp_ConvBelt')?.position;
      if (belt && origBelt) {
        beltTravelRef.current += delta * (modelRadiusRef.current * 0.2);
        const travelRange = modelRadiusRef.current * 0.25;
        const wrapped = (beltTravelRef.current % travelRange) - travelRange / 2;
        const dir = getMotionDirLocal('Comp_ConvBelt') ?? tmpV3.set(1, 0, 0);
        tmpV1.copy(origBelt).addScaledVector(dir, wrapped);
        belt.position.lerp(tmpV1, alpha);
      }

      const mixerGate = partRefs.current.get('Comp_MixerGate');
      const mixerGateHandle = partRefs.current.get('Mixer_GateHandle');
      const origMixerGate = originalTransforms.current.get('Comp_MixerGate');
      
      if (mixerGate && origMixerGate) {
        const openAmount = pulse(t, 2, 3, 5, 6);
        const openAngle = Math.PI / 3;
        tmpQuat.setFromAxisAngle(tmpAxis, openAmount * openAngle);
        tmpQuat2.copy(origMixerGate.quaternion).multiply(tmpQuat);
        mixerGate.quaternion.slerp(tmpQuat2, alpha);
        
        // Handle is now a child of the gate, so it will move with it automatically.
        // We only need to ensure it maintains its relative position.
      }

      const pasoA = partRefs.current.get('Comp_PasoA');
      const origPasoA = originalTransforms.current.get('Comp_PasoA')?.position;
      if (pasoA && origPasoA) {
        const openAmount = pulse(t, 3, 3.5, 4.5, 5);
        const slide = Math.max(getPartMagnitude('Comp_PasoA') * 0.6, modelRadiusRef.current * 0.08);
        const dir = getMotionDirLocal('Comp_PasoA') ?? tmpV3.set(1, 0, 0);
        tmpV1.copy(origPasoA).addScaledVector(dir, openAmount * slide);
        pasoA.position.lerp(tmpV1, alpha);
      }

      let pressAmount = 0;
      if (t < 6) pressAmount = 0;
      else if (t < 8) pressAmount = ramp(t, 6, 8);
      else if (t < 10) pressAmount = 1;
      else if (t < 11) pressAmount = 1 - ramp(t, 10, 11);
      else pressAmount = 0;

      const manualStart = manualPressStartRef.current;
      if (manualStart !== null) {
        const u = (performance.now() - manualStart) / manualPressDurationRef.current;
        if (u >= 1) {
          manualPressStartRef.current = null;
        } else if (u >= 0) {
          const m = Math.sin(Math.PI * u);
          pressAmount = Math.max(pressAmount, m);
        }
      }

      const applyPressTo = (key: string, baseStroke: number) => {
        const obj = partRefs.current.get(key);
        const orig = originalTransforms.current.get(key)?.position;
        if (!obj || !orig) return;
        
        // Force auto-update and ensure visibility
        obj.matrixAutoUpdate = true;
        obj.visible = true;

        const stroke =
          pressStrokeWorldRef.current ?? Math.max(getPartMagnitude(key) * baseStroke, modelRadiusRef.current * 0.35);
        
        const origWorld = originalWorldPositions.current.get(key);
        if (origWorld) {
          // Direct world position target
          tmpV1.copy(origWorld).addScaledVector(tmpV3.set(0, -1, 0), pressAmount * stroke);
          
          if (obj.parent) {
            obj.parent.updateMatrixWorld(true);
            const localTarget = obj.parent.worldToLocal(tmpV1.clone());
            obj.position.copy(localTarget); // Use direct copy instead of lerp for debugging "stuck"
          } else {
            obj.position.copy(tmpV1);
          }
        } else {
          const dir = getMotionDirLocal(key) ?? tmpV3.set(0, -1, 0);
          tmpV1.copy(orig).addScaledVector(dir, pressAmount * stroke);
          obj.position.copy(tmpV1);
        }
        
        obj.updateMatrix();
        obj.updateMatrixWorld(true);
      };

        // Moving all press parts. We use world-space calculations in applyPressTo
        // to ensure that even if they are magulang-at-anak (hierarchy), they move correctly.
        for (const k of pressGroupKeys) {
          applyPressTo(k, 0.7);
        }

      const tipNow = partRefs.current.get('Punch_Tip');
      const pressTarget = moldInnerCavityObj ?? moldTopRingObj;
      if (tipNow && pressTarget && pressAmount > 0) {
        const snap = THREE.MathUtils.smoothstep(pressAmount, 0.82, 1);
        if (snap > 0) {
          tmpBoxA.setFromObject(tipNow);
          const targetY = pressTargetWorldYRef.current;
           const gapY = tmpBoxA.min.y - targetY;
           // Use the same negative gap here to force the snap logic to "over-press"
           const targetGap = -Math.max(0.04, modelRadiusRef.current * 0.012);
           const err = gapY - targetGap;
          const maxStep = modelRadiusRef.current * 0.02;
          const deltaYWorld = -THREE.MathUtils.clamp(err, -maxStep, maxStep) * snap;
          const alphaSnap = expAlpha(delta, 45);

          const pressNodes = pressGroupKeys
            .map((k) => partRefs.current.get(k))
            .filter((x): x is THREE.Object3D => !!x);
          const moveNodes = pressNodes.filter((n) => !pressNodes.some((other) => other !== n && isAncestorOf(other, n)));

          for (const obj of moveNodes) {
            obj.getWorldPosition(tmpV1);
            tmpV1.y += deltaYWorld;
            if (obj.parent) {
              obj.parent.updateMatrixWorld(true);
              tmpV2.copy(tmpV1);
              const localTarget = obj.parent.worldToLocal(tmpV2);
              obj.position.lerp(localTarget, alphaSnap);
            } else {
              obj.position.y = THREE.MathUtils.lerp(obj.position.y, tmpV1.y, alphaSnap);
            }
            obj.updateMatrix();
            obj.updateMatrixWorld(true);
          }
        }
      }

      if (tipNow && pressTarget && pressAmount > 0.15) {
        tmpBoxA.setFromObject(tipNow);
        const targetY = pressTargetWorldYRef.current;
        const gapY = tmpBoxA.min.y - targetY;
        const eps = modelRadiusRef.current * 0.0005;
        const fillH = Math.max(0, gapY - eps);
        if (fillH > eps * 0.5) {
          const tipSize = tmpBoxA.getSize(tmpV1);
          const r = Math.max(0.001, tipSize.x * 0.28);

          const cx = (tmpBoxA.min.x + tmpBoxA.max.x) * 0.5;
          const cz = (tmpBoxA.min.z + tmpBoxA.max.z) * 0.5;
          const y0 = targetY + fillH / 2;

          pressGapFillMesh.visible = true;
          pressGapFillMesh.position.set(cx, y0, cz);
          pressGapFillMesh.scale.set(r, fillH, r);
          pressGapFillMat.opacity = THREE.MathUtils.clamp((pressAmount - 0.15) / 0.25, 0, 1);
          pressGapFillMesh.updateMatrix();
          pressGapFillMesh.updateMatrixWorld(true);
        } else {
          pressGapFillMesh.visible = false;
          pressGapFillMat.opacity = 0;
        }
      } else {
        pressGapFillMesh.visible = false;
        pressGapFillMat.opacity = 0;
      }

      const ejector = partRefs.current.get('Comp_EjectorRod');
      const origEjector = originalTransforms.current.get('Comp_EjectorRod')?.position;
      if (ejector && origEjector) {
        let ejectAmount = 0;
        if (t < 11) ejectAmount = 0;
        else if (t < 12) ejectAmount = ramp(t, 11, 12);
        else if (t < 13) ejectAmount = 1;
        else if (t < 14) ejectAmount = 1 - ramp(t, 13, 14);
        else ejectAmount = 0;

        const stroke = Math.max(getPartMagnitude('Comp_EjectorRod') * 0.7, modelRadiusRef.current * 0.12);
        const dir = getMotionDirLocal('Comp_EjectorRod') ?? tmpV3.set(0, 1, 0);
        tmpV1.copy(origEjector).addScaledVector(dir, ejectAmount * stroke);
        ejector.position.lerp(tmpV1, alpha);
      }

      const pasoB = partRefs.current.get('Comp_PasoB');
      const origPasoB = originalTransforms.current.get('Comp_PasoB')?.position;
      if (pasoB && origPasoB) {
        const openAmount = pulse(t, 12, 12.5, 13, 13.5);
        const slide = Math.max(getPartMagnitude('Comp_PasoB') * 0.6, modelRadiusRef.current * 0.08);
        const dir = getMotionDirLocal('Comp_PasoB') ?? tmpV3.set(1, 0, 0);
        tmpV1.copy(origPasoB).addScaledVector(dir, openAmount * slide);
        pasoB.position.lerp(tmpV1, alpha);
      }

      if (fiberCurve) {
        const filling = t >= 3 && t < 5;
        const feeding = t >= 0 && t < 6;
        const discharge = t >= 2 && t < 3;

        const flow = filling ? 1 : discharge ? 0.7 : feeding ? 0.35 : 0.1;
        const base = (t / CYCLE_DURATION) * 2.2;

        for (let i = 0; i < fiberCount; i++) {
          const seed = fiberSeeds[i];
          const u = (base * seed.speed + seed.offset) % 1;
          const u2 = THREE.MathUtils.clamp(u + (1 - flow) * 0.35, 0, 1);
          const p = fiberCurve.getPointAt(u2, tmpPos);
          fiberCurve.getTangentAt(u2, tmpDir);

          const wobble = Math.sin(seed.phase + t * 8) * seed.radius;
          const wobble2 = Math.cos(seed.phase * 1.3 + t * 7) * seed.radius;
          tmpPos2.copy(p).addScaledVector(tmpUp, wobble).addScaledVector(tmpDir, wobble2);

          tmpQuatLocal.setFromUnitVectors(tmpUp, tmpDir.clone().normalize().addScaledVector(tmpUp, 0.25).normalize());
          tmpScale.setScalar(0.7 + flow * 0.8);

          tmpMat4.compose(tmpPos2, tmpQuatLocal, tmpScale);
          fiberMesh.setMatrixAt(i, tmpMat4);
        }
        fiberMesh.instanceMatrix.needsUpdate = true;
      }

      const potVisible = t >= 11 && t < 15;
      potMesh.visible = potVisible;
      if (potVisible) {
        const toBelt = THREE.MathUtils.smoothstep(t, 11, 12);
        const travel = THREE.MathUtils.smoothstep(t, 12, 14);
        const toTray = THREE.MathUtils.smoothstep(t, 14, 14.3);
        const drop = THREE.MathUtils.smoothstep(t, 14.3, 15);

        const hasTray = !!potBinBoxRef.current;
        if (hasTray) {
          const trayBox = potBinBoxRef.current!;
          const bc = new THREE.Vector3();
          trayBox.getCenter(bc);
          const potHeight = 0.35;
          const clearance = Math.max(0.01, modelRadiusRef.current * 0.005);
          potDropAbovePos.set(bc.x, trayBox.max.y + potHeight / 2 + clearance, bc.z);
          potDropInsidePos.set(bc.x, trayBox.min.y + potHeight / 2 + clearance * 2, bc.z);
        }

        if (t < 12) {
          const travelY = Math.max(potMoldExitPos.y, potStart.y) + Math.max(0.02, modelRadiusRef.current * 0.01);
          tmpV1.set(potMoldExitPos.x, travelY, potMoldExitPos.z);
          tmpV2.set(potStart.x, travelY, potStart.z);
          potMesh.position.lerpVectors(tmpV1, tmpV2, toBelt);
        } else if (t < 14) {
          if (potConveyorCurve) {
            const p = potConveyorCurve.getPointAt(travel, tmpV1);
            potMesh.position.lerp(p, alpha);
          } else {
            potMesh.position.lerpVectors(potStart, potEnd, travel);
          }
        } else {
          if (potBinBoxRef.current) {
            tmpV1.copy(potEnd).lerp(potDropAbovePos, toTray);
            potMesh.position.lerpVectors(tmpV1, potDropInsidePos, drop);
          } else {
            potMesh.position.lerpVectors(potEnd, potEnd, 1);
          }
        }

        const h = THREE.MathUtils.lerp(0.42, 0.28, pressAmount);
        potMesh.scale.set(1, h / 0.35, 1);
        tmpQuat.setFromEuler(new THREE.Euler(0, 0, 0));
        potMesh.quaternion.slerp(tmpQuat, alpha);
      }

      const bin = potBinRef.current;
      const binBox = potBinBoxRef.current;
      if (bin && binBox) {
        const count = potInBinCountRef.current;
        const max = potBinMax;
        const showCount = Math.min(count, max);
        const bb = binBox;
        const width = Math.max(0.001, bb.max.x - bb.min.x);
        const depth = Math.max(0.001, bb.max.z - bb.min.z);
        const baseY = bb.min.y + Math.max(0.03, (bb.max.y - bb.min.y) * 0.18);
        for (let i = 0; i < potBinMax; i++) {
          if (i >= showCount) {
            tmpMat4.identity();
            potBinMesh.setMatrixAt(i, tmpMat4);
            continue;
          }
          const col = i % 4;
          const row = Math.floor(i / 4);
          const x = THREE.MathUtils.lerp(bb.min.x + width * 0.25, bb.max.x - width * 0.25, (col + 0.5) / 4);
          const z = THREE.MathUtils.lerp(bb.min.z + depth * 0.25, bb.max.z - depth * 0.25, (row + 0.5) / 4);
          const y = baseY + row * 0.06;
          tmpPos.set(x, y, z);
          tmpQuatLocal.setFromEuler(new THREE.Euler(0, 0, 0));
          tmpScale.set(1, 1, 1);
          tmpMat4.compose(tmpPos, tmpQuatLocal, tmpScale);
          potBinMesh.setMatrixAt(i, tmpMat4);
        }
        potBinMesh.instanceMatrix.needsUpdate = true;

        if (t >= 14.7 && potDropRecordedCycleRef.current !== cycleIndexRef.current) {
          potDropRecordedCycleRef.current = cycleIndexRef.current;
          potInBinCountRef.current = Math.min(potInBinCountRef.current + 1, potBinMax);
        }
      } else {
        potBinMesh.visible = false;
      }

      r.render(s, cam);
    };

    animate();

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onPointerDown);
      window.cancelAnimationFrame(raf);

      controls.dispose();
      pmrem.dispose();

      renderer.dispose();
      if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      modelRef.current = null;

      scene.remove(fxGroup);
      fiberGeom.dispose();
      fiberMat.dispose();
      potGeom.dispose();
      potMat.dispose();
      pressGapFillGeom.dispose();
      pressGapFillMat.dispose();

      initialized.current = false;
      originalTransforms.current.clear();
      partSizes.current.clear();
      partRefs.current.clear();
      originalWorldPositions.current.clear();
    };
  }, [mouseNdc, raycaster, tmpAxis, tmpQuat, tmpQuat2, tmpV1, tmpV2, tmpV3]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="absolute inset-0" />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" />
            <p className="text-gray-400 text-sm font-medium tracking-wide font-mono">
              Loading Machine Model...
            </p>
          </div>
        </div>
      ) : null}
      {!loading && loadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]">
          <div className="max-w-lg px-6 py-5 rounded-xl border border-red-500/30 bg-red-500/5 text-red-200 font-mono">
            <div className="text-sm font-semibold mb-2">Model load failed</div>
            <div className="text-xs text-red-200/80 break-words">{loadError}</div>
            <div className="mt-3 text-[11px] text-red-200/70 break-words">{MODEL_URL}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
