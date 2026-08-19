import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { MAP_CONFIG, ISLANDS, ROUTE_NODES, ROUTE_EDGES, CHANNEL_LINKS } from './map-config.js';
import { createIslandScenery } from './island-scenery.js';

const canvas = document.querySelector('#webgl-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15251f);
scene.fog = new THREE.Fog(0x15251f, 215, 480);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 500);
camera.position.set(0, 190, -285);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, 0);
controls.enableDamping = true;
controls.dampingFactor = .055;
controls.minDistance = 90;
controls.maxDistance = 390;
controls.maxPolarAngle = Math.PI / 2.08;

scene.add(new THREE.HemisphereLight(0xbcd8c0, 0x23352d, 1.6));
const sun = new THREE.DirectionalLight(0xffe8bd, 2.2);
sun.position.set(-120, 180, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
scene.add(sun);

const noise = new SimplexNoise();
const islandById = new Map(ISLANDS.map(island => [island.id, island]));

function terrainHeight(x, z) {
    let highest = -1;
    ISLANDS.forEach(island => {
        const distance = Math.hypot(x - island.x, z - island.z);
        if (distance > island.radius) return;
        const edge = 1 - THREE.MathUtils.smoothstep(distance / island.radius, .58, 1);
        const detail = noise.noise(x * .12 + island.x, z * .12 + island.z) * .45;
        highest = Math.max(highest, island.height * (.42 + edge * .58) + detail);
    });
    return highest;
}

function islandColour(biome) {
    return {
        'black-forest': 0x27362d,
        fungal: 0x746044,
        city: 0x778064,
        cliffs: 0x4e5654
    }[biome] || 0x60745b;
}

function createIsland(island) {
    const group = new THREE.Group();
    group.position.set(island.x, island.height * .52, island.z);
    const geometry = new THREE.SphereGeometry(1, 48, 16);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        const edgeVariation = 1 + noise.noise(x * 4.2 + island.x, z * 4.2 + island.z) * .075;
        const verticalVariation = noise.noise(x * 3.1 - island.z, z * 3.1 + island.x) * .035 * (1 - Math.abs(y));
        positions.setXYZ(i, x * edgeVariation, y + verticalVariation, z * edgeVariation);
    }
    geometry.computeVertexNormals();
    const islandMesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: islandColour(island.biome), roughness: .95, flatShading: true })
    );
    islandMesh.scale.set(island.radius, island.height * .52, island.radius * .86);
    islandMesh.castShadow = true;
    islandMesh.receiveShadow = true;
    group.add(islandMesh);

    const beach = new THREE.Mesh(
        new THREE.CircleGeometry(island.radius * 1.08, 40),
        new THREE.MeshStandardMaterial({ color: 0xb29a6c, roughness: 1, transparent: true, opacity: .9 })
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = -island.height * .5 + .12;
    beach.receiveShadow = true;
    group.add(beach);
    scene.add(group);
}

function createChannel(fromId, toId, width = 15) {
    const from = islandById.get(fromId);
    const to = islandById.get(toId);
    const mid = new THREE.Vector3((from.x + to.x) / 2, .15, (from.z + to.z) / 2);
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(from.x, .15, from.z),
        mid,
        new THREE.Vector3(to.x, .15, to.z)
    ]);
    const points = curve.getPoints(36);
    const vertices = [];
    const indices = [];
    points.forEach((point, index) => {
        const tangent = curve.getTangent(index / (points.length - 1)).normalize();
        const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width * .5);
        vertices.push(point.x - side.x, point.y, point.z - side.z, point.x + side.x, point.y, point.z + side.z);
        if (index < points.length - 1) {
            const base = index * 2;
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const channel = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x55a5ad, roughness: .28, metalness: .06, transparent: true, opacity: .82 }));
    channel.receiveShadow = true;
    scene.add(channel);
}

function createRockBarrier(start, end, count = 7) {
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x222a28, roughness: 1, flatShading: true });
    for (let i = 0; i < count; i += 1) {
        const progress = i / Math.max(count - 1, 1);
        const x = THREE.MathUtils.lerp(start.x, end.x, progress);
        const z = THREE.MathUtils.lerp(start.z, end.z, progress);
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(5.2 + (i % 3) * 1.8, 1), rockMaterial);
        rock.position.set(x, 3.6 + (i % 2) * 1.2, z);
        rock.rotation.set(i * .31, i * .63, i * .19);
        rock.scale.set(1.35, 1 + (i % 2) * .45, .85);
        rock.castShadow = true;
        scene.add(rock);
    }
}

