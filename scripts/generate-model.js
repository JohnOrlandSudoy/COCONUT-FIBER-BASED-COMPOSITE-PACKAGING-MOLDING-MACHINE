#!/usr/bin/env node

/**
 * generate-model.js
 *
 * Generates a GLB file containing a 3D model of a
 * "Coconut Fiber Composite Packaging Molding Machine"
 * using @gltf-transform/core to build the glTF document programmatically.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// 1. Install dependencies (gltf-transform core packages)
// ---------------------------------------------------------------------------
const npmPrefix = path.join(__dirname);
const pkgPath = path.join(npmPrefix, 'package.json');

// We install into the scripts dir so we don't pollute the main project
if (!fs.existsSync(pkgPath)) {
  fs.writeFileSync(pkgPath, JSON.stringify({ name: 'generate-model-deps', private: true }, null, 2));
}

function ensurePkg(name) {
  try {
    require.resolve(name, { paths: [npmPrefix] });
  } catch {
    console.log(`Installing ${name}...`);
    execSync(`npm install ${name}`, { cwd: npmPrefix, stdio: 'inherit' });
  }
}

ensurePkg('@gltf-transform/core');
ensurePkg('@gltf-transform/extensions');

const { Document, NodeIO, Scene, Node, Mesh, Primitive, Material, Accessor } = require('@gltf-transform/core');
const { MeshoptCompression } = require('@gltf-transform/extensions');

// ---------------------------------------------------------------------------
// 2. Helper: create typed arrays for box / cylinder geometry
// ---------------------------------------------------------------------------

/**
 * Create a unit box (centered at origin) with positions, normals, and indices.
 * Size: 1x1x1, will be scaled via node transform.
 */
function createBoxGeometry() {
  // 8 vertices - each face gets its own vertices for proper normals
  const positions = new Float32Array([
    // Front face (+Z)
    -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
    // Back face (-Z)
    -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,   0.5, -0.5, -0.5,
    // Top face (+Y)
    -0.5,  0.5, -0.5,  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
    // Bottom face (-Y)
    -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
    // Right face (+X)
     0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,   0.5, -0.5,  0.5,
    // Left face (-X)
    -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
  ]);

  const normals = new Float32Array([
    // Front
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    // Back
    0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
    // Top
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    // Bottom
    0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
    // Right
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    // Left
   -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);

  const indices = new Uint16Array([
    0,  1,  2,   0,  2,  3,   // front
    4,  5,  6,   4,  6,  7,   // back
    8,  9, 10,   8, 10, 11,   // top
   12, 13, 14,  12, 14, 15,   // bottom
   16, 17, 18,  16, 18, 19,   // right
   20, 21, 22,  20, 22, 23,   // left
  ]);

  return { positions, normals, indices };
}

/**
 * Create a cylinder geometry aligned along the Y axis.
 * @param {number} radiusTop
 * @param {number} radiusBottom
 * @param {number} height
 * @param {number} segments - radial segments
 */
function createCylinderGeometry(radiusTop = 0.5, radiusBottom = 0.5, height = 1, segments = 16) {
  const halfH = height / 2;
  const vertices = [];
  const norms = [];
  const idxs = [];

  // Side vertices
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    // Top ring
    vertices.push(radiusTop * cosT, halfH, radiusTop * sinT);
    norms.push(cosT, 0, sinT);
    // Bottom ring
    vertices.push(radiusBottom * cosT, -halfH, radiusBottom * sinT);
    norms.push(cosT, 0, sinT);
  }

  // Side indices
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    idxs.push(a, c, b);
    idxs.push(b, c, d);
  }

  // Top cap
  const topCenterIdx = vertices.length / 3;
  vertices.push(0, halfH, 0);
  norms.push(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(radiusTop * Math.cos(theta), halfH, radiusTop * Math.sin(theta));
    norms.push(0, 1, 0);
  }
  for (let i = 0; i < segments; i++) {
    const a = topCenterIdx + 1 + i;
    const b = topCenterIdx + 1 + ((i + 1) % (segments + 1));
    idxs.push(topCenterIdx, a, b);
  }

  // Bottom cap
  const botCenterIdx = vertices.length / 3;
  vertices.push(0, -halfH, 0);
  norms.push(0, -1, 0);
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    vertices.push(radiusBottom * Math.cos(theta), -halfH, radiusBottom * Math.sin(theta));
    norms.push(0, -1, 0);
  }
  for (let i = 0; i < segments; i++) {
    const a = botCenterIdx + 1 + i;
    const b = botCenterIdx + 1 + ((i + 1) % (segments + 1));
    idxs.push(botCenterIdx, b, a);
  }

  return {
    positions: new Float32Array(vertices),
    normals: new Float32Array(norms),
    indices: new Uint16Array(idxs),
  };
}

