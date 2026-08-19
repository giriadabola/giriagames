import { CONTINENT_MAP_PRESETS } from "./continent-presets.js";

function destroyVectorMap(mapObject, containerSelector) {
    if (mapObject && typeof mapObject.remove === "function") {
        mapObject.remove();
    }

    if (!containerSelector) return;

    const container = document.querySelector(containerSelector);
    if (container) {
        container.innerHTML = "";
    }
}

function getMapDataset() {
    return window.jsVectorMap?.maps?.world || window.jvm?.Map?.maps?.world_mill_en || null;
}

function getRegionState(entry, selectedIso, previewIso, iso) {
    if (!entry) return "muted";
    if (selectedIso === iso) return "selected";
    if (previewIso === iso && entry.hasTeams) return "preview";
    return entry.hasTeams ? "active" : "inactive";
}

function buildTooltip(country, hasTeams, clubCount) {
    if (!country) {
        return "Pais fora desta regiao";
    }

    if (hasTeams) {
        return `${country.nome} - ${clubCount} equipas disponiveis`;
    }

    return `${country.nome} - Sem equipas disponiveis`;
}

function buildRegionLookups(countries, resolveCountryIso, getCountryMeta) {
    const countryByIso = new Map();

    countries.forEach((country) => {
        const iso = resolveCountryIso(country);
        if (!iso) return;

        countryByIso.set(iso, {
            country,
            ...getCountryMeta(country)
        });
    });

    return countryByIso;
}

function extractPathBounds(pathData = "") {
    const matches = pathData.match(/-?\d*\.?\d+/g);
    if (!matches || matches.length < 2) return null;

    const numbers = matches.map(Number);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let index = 0; index < numbers.length - 1; index += 2) {
        const x = numbers[index];
        const y = numbers[index + 1];

        if (Number.isNaN(x) || Number.isNaN(y)) continue;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return null;
    }

    return { minX, minY, maxX, maxY };
}

function splitPathIntoSubpaths(pathData = "") {
    const matches = pathData.match(/M[^M]+/g);
    return matches || [];
}

function getBoundsArea(bounds) {
    if (!bounds) return 0;
    return Math.max(bounds.maxX - bounds.minX, 0) * Math.max(bounds.maxY - bounds.minY, 0);
}

function expandBounds(bounds, marginX = 0, marginY = 0) {
    if (!bounds) return null;

    return {
        minX: bounds.minX - marginX,
        minY: bounds.minY - marginY,
        maxX: bounds.maxX + marginX,
        maxY: bounds.maxY + marginY
    };
}

function boundsIntersect(boundsA, boundsB) {
    if (!boundsA || !boundsB) return false;

    return !(
        boundsA.maxX < boundsB.minX ||
        boundsA.minX > boundsB.maxX ||
        boundsA.maxY < boundsB.minY ||
        boundsA.minY > boundsB.maxY
    );
}

function getBoundsCenter(bounds) {
    if (!bounds) return null;

    return {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2
    };
}

function pointInBounds(point, bounds) {
    if (!point || !bounds) return false;

    return (
        point.x >= bounds.minX &&
        point.x <= bounds.maxX &&
        point.y >= bounds.minY &&
        point.y <= bounds.maxY
    );
}

function getRankedSubpaths(pathData = "") {
    return splitPathIntoSubpaths(pathData)
        .map((subpath) => ({
            subpath,
            bounds: extractPathBounds(subpath)
        }))
        .filter((entry) => entry.bounds)
        .sort((left, right) => getBoundsArea(right.bounds) - getBoundsArea(left.bounds));
}

