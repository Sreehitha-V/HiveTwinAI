import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getPartTelemetry } from '../utils/simulationEngine';
import { Eye, Layers, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function HiveCanvas({ telemetry, status, preset, isExploded, onToggleExplode }) {
  const mountRef = useRef(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredPart, setHoveredPart] = useState(null);

  // References to keep 3D objects accessible across renders
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const partsGroupRef = useRef({});
  const mainChamberMatRef = useRef(null);
  const beesGroupRef = useRef(null);
  const heatLightRef = useRef(null);
  const co2HazeGroupRef = useRef(null);
  const animFrameRef = useRef(null);

  // Exploded animation state refs
  const explodedStateRef = useRef(isExploded);
  explodedStateRef.current = isExploded;

  // Preset & status refs
  const presetRef = useRef(preset);
  presetRef.current = preset;

  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. SCENE & CAMERA
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc); // Clean studio background
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(4.5, 2.8, 5.5);
    cameraRef.current = camera;

    // 2. RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Clear previous children if any
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. ORBIT CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3.0;
    controls.maxDistance = 11.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't go below ground
    controls.target.set(0, 0.3, 0);
    controlsRef.current = controls;

    // 4. LIGHTING SYSTEM
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
    dirLight.position.set(6, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.45);
    fillLight.position.set(-6, 4, -5);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xfef08a, 0.6, 10);
    rimLight.position.set(0, 4, -4);
    scene.add(rimLight);

    // Ground Shadow Receiver Plane
    const shadowPlaneGeo = new THREE.PlaneGeometry(15, 15);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.1;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Grid helper
    const grid = new THREE.GridHelper(10, 20, 0xcbd5e1, 0xe2e8f0);
    grid.position.y = -1.09;
    scene.add(grid);

    // 4B. SCENARIO VISUAL REACTION 3D OBJECTS
    // Heat Point Light inside chamber box for OVERHEAT reaction
    const heatLight = new THREE.PointLight(0xef4444, 0, 7);
    heatLight.position.set(0, 0.25, 0);
    scene.add(heatLight);
    heatLightRef.current = heatLight;

    // CO2 Gas Haze Cloud Group for CO2_SPIKE reaction
    const co2HazeGroup = new THREE.Group();
    const hazeParticleGeo = new THREE.TorusGeometry(0.35, 0.1, 8, 16);
    const hazeParticleMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0
    });
    
    for (let i = 0; i < 6; i++) {
      const hazeMesh = new THREE.Mesh(hazeParticleGeo, hazeParticleMat);
      hazeMesh.position.set(
        (Math.random() - 0.5) * 0.7,
        0.7 + i * 0.14,
        (Math.random() - 0.5) * 0.7
      );
      hazeMesh.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
      co2HazeGroup.add(hazeMesh);
    }
    scene.add(co2HazeGroup);
    co2HazeGroupRef.current = { group: co2HazeGroup, mat: hazeParticleMat };

    // 5. PROCEDURAL LANGSTROTH HIVE MODEL ASSEMBLY
    const partsGroup = {};

    // Standard Materials
    const woodBaseMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Cedar / Pine wood
      roughness: 0.6,
      metalness: 0.1
    });

    const roofMetalMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Galvanized aluminum cover
      roughness: 0.3,
      metalness: 0.8
    });

    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // Darker pine trim / rails
      roughness: 0.7
    });

    const waxCombMat = new THREE.MeshStandardMaterial({
      color: 0xfde047, // Honeycomb wax
      roughness: 0.4
    });

    const rampLedMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8 // Optical beam cyan
    });

    // --- PART 1: BOTTOM BOARD & NARROW ENTRANCE REDUCER ASSEMBLY ---
    const bottomGroup = new THREE.Group();
    bottomGroup.userData = { id: 'bottomBoard', name: 'Bottom Board & Narrow Entrance Reducer' };

    // 1A. Bottom Floor Board Base Slab
    const floorSlabGeo = new THREE.BoxGeometry(2.4, 0.14, 2.8);
    const floorSlabMesh = new THREE.Mesh(floorSlabGeo, darkWoodMat);
    floorSlabMesh.position.set(0, -0.62, 0.2);
    floorSlabMesh.castShadow = true;
    floorSlabMesh.receiveShadow = true;
    bottomGroup.add(floorSlabMesh);

    // 1B. Left & Right Side Rails
    const railWidth = 0.14, railHeight = 0.14, railDepth = 2.4;
    const railGeo = new THREE.BoxGeometry(railWidth, railHeight, railDepth);

    const leftRail = new THREE.Mesh(railGeo, woodBaseMat);
    leftRail.position.set(-1.2 + railWidth / 2, -0.48, 0);
    leftRail.castShadow = true;
    bottomGroup.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, woodBaseMat);
    rightRail.position.set(1.2 - railWidth / 2, -0.48, 0);
    rightRail.castShadow = true;
    bottomGroup.add(rightRail);

    // Back Rail
    const backRailGeo = new THREE.BoxGeometry(2.4 - railWidth * 2, railHeight, railWidth);
    const backRail = new THREE.Mesh(backRailGeo, woodBaseMat);
    backRail.position.set(0, -0.48, -1.2 + railWidth / 2);
    backRail.castShadow = true;
    bottomGroup.add(backRail);

    // 1C. NARROW ENTRANCE REDUCER CLEATS (Restricts front opening to a small centered slot)
    const entranceOpeningWidth = 0.6; // Narrow compact entrance slot
    const sideCleatWidth = (2.4 - railWidth * 2 - entranceOpeningWidth) / 2;

    const leftCleatGeo = new THREE.BoxGeometry(sideCleatWidth, railHeight, railWidth);
    const leftCleat = new THREE.Mesh(leftCleatGeo, darkWoodMat);
    leftCleat.position.set(-entranceOpeningWidth / 2 - sideCleatWidth / 2, -0.48, 1.2 - railWidth / 2);
    leftCleat.castShadow = true;
    bottomGroup.add(leftCleat);

    const rightCleatGeo = new THREE.BoxGeometry(sideCleatWidth, railHeight, railWidth);
    const rightCleat = new THREE.Mesh(rightCleatGeo, darkWoodMat);
    rightCleat.position.set(entranceOpeningWidth / 2 + sideCleatWidth / 2, -0.48, 1.2 - railWidth / 2);
    rightCleat.castShadow = true;
    bottomGroup.add(rightCleat);

    // 1D. Extended Landing Ramp at Floor Level (Sloped forward at the entrance)
    const landingRampGeo = new THREE.BoxGeometry(entranceOpeningWidth + 0.3, 0.08, 0.55);
    const landingRampMesh = new THREE.Mesh(landingRampGeo, woodBaseMat);
    landingRampMesh.position.set(0, -0.66, 1.55);
    landingRampMesh.rotation.x = 0.12;
    landingRampMesh.castShadow = true;
    bottomGroup.add(landingRampMesh);

    // 1E. Compact Entrance Optical IR Beam Sensor Strip
    const opticalStripGeo = new THREE.BoxGeometry(entranceOpeningWidth - 0.05, 0.03, 0.06);
    const opticalStripMesh = new THREE.Mesh(opticalStripGeo, rampLedMat);
    opticalStripMesh.position.set(0, -0.53, 1.21);
    bottomGroup.add(opticalStripMesh);

    scene.add(bottomGroup);
    partsGroup.bottomBoard = bottomGroup;

    // --- PART 2: MAIN LANGSTROTH CHAMBER BOX ---
    const chamberGroup = new THREE.Group();
    chamberGroup.userData = { id: 'chamberBox', name: 'Single Langstroth Wood Chamber' };

    // Main chamber box material (Dynamic status color tinted)
    const mainChamberMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(statusRef.current.color),
      roughness: 0.5,
      metalness: 0.1,
      emissive: new THREE.Color(statusRef.current.color),
      emissiveIntensity: 0.15
    });
    mainChamberMatRef.current = mainChamberMat;

    // Chamber outer hollow box wall assembly
    const boxWidth = 2.2, boxHeight = 1.3, boxDepth = 2.4, wallThick = 0.16;

    // Front & Back walls
    const fbGeo = new THREE.BoxGeometry(boxWidth, boxHeight, wallThick);
    const frontWall = new THREE.Mesh(fbGeo, mainChamberMat);
    frontWall.position.set(0, 0.24, boxDepth / 2 - wallThick / 2);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    chamberGroup.add(frontWall);

    const backWall = new THREE.Mesh(fbGeo, mainChamberMat);
    backWall.position.set(0, 0.24, -boxDepth / 2 + wallThick / 2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    chamberGroup.add(backWall);

    // Left & Right walls
    const lrGeo = new THREE.BoxGeometry(wallThick, boxHeight, boxDepth - wallThick * 2);
    const leftWall = new THREE.Mesh(lrGeo, mainChamberMat);
    leftWall.position.set(-boxWidth / 2 + wallThick / 2, 0.24, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    chamberGroup.add(leftWall);

    const rightWall = new THREE.Mesh(lrGeo, mainChamberMat);
    rightWall.position.set(boxWidth / 2 - wallThick / 2, 0.24, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    chamberGroup.add(rightWall);

    // Side Handle Hand-holds
    const handleGeo = new THREE.BoxGeometry(0.7, 0.1, 0.06);
    const handleLeft = new THREE.Mesh(handleGeo, darkWoodMat);
    handleLeft.position.set(-boxWidth / 2 - 0.02, 0.35, 0);
    chamberGroup.add(handleLeft);

    const handleRight = new THREE.Mesh(handleGeo, darkWoodMat);
    handleRight.position.set(boxWidth / 2 + 0.02, 0.35, 0);
    chamberGroup.add(handleRight);

    // Internal Hanging Frames (9 Frames inside)
    const framesGroup = new THREE.Group();
    framesGroup.userData = { id: 'frames', name: 'Internal Hanging Frames' };

    const frameCount = 9;
    const frameWidth = 0.08, frameLength = 2.0, frameHeight = 1.05;
    const startX = -0.7, spacing = 0.175;

    for (let i = 0; i < frameCount; i++) {
      const singleFrame = new THREE.Group();
      // Wooden top bar resting on rim
      const topBarGeo = new THREE.BoxGeometry(frameWidth + 0.04, 0.04, frameLength + 0.18);
      const topBar = new THREE.Mesh(topBarGeo, darkWoodMat);
      topBar.position.y = frameHeight / 2;
      singleFrame.add(topBar);

      // Wax Comb Infill
      const combGeo = new THREE.BoxGeometry(0.04, frameHeight - 0.08, frameLength - 0.08);
      const comb = new THREE.Mesh(combGeo, waxCombMat);
      comb.position.y = 0;
      singleFrame.add(comb);

      singleFrame.position.set(startX + i * spacing, 0.24, 0);
      singleFrame.castShadow = true;
      framesGroup.add(singleFrame);
    }
    chamberGroup.add(framesGroup);
    partsGroup.framesGroup = framesGroup;

    // --- FEATURE 2: INTERNAL ANIMATED BEE CLUSTER (EXPLODED VIEW FEATURE) ---
    const beesGroup = new THREE.Group();
    beesGroup.name = 'beesGroup';

    const beeBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber golden bee body
      roughness: 0.3,
      metalness: 0.2
    });

    const beeStripeMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b // Dark black stripe
    });

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1
    });

    const beeCount = 35;
    const beeData = [];

    for (let i = 0; i < beeCount; i++) {
      const bee = new THREE.Group();

      // Bee body
      const bodyGeo = new THREE.CapsuleGeometry(0.025, 0.04, 4, 8);
      const bodyMesh = new THREE.Mesh(bodyGeo, beeBodyMat);
      bodyMesh.rotation.z = Math.PI / 2;
      bee.add(bodyMesh);

      // Black stripe ring
      const stripeGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.02, 8);
      const stripeMesh = new THREE.Mesh(stripeGeo, beeStripeMat);
      stripeMesh.rotation.z = Math.PI / 2;
      bee.add(stripeMesh);

      // Left & Right Wings
      const wingGeo = new THREE.PlaneGeometry(0.035, 0.02);

      const leftWing = new THREE.Mesh(wingGeo, wingMat);
      leftWing.position.set(-0.015, 0.025, 0.01);
      leftWing.rotation.x = -0.3;
      bee.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeo, wingMat);
      rightWing.position.set(-0.015, 0.025, -0.01);
      rightWing.rotation.x = 0.3;
      bee.add(rightWing);

      // Initial positions nestled between hanging frames
      const initialPos = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        0.1 + Math.random() * 0.45,
        (Math.random() - 0.5) * 1.7
      );

      bee.position.copy(initialPos);
      bee.scale.set(0, 0, 0); // Start hidden in assembled view

      beesGroup.add(bee);

      beeData.push({
        mesh: bee,
        basePos: initialPos.clone(),
        phase: Math.random() * Math.PI * 2,
        speed: 1.5 + Math.random() * 2.0,
        radius: 0.05 + Math.random() * 0.08
      });
    }

    chamberGroup.add(beesGroup);
    beesGroupRef.current = { group: beesGroup, data: beeData };

    scene.add(chamberGroup);
    partsGroup.chamberBox = chamberGroup;

    // --- PART 3: INNER COVER BOARD ---
    const innerCoverGroup = new THREE.Group();
    innerCoverGroup.userData = { id: 'innerCover', name: 'Inner Cover Board' };

    const innerBoardGeo = new THREE.BoxGeometry(2.22, 0.06, 2.42);
    const innerBoardMesh = new THREE.Mesh(innerBoardGeo, woodBaseMat);
    innerBoardMesh.position.set(0, 0.92, 0);
    innerBoardMesh.castShadow = true;
    innerCoverGroup.add(innerBoardMesh);

    // Central oval ventilation hole
    const holeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16);
    const holeMesh = new THREE.Mesh(holeGeo, darkWoodMat);
    holeMesh.position.set(0, 0.92, 0);
    innerCoverGroup.add(holeMesh);

    scene.add(innerCoverGroup);
    partsGroup.innerCover = innerCoverGroup;

    // --- PART 4: TELESCOPING OUTER ROOF ---
    const roofGroup = new THREE.Group();
    roofGroup.userData = { id: 'roof', name: 'Telescoping Outer Roof' };

    // Metal top plate
    const roofTopGeo = new THREE.BoxGeometry(2.4, 0.06, 2.6);
    const roofTopMesh = new THREE.Mesh(roofTopGeo, roofMetalMat);
    roofTopMesh.position.set(0, 1.08, 0);
    roofTopMesh.castShadow = true;
    roofGroup.add(roofTopMesh);

    // Wood telescoping overhang border
    const rimGeo = new THREE.BoxGeometry(2.42, 0.16, 2.62);
    const rimMesh = new THREE.Mesh(rimGeo, darkWoodMat);
    rimMesh.position.set(0, 0.98, 0);
    rimMesh.castShadow = true;
    roofGroup.add(rimMesh);

    scene.add(roofGroup);
    partsGroup.roof = roofGroup;

    partsGroupRef.current = partsGroup;

    // 6. RAYCASTING INTERACTION (Click & Hover)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getIntersectedPart = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const interactiveMeshes = [];
      scene.traverse((child) => {
        if (child.isMesh && child.parent) {
          interactiveMeshes.push(child);
        }
      });

      const intersects = raycaster.intersectObjects(interactiveMeshes);
      if (intersects.length > 0) {
        let curr = intersects[0].object;
        while (curr && curr !== scene) {
          if (curr.userData && curr.userData.id) {
            return { partId: curr.userData.id, object: curr, point: intersects[0].point };
          }
          curr = curr.parent;
        }
      }
      return null;
    };

    const handlePointerDown = (event) => {
      const startX = event.clientX;
      const startY = event.clientY;

      const handlePointerUp = (upEvent) => {
        const dist = Math.hypot(upEvent.clientX - startX, upEvent.clientY - startY);
        if (dist < 6) { // It was a click!
          const match = getIntersectedPart(upEvent);
          if (match) {
            setSelectedPart(match.partId);
            setTooltipPos({
              x: upEvent.clientX - container.getBoundingClientRect().left,
              y: upEvent.clientY - container.getBoundingClientRect().top
            });
          } else {
            setSelectedPart(null);
          }
        }
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointerup', handlePointerUp);
    };

    const handlePointerMove = (event) => {
      const match = getIntersectedPart(event);
      if (match) {
        setHoveredPart(match.partId);
        container.style.cursor = 'pointer';
      } else {
        setHoveredPart(null);
        container.style.cursor = 'grab';
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    // 7. ANIMATION LOOP & LERP SMOOTHING FOR FLUSH STACKING vs EXPLODED VIEW
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      controls.update();

      const exploded = explodedStateRef.current;

      // Exact Y offset targets for Assembled (flush 0 offset) vs Exploded
      const targetY = {
        roof: exploded ? 2.5 : 0.0,
        innerCover: exploded ? 1.55 : 0.0,
        chamberBox: exploded ? 0.35 : 0.0,
        framesGroup: exploded ? 0.65 : 0.0, // Lift hanging frames out of chamber
        bottomBoard: exploded ? -0.75 : 0.0
      };

      const lerpSpeed = 0.08;

      if (partsGroupRef.current.roof) {
        partsGroupRef.current.roof.position.y += (targetY.roof - partsGroupRef.current.roof.position.y) * lerpSpeed;
      }
      if (partsGroupRef.current.innerCover) {
        partsGroupRef.current.innerCover.position.y += (targetY.innerCover - partsGroupRef.current.innerCover.position.y) * lerpSpeed;
      }
      if (partsGroupRef.current.chamberBox) {
        partsGroupRef.current.chamberBox.position.y += (targetY.chamberBox - partsGroupRef.current.chamberBox.position.y) * lerpSpeed;
      }
      if (partsGroupRef.current.framesGroup) {
        partsGroupRef.current.framesGroup.position.y += (targetY.framesGroup - partsGroupRef.current.framesGroup.position.y) * lerpSpeed;
      }
      if (partsGroupRef.current.bottomBoard) {
        partsGroupRef.current.bottomBoard.position.y += (targetY.bottomBoard - partsGroupRef.current.bottomBoard.position.y) * lerpSpeed;
      }

      const currPreset = presetRef.current;

      // 1. 3D VISUAL REACTION: HEAT CORE POINT LIGHT (OVERHEAT)
      if (currPreset === 'OVERHEAT' || statusRef.current.status === 'ALERT') {
        const pulse = (Math.sin(elapsedTime * 8) + 1) / 2;
        if (heatLightRef.current) {
          heatLightRef.current.color.setHex(0xef4444);
          heatLightRef.current.intensity = 1.8 + pulse * 3.0;
        }
      } else if (currPreset === 'SWARM_BURST') {
        const pulse = (Math.sin(elapsedTime * 12) + 1) / 2;
        if (heatLightRef.current) {
          heatLightRef.current.color.setHex(0xf59e0b);
          heatLightRef.current.intensity = 1.0 + pulse * 1.5;
        }
      } else {
        if (heatLightRef.current) {
          heatLightRef.current.intensity += (0 - heatLightRef.current.intensity) * 0.1;
        }
      }

      // 2. 3D VISUAL REACTION: CO2 GAS HAZE CLOUD (CO2_SPIKE)
      if (co2HazeGroupRef.current) {
        const targetOpacity = (currPreset === 'CO2_SPIKE') ? 0.55 : 0.0;
        const mat = co2HazeGroupRef.current.mat;
        mat.opacity += (targetOpacity - mat.opacity) * 0.08;

        if (mat.opacity > 0.02) {
          co2HazeGroupRef.current.group.rotation.y = elapsedTime * 0.4;
          co2HazeGroupRef.current.group.children.forEach((child, idx) => {
            child.position.y = 0.7 + Math.sin(elapsedTime * 2 + idx) * 0.15;
            child.scale.setScalar(1 + Math.sin(elapsedTime * 1.5 + idx) * 0.15);
          });
        }
      }

      // 3. 3D VISUAL REACTION: SWARM BURST FLYING BEES
      if (beesGroupRef.current) {
        const { data } = beesGroupRef.current;
        const isSwarmMode = (currPreset === 'SWARM_BURST');
        const targetScale = (exploded || isSwarmMode) ? 1.0 : 0.0;

        data.forEach((b, idx) => {
          b.mesh.scale.x += (targetScale - b.mesh.scale.x) * 0.1;
          b.mesh.scale.y += (targetScale - b.mesh.scale.y) * 0.1;
          b.mesh.scale.z += (targetScale - b.mesh.scale.z) * 0.1;

          if (b.mesh.scale.x > 0.05) {
            if (isSwarmMode) {
              // Rapid wild swarming around entrance ramp & hive exterior
              const speedMult = 3.5;
              const t = elapsedTime * speedMult + b.phase;
              const swarmRadius = 0.85 + (idx % 5) * 0.25;
              b.mesh.position.x = Math.sin(t * 1.2) * swarmRadius;
              b.mesh.position.y = -0.2 + Math.cos(t * 1.8) * 0.7 + (idx % 3) * 0.3;
              b.mesh.position.z = 0.9 + Math.sin(t * 0.9) * swarmRadius;
              b.mesh.rotation.y = t * 1.5;
            } else {
              // Gentle hovering inside brood frames
              const t = elapsedTime * b.speed + b.phase;
              b.mesh.position.x = b.basePos.x + Math.sin(t) * b.radius;
              b.mesh.position.y = b.basePos.y + Math.cos(t * 1.5) * (b.radius * 0.6);
              b.mesh.position.z = b.basePos.z + Math.sin(t * 0.8) * b.radius;
              b.mesh.rotation.y = t;
            }
          }
        });
      }

      // 4. DYNAMIC CHAMBER MATERIAL COLOR & GLOW
      if (mainChamberMatRef.current) {
        let targetHex = 0xd97706; // Standard cedar wood
        if (currPreset === 'OVERHEAT') targetHex = 0xdc2626;
        else if (currPreset === 'CO2_SPIKE') targetHex = 0x7e22ce;
        else if (currPreset === 'SWARM_BURST') targetHex = 0xd97706;

        const targetColor = new THREE.Color(targetHex);
        mainChamberMatRef.current.color.lerp(targetColor, 0.08);

        if (currPreset === 'OVERHEAT') {
          const pulseFactor = (Math.sin(elapsedTime * 8) + 1) / 2;
          mainChamberMatRef.current.emissive.setHex(0xef4444);
          mainChamberMatRef.current.emissiveIntensity = 0.3 + pulseFactor * 0.5;
        } else if (currPreset === 'CO2_SPIKE') {
          mainChamberMatRef.current.emissive.setHex(0xa855f7);
          mainChamberMatRef.current.emissiveIntensity = 0.25;
        } else {
          mainChamberMatRef.current.emissive.lerp(targetColor, 0.05);
          mainChamberMatRef.current.emissiveIntensity = 0.15;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 8. RESIZE HANDLER
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update status ref whenever prop changes
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Reset Orbit Camera view
  const handleResetView = () => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(4.5, 2.8, 5.5);
      controlsRef.current.target.set(0, 0.3, 0);
      controlsRef.current.update();
    }
  };

  const selectedPartData = selectedPart ? getPartTelemetry(selectedPart, telemetry) : null;

  return (
    <div className="relative w-full h-full bg-slate-50 flex flex-col select-none overflow-hidden border-r border-slate-200">
      
      {/* 3D WebGL Canvas Mounting Node */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP OVERLAY BAR: Title & Digital Twin Beacon */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200/80 shadow-sm pointer-events-auto">
          <div className="relative flex h-3 w-3">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: status.color }}
            />
            <span
              className="relative inline-flex rounded-full h-3 w-3"
              style={{ backgroundColor: status.color }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm tracking-wide">HIVETWIN-01</span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider text-white"
                style={{ backgroundColor: status.color }}
              >
                {status.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Single Langstroth Digital Twin</p>
          </div>
        </div>

        {/* CONTROLS TOOLBAR */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onToggleExplode}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold text-xs transition-all shadow-sm border ${
              isExploded
                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            {isExploded ? 'Assemble View' : 'Explode View'}
          </button>

          <button
            onClick={handleResetView}
            title="Reset 3D Camera Angle"
            className="p-2 bg-white text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 shadow-sm transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D MODEL SCENARIO VISUAL REACTION BADGE */}
      {preset && preset !== 'NORMAL' && (
        <div className="absolute top-20 left-4 pointer-events-none z-10">
          <div className="bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2 rounded-xl border border-slate-700 shadow-lg flex items-center gap-2.5 text-xs font-semibold">
            {preset === 'OVERHEAT' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                <span><strong className="text-rose-400">3D REACTION:</strong> Thermal Heat Glow & Glowing Red Core</span>
              </>
            )}
            {preset === 'CO2_SPIKE' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping shrink-0" />
                <span><strong className="text-purple-400">3D REACTION:</strong> Atmospheric CO₂ Gas Haze & Ventilation Vapor</span>
              </>
            )}
            {preset === 'SWARM_BURST' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                <span><strong className="text-amber-400">3D REACTION:</strong> Rapid Bee Swarm Burst & Exterior Flight Paths</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* BOTTOM HINT BANNER */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="bg-white/80 backdrop-blur-sm px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 font-medium shadow-xs">
          💡 <span className="font-semibold text-slate-700">Orbit:</span> Click & Drag | <span className="font-semibold text-slate-700">Zoom:</span> Scroll | <span className="font-semibold text-slate-700">Inspect:</span> Click any Hive Layer
        </div>
        {hoveredPart && (
          <div className="bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-lg text-xs text-white font-mono uppercase tracking-wider">
            Hovering: {hoveredPart}
          </div>
        )}
      </div>

      {/* CLICK-TO-INSPECT FLOATING ANNOTATION TOOLTIP */}
      {selectedPartData && (
        <div
          className="absolute z-20 w-80 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: Math.min(Math.max(16, tooltipPos.x - 160), window.innerWidth / 2 - 340),
            top: Math.min(Math.max(80, tooltipPos.y - 40), window.innerHeight - 280)
          }}
        >
          <div className="flex items-start justify-between pb-2 mb-2 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                Component Telemetry
              </span>
              <h4 className="font-bold text-slate-800 text-sm mt-1">{selectedPartData.name}</h4>
              <p className="text-xs text-slate-500">{selectedPartData.partType}</p>
            </div>
            <button
              onClick={() => setSelectedPart(null)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none font-bold p-1"
            >
              ×
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {selectedPartData.temp && (
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 font-medium">Local Temp:</span>
                <span className="font-bold text-slate-800">{selectedPartData.temp}</span>
              </div>
            )}
            {selectedPartData.humidity && (
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 font-medium">Local Humidity:</span>
                <span className="font-bold text-slate-800">{selectedPartData.humidity}</span>
              </div>
            )}
            {selectedPartData.co2 && (
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 font-medium">Chamber CO₂:</span>
                <span className="font-bold text-slate-800">{selectedPartData.co2}</span>
              </div>
            )}
            {selectedPartData.traffic && (
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 font-medium">Gate Activity:</span>
                <span className="font-bold text-slate-800">{selectedPartData.traffic}</span>
              </div>
            )}
            {selectedPartData.framesCount && (
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500 font-medium">Internal Frames:</span>
                <span className="font-bold text-amber-700">{selectedPartData.framesCount}</span>
              </div>
            )}
            <p className="text-[11px] text-slate-600 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
              {selectedPartData.detail}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