// ---------------------------------------------------------------------------
// 3. Build the glTF Document
// ---------------------------------------------------------------------------

async function main() {
  const doc = new Document();

  // --- Materials with distinct colors ---
  function makeMaterial(name, baseColor, metallic = 0.3, roughness = 0.6) {
    const mat = doc.createMaterial(name);
    mat.setBaseColorFactor(baseColor);
    mat.setMetallicFactor(metallic);
    setRoughnessFactor(mat, roughness);
    return mat;
  }

  // gltf-transform core doesn't have a direct setRoughnessFactor on Material
  // in all versions; we use the extension-agnostic approach:
  function setRoughnessFactor(mat, val) {
    // Try the direct method first
    if (typeof mat.setRoughnessFactor === 'function') {
      mat.setRoughnessFactor(val);
    }
  }

  const matSteel      = makeMaterial('matSteel',     [0.6, 0.63, 0.68, 1]);
  const matDarkSteel  = makeMaterial('matDarkSteel', [0.35, 0.38, 0.42, 1]);
  const matRotor      = makeMaterial('matRotor',     [0.85, 0.35, 0.15, 1]);  // orange
  const matBelt       = makeMaterial('matBelt',      [0.2, 0.2, 0.22, 1]);    // dark gray
  const matRoller     = makeMaterial('matRoller',    [0.7, 0.72, 0.75, 1]);   // light steel
  const matGateA      = makeMaterial('matGateA',     [0.2, 0.55, 0.85, 1]);   // blue
  const matPunch      = makeMaterial('matPunch',     [0.85, 0.65, 0.1, 1]);   // gold/yellow
  const matHyd        = makeMaterial('matHyd',        [0.55, 0.15, 0.15, 1]);  // red
  const matEjector    = makeMaterial('matEjector',   [0.7, 0.4, 0.7, 1]);    // purple
  const matGateB      = makeMaterial('matGateB',     [0.2, 0.75, 0.45, 1]);   // green
  const matMixerGate  = makeMaterial('matMixerGate', [0.9, 0.5, 0.2, 1]);     // amber
  const matFrame      = makeMaterial('matFrame',     [0.25, 0.28, 0.32, 1]);  // dark metal
  const matMold       = makeMaterial('matMold',      [0.5, 0.52, 0.55, 1]);   // medium steel
  const matHousing    = makeMaterial('matHousing',   [0.45, 0.5, 0.55, 1]);   // blue-gray

  // Single shared buffer for the entire GLB (GLB spec requires 0-1 buffers)
  const sharedBuffer = doc.createBuffer('shared_buffer');

  // --- Helper: create a mesh from geometry data ---
  function makeMesh(name, geom, material) {
    const posAcc = doc.createAccessor(name + '_pos')
      .setArray(geom.positions)
      .setType(Accessor.Type.VEC3)
      .setBuffer(sharedBuffer);

    const normAcc = doc.createAccessor(name + '_norm')
      .setArray(geom.normals)
      .setType(Accessor.Type.VEC3)
      .setBuffer(sharedBuffer);

    const idxAcc = doc.createAccessor(name + '_idx')
      .setArray(geom.indices)
      .setType(Accessor.Type.SCALAR)
      .setBuffer(sharedBuffer);

    const prim = doc.createPrimitive()
      .setAttribute('POSITION', posAcc)
      .setAttribute('NORMAL', normAcc)
      .setIndices(idxAcc)
      .setMaterial(material);

    const mesh = doc.createMesh(name)
      .addPrimitive(prim);

    return mesh;
  }

  // --- Helper: create a node with translation, rotation, scale ---
  function makeNode(name, mesh, translation, scale, rotationEuler) {
    const node = doc.createNode(name)
      .setMesh(mesh)
      .setTranslation(translation || [0, 0, 0])
      .setScale(scale || [1, 1, 1]);

    if (rotationEuler) {
      // Convert euler (radians) to quaternion
      const [rx, ry, rz] = rotationEuler;
      // ZYX order intrinsic = xyz extrinsic
      const cy = Math.cos(rz / 2), sy = Math.sin(rz / 2);
      const cp = Math.cos(ry / 2), sp = Math.sin(ry / 2);
      const cr = Math.cos(rx / 2), sr = Math.sin(rx / 2);
      const qw = cr * cp * cy + sr * sp * sy;
      const qx = sr * cp * cy - cr * sp * sy;
      const qy = cr * sp * cy + sr * cp * sy;
      const qz = cr * cp * sy - sr * sp * cy;
      node.setRotation([qx, qy, qz, qw]);
    }
    return node;
  }

  // ========================================================================
  // MACHINE PARTS
  // ========================================================================

  // 1. Comp_MixerRotor - horizontal cylinder inside mixer
  //    Default cylinder is along Y; rotate 90 deg around Z to make it horizontal (along X)
  const mixerRotorGeom = createCylinderGeometry(0.35, 0.35, 2.5, 16);
  const mixerRotorMesh = makeMesh('MixerRotor_mesh', mixerRotorGeom, matRotor);
  const mixerRotorNode = makeNode('Comp_MixerRotor', mixerRotorMesh,
    [-3, 3, 0],           // position: upper-left
    [1, 1, 1],            // scale
    [0, 0, Math.PI / 2]   // rotate 90 deg around Z => horizontal along X
  );

  // 2. Comp_ConvBelt - flat box (conveyor belt surface)
  const convBeltGeom = createBoxGeometry();
  const convBeltMesh = makeMesh('ConvBelt_mesh', convBeltGeom, matBelt);
  const convBeltNode = makeNode('Comp_ConvBelt', convBeltMesh,
    [3, -1, 0],             // position: bottom-right
    [4, 0.15, 1.2]          // scale: wide flat surface
  );

  // 3. Comp_DriveRoller - small cylinder at end of conveyor belt
  const driveRollerGeom = createCylinderGeometry(0.3, 0.3, 1.2, 12);
  const driveRollerMesh = makeMesh('DriveRoller_mesh', driveRollerGeom, matRoller);
  const driveRollerNode = makeNode('Comp_DriveRoller', driveRollerMesh,
    [5, -1, 0],             // position: end of conveyor
    [1, 1, 1],              // scale
    [0, 0, Math.PI / 2]    // horizontal
  );

  // 4. Comp_PasoA - flat box (gate/door) on left side of mold area
  const pasoAGeom = createBoxGeometry();
  const pasoAMesh = makeMesh('PasoA_mesh', pasoAGeom, matGateA);
  const pasoANode = makeNode('Comp_PasoA', pasoAMesh,
    [-1.5, 0, 0],           // position: left of mold
    [0.1, 1.5, 1.2]         // scale: thin flat panel
  );

  // 5. Comp_PunchAssembly - tall box (punch) above mold, moves vertically
  const punchGeom = createBoxGeometry();
  const punchMesh = makeMesh('Punch_mesh', punchGeom, matPunch);
  const punchNode = makeNode('Comp_PunchAssembly', punchMesh,
    [0, 3, 0],              // position: above mold
    [1.2, 1.5, 1.2]         // scale: tall block
  );

  // 6. HydCyl_Barrel - cylinder (hydraulic barrel) above punch
  const hydBarrelGeom = createCylinderGeometry(0.4, 0.4, 2, 12);
  const hydBarrelMesh = makeMesh('HydBarrel_mesh', hydBarrelGeom, matHyd);
  const hydBarrelNode = makeNode('HydCyl_Barrel', hydBarrelMesh,
    [0, 5, 0],              // position: above punch
    [1, 1, 1],              // scale
    [0, 0, 0]               // vertical
  );

  // 7. Comp_EjectorRod - thin cylinder below mold
  const ejectorGeom = createCylinderGeometry(0.08, 0.08, 1.5, 8);
  const ejectorMesh = makeMesh('Ejector_mesh', ejectorGeom, matEjector);
  const ejectorNode = makeNode('Comp_EjectorRod', ejectorMesh,
    [0, -2, 0],             // position: below mold
    [1, 1, 1],              // scale
    [0, 0, 0]               // vertical
  );

  // 8. Comp_PasoB - flat box (gate) on right side of mold area
  const pasoBGeom = createBoxGeometry();
  const pasoBMesh = makeMesh('PasoB_mesh', pasoBGeom, matGateB);
  const pasoBNode = makeNode('Comp_PasoB', pasoBMesh,
    [1.5, 0, 0],            // position: right of mold
    [0.1, 1.5, 1.2]         // scale: thin flat panel
  );

  // 9. Comp_MixerGate - flat box (gate) at bottom of mixer
  const mixerGateGeom = createBoxGeometry();
  const mixerGateMesh = makeMesh('MixerGate_mesh', mixerGateGeom, matMixerGate);
  const mixerGateNode = makeNode('Comp_MixerGate', mixerGateMesh,
    [-3, 1.5, 0],           // position: bottom of mixer
    [1.5, 0.1, 1.2]         // scale: flat panel
  );

  // ========================================================================
  // STATIC STRUCTURAL PARTS
  // ========================================================================

  // Frame - scaffolding/base
  const frameGeom = createBoxGeometry();
  const frameMesh = makeMesh('Frame_mesh', frameGeom, matFrame);
  const frameNode = makeNode('Frame', frameMesh,
    [1, -2.5, 0],            // position: base
    [10, 0.3, 2]             // scale: wide base plate
  );

  // Frame vertical supports (left)
  const frameLeftGeom = createBoxGeometry();
  const frameLeftMesh = makeMesh('FrameLeft_mesh', frameLeftGeom, matFrame);
  const frameLeftNode = makeNode('FrameLeft', frameLeftMesh,
    [-4.5, 2, 0],
    [0.3, 5, 0.3]
  );

  // Frame vertical supports (right)
  const frameRightGeom = createBoxGeometry();
  const frameRightMesh = makeMesh('FrameRight_mesh', frameRightGeom, matFrame);
  const frameRightNode = makeNode('FrameRight', frameRightMesh,
    [6, 2, 0],
    [0.3, 5, 0.3]
  );

  // Frame top beam
  const frameTopGeom = createBoxGeometry();
  const frameTopMesh = makeMesh('FrameTop_mesh', frameTopGeom, matFrame);
  const frameTopNode = makeNode('FrameTop', frameTopMesh,
    [1, 5.5, 0],
    [11, 0.3, 0.3]
  );

  // MoldCavity - the mold itself
  const moldGeom = createBoxGeometry();
  const moldMesh = makeMesh('Mold_mesh', moldGeom, matMold);
  const moldNode = makeNode('MoldCavity', moldMesh,
    [0, 0.5, 0],             // position: center mold area
    [1.5, 1, 1.2]             // scale: mold block
  );

  // MixerHousing - the mixer container
  const housingGeom = createCylinderGeometry(1.2, 1.2, 2.5, 16);
  const housingMesh = makeMesh('Housing_mesh', housingGeom, matHousing);
  const housingNode = makeNode('MixerHousing', housingMesh,
    [-3, 3, 0],               // position: upper-left
    [1, 1, 1],                // scale
    [0, 0, 0]                 // vertical
  );

  // Conveyor support legs
  const convLegGeom = createBoxGeometry();
  const convLegMesh = makeMesh('ConvLeg_mesh', convLegGeom, matDarkSteel);
  const convLegNode = makeNode('ConvLegLeft', convLegMesh,
    [2, -1.8, 0],
    [0.2, 1.2, 0.2]
  );

  const convLegRMesh = makeMesh('ConvLegR_mesh', createBoxGeometry(), matDarkSteel);
  const convLegRNode = makeNode('ConvLegRight', convLegRMesh,
    [4, -1.8, 0],
    [0.2, 1.2, 0.2]
  );

  // Hydraulic mount plate
  const hydPlateGeom = createBoxGeometry();
  const hydPlateMesh = makeMesh('HydPlate_mesh', hydPlateGeom, matDarkSteel);
  const hydPlateNode = makeNode('HydMountPlate', hydPlateMesh,
    [0, 4.2, 0],
    [1.5, 0.2, 1.5]
  );

  // Guide rods for punch (two thin cylinders)
  const guideRodGeom = createCylinderGeometry(0.06, 0.06, 2.5, 8);
  const guideRodMesh = makeMesh('GuideRod_mesh', guideRodGeom, matSteel);
  const guideRodLNode = makeNode('GuideRodLeft', guideRodMesh,
    [-0.6, 3.5, 0],
    [1, 1, 1],
    [0, 0, 0]
  );
  const guideRodRMesh = makeMesh('GuideRodR_mesh', createCylinderGeometry(0.06, 0.06, 2.5, 8), matSteel);
  const guideRodRNode = makeNode('GuideRodRight', guideRodRMesh,
    [0.6, 3.5, 0],
    [1, 1, 1],
    [0, 0, 0]
  );

  // Hopper above mixer (cone shape approximated with cylinder)
  const hopperGeom = createCylinderGeometry(0.4, 0.9, 0.8, 12);
  const hopperMesh = makeMesh('Hopper_mesh', hopperGeom, matHousing);
  const hopperNode = makeNode('Hopper', hopperMesh,
    [-3, 4.8, 0],
    [1, 1, 1],
    [0, 0, 0]
  );

  // Transfer chute from mixer to mold
  const chuteGeom = createBoxGeometry();
  const chuteMesh = makeMesh('Chute_mesh', chuteGeom, matDarkSteel);
  const chuteNode = makeNode('TransferChute', chuteMesh,
    [-1.8, 1.5, 0],
    [1.5, 0.15, 0.8]
  );

  // ========================================================================
  // ASSEMBLE SCENE
  // ========================================================================

  const scene = doc.createScene('MoldingMachineScene');

  // Add all named component nodes
  scene.addChild(mixerRotorNode);
  scene.addChild(convBeltNode);
  scene.addChild(driveRollerNode);
  scene.addChild(pasoANode);
  scene.addChild(punchNode);
  scene.addChild(hydBarrelNode);
  scene.addChild(ejectorNode);
  scene.addChild(pasoBNode);
  scene.addChild(mixerGateNode);

  // Add structural nodes
  scene.addChild(frameNode);
  scene.addChild(frameLeftNode);
  scene.addChild(frameRightNode);
  scene.addChild(frameTopNode);
  scene.addChild(moldNode);
  scene.addChild(housingNode);
  scene.addChild(convLegNode);
  scene.addChild(convLegRNode);
  scene.addChild(hydPlateNode);
  scene.addChild(guideRodLNode);
  scene.addChild(guideRodRNode);
  scene.addChild(hopperNode);
  scene.addChild(chuteNode);

  // ========================================================================
  // 4. Write GLB
  // ========================================================================

  const io = new NodeIO();
  const glbDir = path.resolve(__dirname, '..', 'public', 'models');
  fs.mkdirSync(glbDir, { recursive: true });

  const outPath = path.join(glbDir, 'molding-machine.glb');
  await io.write(outPath, doc);

  console.log(`GLB written to: ${outPath}`);
  const stats = fs.statSync(outPath);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);

  // Quick validation: read it back and verify nodes
  const doc2 = await io.read(outPath);
  const root2 = doc2.getRoot();
  const scenes = root2.listScenes();
  const allNodeNames = [];
  for (const sc of scenes) {
    for (const child of sc.listChildren()) {
      allNodeNames.push(child.getName());
    }
  }
  console.log(`Scene nodes (${allNodeNames.length}): ${allNodeNames.join(', ')}`);

  // Verify all required named parts exist
  const requiredParts = [
    'Comp_MixerRotor', 'Comp_ConvBelt', 'Comp_DriveRoller', 'Comp_PasoA',
    'Comp_PunchAssembly', 'HydCyl_Barrel', 'Comp_EjectorRod', 'Comp_PasoB',
    'Comp_MixerGate',
  ];
  let allFound = true;
  for (const part of requiredParts) {
    if (!allNodeNames.includes(part)) {
      console.error(`MISSING required part: ${part}`);
      allFound = false;
    }
  }
  if (allFound) {
    console.log('All 9 required named parts found in GLB.');
  }
}

main().catch(err => {
  console.error('Error generating GLB:', err);
  process.exit(1);
});
