export const MAP_CONFIG = {
    width: 330,
    depth: 290,
    waterLevel: 0,
    pathHeight: 1.2
};

// Quatro ilhas: a principal a norte e três destinos separados.
export const ISLANDS = [
    { id: 'principal', name: 'Bolantis', x: 0, z: 91, radius: 48, height: 13, biome: 'black-forest' },
    { id: 'fungos', name: 'Ilha dos Fungos', x: -97, z: -23, radius: 37, height: 9, biome: 'fungal' },
    { id: 'falésias', name: 'Ilha das Falésias', x: 99, z: -20, radius: 39, height: 15, biome: 'cliffs' },
    { id: 'angulo', name: 'Angulo', x: 5, z: -112, radius: 47, height: 12, biome: 'city' }
];

// Vários pontos podem pertencer à mesma ilha. Isso permite criar missões
// internas antes de Matus embarcar para outro território.
export const ROUTE_NODES = [
    { id: 'floresta', name: 'Floresta dos Descontentes', x: -16, z: 98, kind: 'start', islandId: 'principal' },
    { id: 'bolantis', name: 'Centro de Bolantis', x: 14, z: 83, kind: 'waypoint', islandId: 'principal' },
    { id: 'alturas', name: 'Mestre das Alturas', x: 7, z: 108, kind: 'waypoint', islandId: 'principal' },
    { id: 'campos', name: 'Campos Infrutíferos', x: -97, z: -23, kind: 'waypoint', islandId: 'fungos' },
    { id: 'cais', name: 'Cais das Falésias', x: 99, z: -20, kind: 'waypoint', islandId: 'falésias' },
    { id: 'angulo', name: 'Angulo, Balizom', x: 5, z: -112, kind: 'goal', islandId: 'angulo' }
];

export const ROUTE_EDGES = [
    ['floresta', 'bolantis'],
    ['bolantis', 'alturas'],
    ['alturas', 'campos'],
    ['alturas', 'cais'],
    ['alturas', 'angulo']
];

export const CHANNEL_LINKS = [
    ['principal', 'fungos'],
    ['principal', 'falésias'],
    ['principal', 'angulo']
];
