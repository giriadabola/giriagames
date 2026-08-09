const CONTINENT_SHAPES = {
    america_norte: {
        label: "America do Norte",
        x: 210,
        y: 128,
        path: "M69 95 L95 74 L146 59 L194 53 L236 56 L280 72 L319 69 L342 82 L336 102 L308 107 L282 101 L258 112 L246 130 L223 135 L219 150 L193 157 L171 153 L151 161 L142 176 L113 172 L98 155 L92 136 L75 123 L58 112 Z M309 39 L337 29 L364 42 L354 58 L326 63 L300 54 Z"
    },
    america_sul: {
        label: "America do Sul",
        x: 285,
        y: 284,
        path: "M236 188 L261 179 L286 189 L296 213 L287 238 L274 262 L279 290 L269 323 L253 355 L236 382 L226 365 L231 336 L222 313 L216 281 L208 254 L201 225 L210 202 Z"
    },
    europa: {
        label: "Europa",
        x: 485,
        y: 107,
        path: "M436 86 L452 76 L478 72 L502 76 L521 72 L544 80 L548 92 L530 98 L519 108 L501 112 L491 103 L471 106 L456 100 L444 95 Z"
    },
    africa: {
        label: "Africa",
        x: 505,
        y: 241,
        path: "M468 127 L491 120 L518 124 L542 139 L553 164 L548 202 L534 236 L518 271 L497 304 L479 289 L475 259 L466 233 L456 198 L455 165 Z"
    },
    asia: {
        label: "Asia",
        x: 673,
        y: 144,
        path: "M528 89 L563 76 L606 79 L645 73 L691 80 L733 95 L781 111 L810 135 L804 161 L778 173 L742 168 L719 177 L697 194 L671 195 L648 183 L628 187 L609 172 L587 170 L561 154 L543 131 L527 117 Z"
    },
    oceania: {
        label: "Oceania",
        x: 796,
        y: 309,
        path: "M745 266 L773 257 L803 265 L824 283 L818 307 L795 319 L768 316 L749 302 L741 283 Z M836 320 L849 315 L859 323 L850 333 L838 331 Z"
    }
};

function getProgressClass(progress) {
    if (progress >= 0.95) return "is-complete";
    if (progress >= 0.45) return "is-advanced";
    return "is-fresh";
}

function buildContinentShapeMarkup(key, stats) {
    const shape = CONTINENT_SHAPES[key];
    const total = Math.max(stats?.total || 0, 1);
    const progress = (stats?.collected || 0) / total;

    return `
        <g class="world-continent ${getProgressClass(progress)}" data-continent-key="${key}" tabindex="0" role="button" aria-label="${shape.label}">
            <path class="world-continent-shape" d="${shape.path}"></path>
            <text class="world-continent-label" x="${shape.x}" y="${shape.y}">${shape.label}</text>
        </g>
    `;
}

function renderWorldMapView(container, options) {
    if (!container) return;

    const { statsByContinent = {}, onSelectContinent } = options || {};

    container.innerHTML = `
        <svg class="world-map-svg" viewBox="0 0 900 460" aria-hidden="true">
            <defs>
                <radialGradient id="worldMapGlow" cx="50%" cy="50%" r="75%">
                    <stop offset="0%" stop-color="rgba(255,255,255,0.28)"></stop>
                    <stop offset="100%" stop-color="rgba(255,255,255,0)"></stop>
                </radialGradient>
            </defs>
            <rect class="world-map-grid" x="0" y="0" width="900" height="460" rx="0"></rect>
            <path class="world-map-orbit orbit-a" d="M35 126 C177 78, 349 74, 509 105 S807 171, 865 131"></path>
            <path class="world-map-orbit orbit-b" d="M62 313 C223 258, 399 264, 539 291 S782 338, 861 295"></path>
            ${Object.entries(CONTINENT_SHAPES).map(([key]) => buildContinentShapeMarkup(key, statsByContinent[key])).join("")}
        </svg>
    `;

    const handleSelect = (continentKey) => {
        if (typeof onSelectContinent === "function") {
            onSelectContinent(continentKey);
        }
    };

    container.querySelectorAll(".world-continent").forEach((node) => {
        node.addEventListener("click", () => handleSelect(node.dataset.continentKey));
        node.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleSelect(node.dataset.continentKey);
            }
        });
    });
}

export { renderWorldMapView };
