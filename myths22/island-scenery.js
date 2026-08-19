import * as THREE from 'three';

function seededRandom(initialSeed) {
    let seed = initialSeed;
    return () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

function randomPoint(island, random, radiusFactor = .78) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * island.radius * radiusFactor;
    return {
        x: island.x + Math.cos(angle) * radius,
        z: island.z + Math.sin(angle) * radius * .82
    };
}

function placeOnTerrain(scene, object, terrainHeight, x, z) {
    const y = terrainHeight(x, z);
    if (y < 1) return false;
    object.position.set(x, y, z);
    scene.add(object);
    return true;
}

function createTree(scale, black = false) {
    const tree = new THREE.Group();
    tree.scale.setScalar(scale);
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(.28, .44, 4, 7),
        new THREE.MeshStandardMaterial({ color: black ? 0x060807 : 0x5a4431, roughness: 1 })
    );
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: black ? 0x010202 : 0x294f38, roughness: 1 });
    [4.2, 6, 7.7].forEach((height, index) => {
        const foliage = new THREE.Mesh(new THREE.ConeGeometry(2.9 - index * .46, 4.2, 8), foliageMaterial);
        foliage.position.y = height;
        foliage.castShadow = true;
        tree.add(foliage);
    });
    return tree;
}

function createHouse(wallColour = 0xb8a273, roofColour = 0x573c30, scale = 1) {
    const house = new THREE.Group();
    house.scale.setScalar(scale);
    const walls = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 3.4, 4),
        new THREE.MeshStandardMaterial({ color: wallColour, roughness: 1 })
    );
    walls.position.y = 1.7;
    walls.castShadow = true;
    house.add(walls);
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.5, 2.6, 4),
        new THREE.MeshStandardMaterial({ color: roofColour, roughness: 1 })
    );
    roof.position.y = 4.65;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);
    return house;
}

function createTower(colour = 0x6e7068, roofColour = 0x403936) {
    const tower = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(3.1, 4, 12, 10),
        new THREE.MeshStandardMaterial({ color: colour, roughness: 1 })
    );
    body.position.y = 6;
    body.castShadow = true;
    tower.add(body);
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(4.3, 4.8, 10),
        new THREE.MeshStandardMaterial({ color: roofColour, roughness: 1 })
    );
    roof.position.y = 14.4;
    roof.castShadow = true;
    tower.add(roof);
    return tower;
}

function createMushroom(scale, capColour) {
    const mushroom = new THREE.Group();
    mushroom.scale.setScalar(scale);
    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(.5, .75, 3.5, 10),
        new THREE.MeshStandardMaterial({ color: 0xd3c5a0, roughness: 1 })
    );
    stem.position.y = 1.75;
    stem.castShadow = true;
    mushroom.add(stem);
    const cap = new THREE.Mesh(
        new THREE.SphereGeometry(1.7, 14, 8, 0, Math.PI * 2, 0, Math.PI * .55),
        new THREE.MeshStandardMaterial({ color: capColour, roughness: .9 })
    );
    cap.scale.y = .65;
    cap.position.y = 3.25;
    cap.castShadow = true;
    mushroom.add(cap);
    return mushroom;
}

function decorateMainIsland({ scene, terrainHeight, island, nodes }) {
    const random = seededRandom(391);
    const bolantis = nodes.get('bolantis');
    for (let i = 0; i < 105; i += 1) {
        const point = randomPoint(island, random, .84);
        if (Math.hypot(point.x - bolantis.x, point.z - bolantis.z) < 17) continue;
        placeOnTerrain(scene, createTree(.8 + random() * .9, true), terrainHeight, point.x, point.z);
    }
    for (let i = 0; i < 9; i += 1) {
        const angle = i / 9 * Math.PI * 2;
        const x = bolantis.x + Math.cos(angle) * (7 + (i % 3) * 2.4);
        const z = bolantis.z + Math.sin(angle) * (7 + (i % 2) * 3);
        const house = createHouse(0x8d8a74, 0x292524, .8 + (i % 2) * .12);
        house.rotation.y = -angle;
        placeOnTerrain(scene, house, terrainHeight, x, z);
    }
    placeOnTerrain(scene, createTower(0x686a61, 0x171918), terrainHeight, 7, 108);
}

function decorateFungalIsland({ scene, terrainHeight, island }) {
    const random = seededRandom(1701);
    const colours = [0x8e3846, 0xb77a35, 0x5e496f, 0x6d2935];
    for (let i = 0; i < 42; i += 1) {
        const point = randomPoint(island, random, .78);
        const mushroom = createMushroom(.8 + random() * 1.7, colours[i % colours.length]);
        mushroom.rotation.y = random() * Math.PI * 2;
        placeOnTerrain(scene, mushroom, terrainHeight, point.x, point.z);
    }
    for (let i = 0; i < 8; i += 1) {
        const point = randomPoint(island, random, .68);
        placeOnTerrain(scene, createTree(.65 + random() * .45), terrainHeight, point.x, point.z);
    }
}

function decorateCliffIsland({ scene, terrainHeight, island }) {
    const random = seededRandom(843);
    const material = new THREE.MeshStandardMaterial({ color: 0x373f40, roughness: 1, flatShading: true });
    for (let i = 0; i < 30; i += 1) {
        const point = randomPoint(island, random, .82);
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.8 + random() * 4.4, 1), material);
        rock.scale.set(.75 + random(), 1.2 + random() * 2.2, .7 + random() * .7);
        rock.rotation.set(random(), random() * Math.PI, random());
        rock.castShadow = true;
        placeOnTerrain(scene, rock, terrainHeight, point.x, point.z);
    }
    placeOnTerrain(scene, createTower(0x7a7d73, 0x35434a), terrainHeight, island.x + 5, island.z + 4);
}

function decorateAngulo({ scene, terrainHeight, island }) {
    const random = seededRandom(2219);
    for (let i = 0; i < 22; i += 1) {
        const angle = i / 22 * Math.PI * 2 + random() * .2;
        const radius = 10 + (i % 3) * 7;
        const x = island.x + Math.cos(angle) * radius;
        const z = island.z + Math.sin(angle) * radius * .72;
        const house = createHouse(0xc0ad82, i % 3 === 0 ? 0x744236 : 0x5c3b32, .85 + random() * .3);
        house.rotation.y = -angle + Math.PI / 2;
        placeOnTerrain(scene, house, terrainHeight, x, z);
    }
    placeOnTerrain(scene, createTower(0xaaa17e, 0x703d33), terrainHeight, island.x, island.z);
    const dockMaterial = new THREE.MeshStandardMaterial({ color: 0x4f3928, roughness: 1 });
    for (let i = 0; i < 5; i += 1) {
        const dock = new THREE.Mesh(new THREE.BoxGeometry(7, .7, 3.2), dockMaterial);
        dock.castShadow = true;
        placeOnTerrain(scene, dock, terrainHeight, island.x - 1, island.z + 30 + i * 3.4);
    }
}

export function createIslandScenery({ scene, terrainHeight, islands, nodes }) {
    const islandMap = new Map(islands.map(island => [island.id, island]));
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    decorateMainIsland({ scene, terrainHeight, island: islandMap.get('principal'), nodes: nodeMap });
    decorateFungalIsland({ scene, terrainHeight, island: islandMap.get('fungos') });
    decorateCliffIsland({ scene, terrainHeight, island: islandMap.get('falésias') });
    decorateAngulo({ scene, terrainHeight, island: islandMap.get('angulo') });
}