function trimDetachedSubpaths(pathData, iso, mapConfig, viewportBounds = null) {
    const rankedSubpaths = getRankedSubpaths(pathData);
    if (rankedSubpaths.length === 0) {
        return pathData;
    }

    const continentKeepBounds = mapConfig?.subpathKeepBounds || null;
    if (continentKeepBounds) {
        const keptByCenter = rankedSubpaths.filter((entry) => pointInBounds(getBoundsCenter(entry.bounds), continentKeepBounds));
        if (keptByCenter.length > 0) {
            return keptByCenter.map((entry) => entry.subpath).join(" ");
        }
    }

    if (viewportBounds) {
        const keptByViewport = rankedSubpaths.filter((entry) => boundsIntersect(entry.bounds, viewportBounds));
        if (keptByViewport.length > 0) {
            return keptByViewport.map((entry) => entry.subpath).join(" ");
        }
    }

    const keepCount = mapConfig?.keepLargestSubpathsByIso?.[iso];
    if (!keepCount || keepCount < 1) {
        return pathData;
    }

    if (rankedSubpaths.length <= keepCount) {
        return pathData;
    }

    return rankedSubpaths
        .slice(0, keepCount)
        .map((entry) => entry.subpath)
        .join(" ");
}

function buildViewportBoundsFromRegions(viewportRegions, mapConfig) {
    const baseBounds = mergeBounds(
        viewportRegions.map((entry) => {
            const rankedSubpaths = getRankedSubpaths(entry.meta?.path || "");
            return rankedSubpaths[0]?.bounds || null;
        })
    );

    if (!baseBounds) return null;

    const marginX = mapConfig?.subpathViewportMarginX ?? 24;
    const marginY = mapConfig?.subpathViewportMarginY ?? 18;
    return expandBounds(baseBounds, marginX, marginY);
}

function mergeBounds(boundsList) {
    const validBounds = boundsList.filter(Boolean);
    if (validBounds.length === 0) return null;

    return validBounds.reduce((merged, bounds) => ({
        minX: Math.min(merged.minX, bounds.minX),
        minY: Math.min(merged.minY, bounds.minY),
        maxX: Math.max(merged.maxX, bounds.maxX),
        maxY: Math.max(merged.maxY, bounds.maxY)
    }));
}

function buildViewportTransform(width, height, bounds, options = {}) {
    if (!bounds) {
        return {
            scale: 1,
            translateX: 0,
            translateY: 0
        };
    }

    const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const paddingRatio = options.paddingRatio ?? 0.12;
    const zoomBoost = options.zoomBoost ?? 1;
    const frame = options.frameRect || { x: 0, y: 0, width, height };
    const usableWidth = frame.width * (1 - paddingRatio * 2);
    const usableHeight = frame.height * (1 - paddingRatio * 2);
    const baseScale = Math.min(usableWidth / boundsWidth, usableHeight / boundsHeight);
    const scale = baseScale * zoomBoost;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const frameCenterX = frame.x + (frame.width / 2);
    const frameCenterY = frame.y + (frame.height / 2);

    return {
        scale,
        translateX: frameCenterX - (centerX * scale),
        translateY: frameCenterY - (centerY * scale)
    };
}

function buildFocusTransform(width, height, focus = {}) {
    const scale = focus.scale ?? 1;
    const focusX = (focus.x ?? 0.5) * width;
    const focusY = (focus.y ?? 0.5) * height;

    return {
        scale,
        translateX: (width / 2) - (focusX * scale),
        translateY: (height / 2) - (focusY * scale)
    };
}

function mergeSvgBounds(boundsList) {
    const validBounds = boundsList.filter((bounds) => bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y));
    if (validBounds.length === 0) return null;

    return validBounds.reduce((merged, bounds) => ({
        minX: Math.min(merged.minX, bounds.x),
        minY: Math.min(merged.minY, bounds.y),
        maxX: Math.max(merged.maxX, bounds.x + bounds.width),
        maxY: Math.max(merged.maxY, bounds.y + bounds.height)
    }), {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
    });
}

function createMeasurementSvg(width, height) {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.style.left = "-99999px";
    svg.style.top = "-99999px";
    svg.style.visibility = "hidden";
    svg.style.pointerEvents = "none";

    document.body.appendChild(svg);

    return {
        svg,
        cleanup() {
            svg.remove();
        }
    };
}