function createTerrain() {
    const ocean = new THREE.Mesh(
        new THREE.PlaneGeometry(MAP_CONFIG.width, MAP_CONFIG.depth),
        new THREE.MeshPhysicalMaterial({ color: 0x266e7b, roughness: .2, metalness: .05, transmission: .08, transparent: true, opacity: .92 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = MAP_CONFIG.waterLevel - .18;
    ocean.receiveShadow = true;
    scene.add(ocean);
    CHANNEL_LINKS.forEach(([fromId, toId]) => createChannel(fromId, toId));
    ISLANDS.forEach(createIsland);
    createRockBarrier({ x: -37, z: 57 }, { x: -27, z: -4 }, 10);
    createRockBarrier({ x: 39, z: 58 }, { x: 29, z: -3 }, 10);
    createRockBarrier({ x: -48, z: -12 }, { x: -25, z: -72 }, 9);
    createRockBarrier({ x: 49, z: -9 }, { x: 30, z: -72 }, 9);
}

const nodeById = new Map(ROUTE_NODES.map(node => [node.id, node]));
const nodeMeshes = new Map();

function mapPoint(node, yOffset = MAP_CONFIG.pathHeight) {
    return new THREE.Vector3(node.x, terrainHeight(node.x, node.z) + yOffset, node.z);
}

function createRoute() {
    const routeMaterial = new THREE.LineDashedMaterial({ color: 0xf2c66d, dashSize: 1.7, gapSize: .75, transparent: true, opacity: .9 });
    ROUTE_EDGES.forEach(([fromId, toId]) => {
        const from = nodeById.get(fromId);
        const to = nodeById.get(toId);
        const mid = new THREE.Vector3((from.x + to.x) / 2, 0, (from.z + to.z) / 2);
        mid.y = Math.max(MAP_CONFIG.waterLevel, terrainHeight(mid.x, mid.z)) + MAP_CONFIG.pathHeight;
        const curve = new THREE.CatmullRomCurve3([mapPoint(from), mid, mapPoint(to)]);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), routeMaterial);
        line.computeLineDistances();
        scene.add(line);
    });

    ROUTE_NODES.forEach(node => {
        const point = mapPoint(node, .3);
        const marker = new THREE.Group();
        marker.position.copy(point);
        const colour = node.kind === 'goal' ? 0xe99662 : node.kind === 'start' ? 0x89c77b : 0xf2c66d;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.25, .35, 10), new THREE.MeshStandardMaterial({ color: 0x273b2b, roughness: .85 }));
        base.position.y = -.15;
        base.castShadow = true;
        marker.add(base);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(.72, 16, 10), new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: .28 }));
        beacon.position.y = 1;
        beacon.castShadow = true;
        marker.add(beacon);
        scene.add(marker);
        nodeMeshes.set(node.id, marker);
    });
}

function createCharacter(colour = 0xff7c62) {
    const character = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: colour, roughness: .75 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x352d2b, roughness: .9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.8, 1.4, 5, 10), material);
    body.position.y = 1.65;
    body.castShadow = true;
    character.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.62, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf0bd8f, roughness: .9 }));
    head.position.y = 3.2;
    head.castShadow = true;
    character.add(head);
    [-.28, .28].forEach(x => {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(.28, .8, .38), darkMaterial);
        foot.position.set(x, .55, 0);
        foot.castShadow = true;
        character.add(foot);
    });
    return character;
}

export class PathAgent {
    constructor({ scene: targetScene, nodes = ROUTE_NODES, path = nodes.map(node => node.id), colour } = {}) {
        this.scene = targetScene;
        this.nodes = new Map(nodes.map(node => [node.id, node]));
        this.path = path;
        this.currentIndex = 0;
        this.speed = 8;
        this.active = false;
        this.onWaypoint = () => {};
        this.object = createCharacter(colour);
        this.reset();
        targetScene.add(this.object);
    }

    reset() {
        this.currentIndex = 0;
        this.active = false;
        this.object.position.copy(mapPoint(this.nodes.get(this.path[0]), 0));
        this.object.rotation.y = 0;
    }

    start() {
        this.active = true;
        return this;
    }

    stop() { this.active = false; return this; }

    update(delta) {
        if (!this.active || this.currentIndex >= this.path.length - 1) return;
        const targetNode = this.nodes.get(this.path[this.currentIndex + 1]);
        const target = mapPoint(targetNode, 0);
        const direction = target.clone().sub(this.object.position);
        const distance = direction.length();
        if (distance < .7) {
            this.currentIndex += 1;
            this.onWaypoint(targetNode, this.currentIndex, this.path.length);
            if (this.currentIndex >= this.path.length - 1) this.active = false;
            return;
        }
        direction.normalize();
        this.object.position.addScaledVector(direction, Math.min(distance, this.speed * delta));
        this.object.lookAt(target.x, this.object.position.y, target.z);
    }
}

createTerrain();
createIslandScenery({ scene, terrainHeight, islands: ISLANDS, nodes: ROUTE_NODES });
createRoute();

const agent = new PathAgent({
    scene,
    colour: 0xf07d62,
    path: ['floresta', 'bolantis', 'alturas', 'campos', 'alturas', 'cais', 'alturas', 'angulo']
});
const status = document.querySelector('#route-status');
const startButton = document.querySelector('#start-route');
const resetButton = document.querySelector('#reset-route');

agent.onWaypoint = node => {
    status.textContent = agent.active ? `A caminho de ${node.name}` : `Chegou a ${node.name}`;
    startButton.textContent = agent.active ? 'Em percurso…' : 'Percurso concluído';
};
startButton.addEventListener('click', () => {
    if (agent.currentIndex >= agent.path.length - 1) agent.reset();
    agent.start();
    status.textContent = `A caminho de ${nodeById.get(agent.path[agent.currentIndex + 1]).name}`;
    startButton.textContent = 'Em percurso…';
});
resetButton.addEventListener('click', () => {
    agent.reset();
    status.textContent = 'Pronto na Aldeia do Carvalho';
    startButton.textContent = 'Seguir as instruções';
});

// API simples para o jogo: mythsMap.agent.start(), .stop() e .reset().
window.mythsMap = { nodes: ROUTE_NODES, edges: ROUTE_EDGES, channels: CHANNEL_LINKS, agent, terrainHeight };

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), .05);
    agent.update(delta);
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

animate();