function getMeasuredSubpaths(pathData, svg) {
    const svgNamespace = "http://www.w3.org/2000/svg";

    return splitPathIntoSubpaths(pathData)
        .map((subpath) => {
            const pathNode = document.createElementNS(svgNamespace, "path");
            pathNode.setAttribute("d", subpath);
            svg.appendChild(pathNode);

            try {
                const bounds = pathNode.getBBox();
                return { subpath, bounds };
            } catch {
                return null;
            } finally {
                pathNode.remove();
            }
        })
        .filter(Boolean);
}

function normalizeMeasuredBounds(bounds) {
    if (!bounds) return null;

    return {
        minX: bounds.x,
        minY: bounds.y,
        maxX: bounds.x + bounds.width,
        maxY: bounds.y + bounds.height
    };
}

function renderContinentMap({
    containerSelector,
    existingMapObject,
    continentKey,
    countries,
    resolveCountryIso,
    getCountryMeta,
    onCountrySelect
}) {
    const container = document.querySelector(containerSelector);
    if (!container) return null;

    destroyVectorMap(existingMapObject, containerSelector);

    const dataset = getMapDataset();
    if (!dataset?.paths) {
        const continentLabel = CONTINENT_MAP_PRESETS[continentKey]?.label || "Continente";
        container.innerHTML = `<div class="continent-map-fallback">Mapa de ${continentLabel} indisponivel neste modo. Usa a lista de paises abaixo para continuar.</div>`;
        return null;
    }

    const countryByIso = buildRegionLookups(countries, resolveCountryIso, getCountryMeta);
    const width = Number(dataset.width) || 900;
    const height = Number(dataset.height) || 460;
    const mapConfig = CONTINENT_MAP_PRESETS[continentKey] || {};
    const baseRegions = Array.from(countryByIso.keys())
        .map((iso) => ({
            iso,
            meta: dataset.paths[iso]
        }))
        .filter((entry) => entry.meta?.path);
    const viewportIsoCodes = Array.isArray(mapConfig.viewportIsoCodes) && mapConfig.viewportIsoCodes.length > 0
        ? mapConfig.viewportIsoCodes
        : baseRegions.map((entry) => entry.iso);
    const viewportRegions = baseRegions.filter((entry) => viewportIsoCodes.includes(entry.iso));
    const viewportSubpathBounds = buildViewportBoundsFromRegions(viewportRegions, mapConfig);
    const measurement = createMeasurementSvg(width, height);
    const visibleRegions = baseRegions.map((entry) => {
        const originalPath = entry.meta?.path || "";
        const measuredSubpaths = getMeasuredSubpaths(originalPath, measurement.svg);
        let keptSubpaths = measuredSubpaths;

        if (mapConfig?.subpathKeepBounds) {
            const keptByCenter = measuredSubpaths.filter((subpathEntry) =>
                pointInBounds(getBoundsCenter(normalizeMeasuredBounds(subpathEntry.bounds)), mapConfig.subpathKeepBounds)
            );

            if (keptByCenter.length > 0) {
                keptSubpaths = keptByCenter;
            }
        } else if (viewportSubpathBounds) {
            const keptByViewport = measuredSubpaths.filter((subpathEntry) =>
                boundsIntersect(normalizeMeasuredBounds(subpathEntry.bounds), viewportSubpathBounds)
            );

            if (keptByViewport.length > 0) {
                keptSubpaths = keptByViewport;
            }
        }

        if (keptSubpaths.length === 0) {
            keptSubpaths = measuredSubpaths;
        }

        const keepCount = mapConfig?.keepLargestSubpathsByIso?.[entry.iso];
        if (keepCount && keptSubpaths.length > keepCount) {
            keptSubpaths = keptSubpaths
                .slice()
                .sort((left, right) => (right.bounds.width * right.bounds.height) - (left.bounds.width * left.bounds.height))
                .slice(0, keepCount);
        }

        return {
            ...entry,
            trimmedPath: keptSubpaths.map((subpathEntry) => subpathEntry.subpath).join(" ")
        };
    });
    measurement.cleanup();

    const clipRect = mapConfig.clipViewportRect || null;
    const clipPathId = `continent-clip-${continentKey}`;

    let selectedIso = null;
    let previewIso = null;

    container.innerHTML = `
        <svg class="continent-map-svg" viewBox="0 0 ${width} ${height}" aria-label="Mapa interativo do continente">
            ${clipRect ? `
                <defs>
                    <clipPath id="${clipPathId}">
                        <rect x="${clipRect.x}" y="${clipRect.y}" width="${clipRect.width}" height="${clipRect.height}" rx="${clipRect.rx || 0}" ry="${clipRect.ry || 0}"></rect>
                    </clipPath>
                </defs>
            ` : ""}
            <g ${clipRect ? `clip-path="url(#${clipPathId})"` : ""}>
                <g class="continent-map-group">
                    ${visibleRegions.map(({ iso, trimmedPath }) => {
                        const entry = countryByIso.get(iso);
                        const state = getRegionState(entry, selectedIso, previewIso, iso);
                        const label = buildTooltip(entry?.country, entry?.hasTeams, entry?.clubCount || 0);

                        return `
                            <path
                                class="continent-map-region continent-map-region--${state}"
                                data-iso="${iso}"
                                data-has-teams="${entry?.hasTeams ? "true" : "false"}"
                                d="${trimmedPath}"
                                aria-label="${label}"
                            >
                                <title>${label}</title>
                            </path>
                        `;
                    }).join("")}
                </g>
            </g>
        </svg>
    `;

    const regionNodes = Array.from(container.querySelectorAll(".continent-map-region"));
    const mapGroup = container.querySelector(".continent-map-group");

    function applyViewportTransform() {
        if (!mapGroup) return;

        mapGroup.setAttribute("transform", "");

        if (mapConfig?.focus) {
            const { scale, translateX, translateY } = buildFocusTransform(width, height, mapConfig.focus);
            mapGroup.setAttribute("transform", `translate(${translateX} ${translateY}) scale(${scale})`);
            return;
        }

        const viewportBounds = mergeSvgBounds(
            regionNodes
                .filter((node) => viewportIsoCodes.includes(node.dataset.iso))
                .map((node) => {
                    try {
                        return node.getBBox();
                    } catch {
                        return null;
                    }
                })
        );

        const { scale, translateX, translateY } = buildViewportTransform(width, height, viewportBounds, {
            frameRect: clipRect ? {
                x: clipRect.x,
                y: clipRect.y,
                width: clipRect.width,
                height: clipRect.height
            } : undefined,
            paddingRatio: mapConfig.paddingRatio,
            zoomBoost: mapConfig.zoomBoost
        });

        mapGroup.setAttribute("transform", `translate(${translateX} ${translateY}) scale(${scale})`);
    }

    applyViewportTransform();

    function refreshStyles() {
        regionNodes.forEach((node) => {
            const iso = node.dataset.iso;
            const entry = countryByIso.get(iso);
            const state = getRegionState(entry, selectedIso, previewIso, iso);

            node.setAttribute("class", `continent-map-region continent-map-region--${state}`);
        });
    }

    function findIsoByCountry(country) {
        for (const [iso, entry] of countryByIso.entries()) {
            if (entry.country?.id === country?.id) {
                return iso;
            }
        }

        return null;
    }

    regionNodes.forEach((node) => {
        const iso = node.dataset.iso;
        const entry = countryByIso.get(iso);

        node.addEventListener("mouseenter", () => {
            if (!entry?.hasTeams) return;
            previewIso = iso;
            refreshStyles();
        });

        node.addEventListener("mouseleave", () => {
            previewIso = null;
            refreshStyles();
        });

        node.addEventListener("click", () => {
            if (!entry?.hasTeams) return;

            selectedIso = iso;
            previewIso = null;
            refreshStyles();
            onCountrySelect?.(entry.country);
        });
    });

    return {
        remove() {
            destroyVectorMap(null, containerSelector);
        },
        previewCountry(country) {
            previewIso = findIsoByCountry(country);
            refreshStyles();
        },
        clearPreview() {
            previewIso = null;
            refreshStyles();
        },
        selectCountry(country) {
            selectedIso = findIsoByCountry(country);
            previewIso = null;
            refreshStyles();
        }
    };
}

export { destroyVectorMap, renderContinentMap };
