const MAP_CONFIG = {
    "development-regions": {
        title: "Development Regions",
        file: "nepal-development-regions.geojson",
        nameField: "REGION",
        codeField: null,
        parentField: null,
        color: "#7c8fa6",
        showLabels: true
    },
    "states": {
        title: "States",
        file: "nepal-states.geojson",
        nameField: "ADM1_EN",
        codeField: "ADM1_PCODE",
        parentField: "ADM0_EN",
        color: "#7c8fa6",
        showLabels: true
    },
    "districts": {
        title: "Districts",
        file: "nepal-districts-new.geojson",
        nameField: "DIST_EN",
        codeField: "DIST_PCODE",
        parentField: "ADM1_EN",
        color: "#7c8fa6",
        showLabels: true
    },
    "municipalities": {
        title: "Municipalities",
        file: "nepal-municipalities.geojson",
        nameField: "NAME",
        codeField: "N_ID",
        parentField: "DISTRICT",
        color: "#7c8fa6",
        showLabels: false
    },
    "wards": {
        title: "Wards",
        file: "nepal-wards.geojson",
        nameField: "VDC_NAME",
        codeField: "VDC_CODE",
        parentField: "DISTRICT",
        color: "#7c8fa6",
        showLabels: false
    }
};

const NEPAL_TOTAL_AREA_KM2 = 147181;

const svg = d3.select("svg");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

const projection = d3.geoMercator()
    .center([84, 28.3])
    .scale(width * 5.5)
    .translate([width / 2, height / 2]);

let path = d3.geoPath().projection(projection);

const mapGroup = svg.append("g");
const hoverGroup = svg.append("g");
const equivalentGroup = svg.append("g");

// ─── State ──────────────────────────────────────────────────────

const MapState = {
    selectedDistrict: null,
    currentHoverDistrict: null,
    isHoverPaused: false,
    frozenSelectedDistrict: null,
    frozenHoverDistrict: null,
    currentLayer: 'districts',
    layerData: [],

    reset() {
        this.selectedDistrict = null;
        this.currentHoverDistrict = null;
        this.frozenSelectedDistrict = null;
        this.frozenHoverDistrict = null;
        this.isHoverPaused = false;
    },

    freezeComparison(selected, hovered) {
        this.isHoverPaused = true;
        this.frozenSelectedDistrict = selected;
        this.frozenHoverDistrict = hovered;
        this.selectedDistrict = selected;
        this.currentHoverDistrict = hovered;

        mapGroup.selectAll(".district")
            .style("pointer-events", "none")
            .style("cursor", "default");

        mapGroup.selectAll(".selected-district")
            .classed("selected-district", true)
            .style("opacity", "0.8");

        mapGroup.select(`path[data-id="${hovered.properties.name}"]`)
            .classed("hover-district", true)
            .style("opacity", "0.8");
    }
};

// ─── Loading overlay ─────────────────────────────────────────────

function showLoading(layerTitle, hint) {
    document.getElementById('loadingText').textContent = `Loading ${layerTitle}…`;
    document.getElementById('loadingHint').textContent = hint || '';
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// ─── Interactions ────────────────────────────────────────────────

const MapInteractions = {
    handleClick(event, d) {
        event.stopPropagation();
        if (MapState.isHoverPaused) return;

        if (!d || !d.properties || !d.properties.areaKm2) return;

        if (!MapState.selectedDistrict) {
            MapState.selectedDistrict = d;
            d3.select(event.target)
                .classed("selected-district", true)
                .attr("data-id", d.properties.name);
            updateLegend(d);
            return;
        }

        if (MapState.selectedDistrict && MapState.currentHoverDistrict === d) {
            MapState.freezeComparison(MapState.selectedDistrict, d);
            compareDistricts(MapState.selectedDistrict, MapState.currentHoverDistrict);
        }
    },

    handleHover(event, d) {
        if (MapState.isHoverPaused) return;
        if (!MapState.selectedDistrict || d === MapState.selectedDistrict) return;
        if (!d || !d.properties || !d.properties.areaKm2) return;

        mapGroup.selectAll(".hover-district").classed("hover-district", false);

        MapState.currentHoverDistrict = d;
        d3.select(event.target)
            .classed("hover-district", true)
            .attr("data-id", d.properties.name);
        compareDistricts(MapState.selectedDistrict, MapState.currentHoverDistrict);
    },

    handleHoverEnd() {
        if (MapState.isHoverPaused) return;
        if (!MapState.selectedDistrict) return;

        mapGroup.selectAll(".hover-district").classed("hover-district", false);
        MapState.currentHoverDistrict = null;
        updateLegend(MapState.selectedDistrict);
    }
};

// ─── Layer controls ──────────────────────────────────────────────

const LayerControls = {
    init() {
        document.querySelectorAll('.layer-button').forEach(btn => {
            btn.addEventListener('click', this.handleLayerChange);
        });
    },

    handleLayerChange(event) {
        if (MapState.isHoverPaused) return;
        document.querySelectorAll('.layer-button').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');
        const layerType = event.target.getAttribute('data-layer');
        MapState.currentLayer = layerType;
        loadLayerData(layerType);
    }
};

// ─── Reset ───────────────────────────────────────────────────────

document.getElementById('resetMap').addEventListener('click', function () {
    MapState.reset();

    mapGroup.selectAll(".district")
        .style("pointer-events", "auto")
        .style("cursor", "pointer")
        .style("opacity", "0.72")
        .classed("selected-district", false)
        .classed("hover-district", false);

    hoverGroup.selectAll("*").remove();
    equivalentGroup.selectAll("*").remove();

    mapGroup.selectAll(".district")
        .on("click", MapInteractions.handleClick)
        .on("mouseover", MapInteractions.handleHover)
        .on("mouseout", MapInteractions.handleHoverEnd);

    showLayerSummary(MAP_CONFIG[MapState.currentLayer]);
});

LayerControls.init();
loadLayerData('districts');

mapGroup.selectAll(".district")
    .on("click", MapInteractions.handleClick)
    .on("mouseover", MapInteractions.handleHover)
    .on("mouseout", MapInteractions.handleHoverEnd);

svg.on("click", function (event) {
    if (event.target === this && !MapState.isHoverPaused) {
        MapState.reset();
        mapGroup.selectAll(".selected-district").classed("selected-district", false);
        mapGroup.selectAll(".hover-district").classed("hover-district", false);
        equivalentGroup.selectAll("*").remove();
        showLayerSummary(MAP_CONFIG[MapState.currentLayer]);
    }
});

// ─── Load data ───────────────────────────────────────────────────

function loadLayerData(layerType) {
    const config = MAP_CONFIG[layerType];
    if (!config) return;

    const slowHints = {
        wards: 'Large dataset (36,000+ wards) — may take a moment',
        municipalities: 'Large dataset — may take a few seconds'
    };
    showLoading(config.title, slowHints[layerType]);

    mapGroup.selectAll("*").remove();
    hoverGroup.selectAll("*").remove();
    equivalentGroup.selectAll("*").remove();
    MapState.selectedDistrict = null;
    MapState.currentHoverDistrict = null;
    MapState.isHoverPaused = false;

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const dataPath = isLocal
        ? `data/${config.file}`
        : `https://raw.githubusercontent.com/biraj094/viz/main/viz1/data/${config.file}`;

    fetch(dataPath)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text().then(text => {
                try { return JSON.parse(text); }
                catch (e) { throw new Error('Invalid JSON'); }
            });
        })
        .then(data => {
            const totalAreaPx = data.features.reduce((s, d) => s + path.area(d), 0);
            const scaleFactor = NEPAL_TOTAL_AREA_KM2 / totalAreaPx;

            MapState.layerData = data.features.map(d => {
                const areaPx = path.area(d);
                const areaKm2 = Math.round(areaPx * scaleFactor);
                return {
                    ...d,
                    properties: {
                        ...d.properties,
                        name: d.properties[config.nameField] || 'Unknown',
                        code: config.codeField
                            ? String(d.properties[config.codeField]).toLowerCase().replace(/\s+/g, '-')
                            : null,
                        province: config.parentField ? d.properties[config.parentField] : null,
                        areaKm2
                    },
                    area: areaPx,
                    centroid: path.centroid(d)
                };
            });

            // Compute area ranks (1 = largest)
            const sorted = [...MapState.layerData].sort((a, b) => b.properties.areaKm2 - a.properties.areaKm2);
            sorted.forEach((d, i) => { d.properties.areaRank = i + 1; });

            mapGroup.selectAll(".region")
                .data(MapState.layerData)
                .enter()
                .append("path")
                .attr("class", "district")
                .attr("d", path)
                .style("fill", "#7c8fa6")
                .style("opacity", "0.72")
                .style("cursor", "pointer")
                .attr("data-id", d => d.properties.name)
                .on("click", MapInteractions.handleClick)
                .on("mouseover", MapInteractions.handleHover)
                .on("mouseout", MapInteractions.handleHoverEnd);

            if (config.showLabels) {
                mapGroup.selectAll(".region-label")
                    .data(MapState.layerData)
                    .enter()
                    .append("text")
                    .attr("class", "region-label")
                    .attr("x", d => d.centroid[0])
                    .attr("y", d => d.centroid[1])
                    .style("font-size", layerType === "districts" ? "7.5px" : "11px")
                    .style("pointer-events", "none")
                    .text(d => d.properties.name);
            }

            hideLoading();
            showLayerSummary(config);
        })
        .catch(err => {
            console.error(`Error loading ${layerType}:`, err);
            hideLoading();
            d3.select("#legend").html(`
                <p class="legend-heading" style="color:#b8532a">Load error</p>
                <p class="legend-hint">Could not load ${config.title}. Check your connection and try again.</p>
            `);
        });
}

// ─── EDA summary panel ───────────────────────────────────────────

function showLayerSummary(config) {
    const data = MapState.layerData;
    if (!data || data.length === 0) {
        d3.select("#legend").html(`<p class="legend-hint">Click on a region to begin exploring</p>`);
        return;
    }

    const count = data.length;
    const areas = data.map(d => d.properties.areaKm2).filter(a => a > 0);
    const avgArea = Math.round(areas.reduce((s, a) => s + a, 0) / areas.length);
    const largest = data.reduce((m, d) => d.properties.areaKm2 > m.properties.areaKm2 ? d : m);
    const smallest = data.reduce((m, d) => d.properties.areaKm2 < m.properties.areaKm2 ? d : m);

    d3.select("#legend").html(`
        <p class="legend-heading">${config.title}</p>
        <p class="legend-hint">Click a region to explore · Hover to compare</p>
        <hr class="legend-divider">
        <p class="comparison-label">Overview</p>
        <div class="summary-grid">
            <div class="summary-cell">
                <div class="summary-cell-label">Regions</div>
                <div class="summary-cell-value">${count.toLocaleString()}</div>
            </div>
            <div class="summary-cell">
                <div class="summary-cell-label">Avg Area</div>
                <div class="summary-cell-value">${avgArea.toLocaleString()} km²</div>
            </div>
        </div>
        <div class="summary-grid" style="margin-top:0.35rem">
            <div class="summary-cell">
                <div class="summary-cell-label">Largest</div>
                <div class="summary-cell-value" title="${largest.properties.name}">${largest.properties.name}</div>
                <div class="summary-cell-label" style="margin-top:0.15rem">${largest.properties.areaKm2.toLocaleString()} km²</div>
            </div>
            <div class="summary-cell">
                <div class="summary-cell-label">Smallest</div>
                <div class="summary-cell-value" title="${smallest.properties.name}">${smallest.properties.name}</div>
                <div class="summary-cell-label" style="margin-top:0.15rem">${smallest.properties.areaKm2.toLocaleString()} km²</div>
            </div>
        </div>
    `);
}

// ─── Update legend (single selection) ───────────────────────────

function updateLegend(d) {
    const config = MAP_CONFIG[MapState.currentLayer];
    const area = d.properties.areaKm2;
    const pct = (area / NEPAL_TOTAL_AREA_KM2 * 100).toFixed(2);
    const rank = d.properties.areaRank;
    const total = MapState.layerData.length;
    const ordinal = n => {
        const s = ['th','st','nd','rd'], v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    d3.select("#legend").html(`
        <p class="legend-heading">${config.title.replace(/s$/, '')}</p>
        <div class="region-card selected-card">
            <p class="region-name">${d.properties.name}</p>
            ${getMetaHTML(d)}
            <p class="region-area">${area.toLocaleString()} km²</p>
            <p class="region-rank">${pct}% of Nepal · ${ordinal(rank)} largest of ${total}</p>
        </div>
        <hr class="legend-divider">
        <p class="legend-hint">${MapState.isHoverPaused
            ? 'Click Reset to start a new comparison'
            : 'Hover over another region to compare'}</p>
    `);
}

// ─── Compare two regions ─────────────────────────────────────────

function compareDistricts(selected, hovered) {
    if (MapState.isHoverPaused) {
        selected = MapState.frozenSelectedDistrict;
        hovered = MapState.frozenHoverDistrict;
    }

    if (!hovered || !hovered.properties || !hovered.properties.areaKm2) {
        updateLegend(selected);
        return;
    }

    const selArea = selected.properties.areaKm2;
    const hovArea = hovered.properties.areaKm2;
    const pctSel = (selArea / NEPAL_TOTAL_AREA_KM2 * 100).toFixed(2);
    const pctHov = (hovArea / NEPAL_TOTAL_AREA_KM2 * 100).toFixed(2);
    const larger = hovArea >= selArea ? hovered : selected;
    const smaller = hovArea >= selArea ? selected : hovered;
    const ratio = (larger.properties.areaKm2 / smaller.properties.areaKm2).toFixed(2);
    const diff = Math.abs(hovArea - selArea);

    equivalentGroup.selectAll(".equivalent-area").remove();

    // Highlight equivalent areas when hovered > selected
    if (hovArea > selArea) {
        const byDistance = MapState.layerData
            .filter(d => d !== selected && d !== hovered)
            .map(d => {
                const dx = d.centroid[0] - hovered.centroid[0];
                const dy = d.centroid[1] - hovered.centroid[1];
                return { district: d, dist: Math.sqrt(dx * dx + dy * dy) };
            })
            .sort((a, b) => a.dist - b.dist)
            .map(x => x.district);

        const tolerance = selArea * 0.05;
        const covered = [hovered];
        let total = hovArea;
        for (const d of byDistance) {
            if (Math.abs(total - selArea) <= tolerance) break;
            if (total < selArea) { covered.push(d); total += d.properties.areaKm2; }
        }

        equivalentGroup.selectAll(".equivalent-area")
            .data(covered)
            .enter()
            .append("path")
            .attr("class", "equivalent-area")
            .attr("d", path);
    }

    d3.select("#legend").html(`
        <p class="legend-heading">Comparing</p>
        <div class="region-card selected-card">
            <p class="region-name">${selected.properties.name}</p>
            ${getMetaHTML(selected)}
            <p class="region-area">${selArea.toLocaleString()} km²
                <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem"> · ${pctSel}%</span>
            </p>
        </div>
        <div class="region-card hover-card">
            <p class="region-name">${hovered.properties.name}</p>
            ${getMetaHTML(hovered)}
            <p class="region-area">${hovArea.toLocaleString()} km²
                <span style="color:var(--text-muted);font-weight:400;font-size:0.72rem"> · ${pctHov}%</span>
            </p>
        </div>
        <hr class="legend-divider">
        <p class="comparison-label">Comparison</p>
        <div class="stat-row">
            <span class="stat-label">Size ratio</span>
            <span class="stat-value">${ratio}×</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Difference</span>
            <span class="stat-value">${diff.toLocaleString()} km²</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">% difference</span>
            <span class="stat-value">${(diff / selArea * 100).toFixed(1)}%</span>
        </div>
        <div class="insight-card">
            <strong>${ratio}</strong> <em>${smaller.properties.name}</em>s fit inside <em>${larger.properties.name}</em>
        </div>
        ${MapState.isHoverPaused ? `<p class="frozen-note">Frozen · Click Reset to restart</p>` : ''}
    `);
}

// ─── Helpers ─────────────────────────────────────────────────────

function getMetaHTML(d) {
    if (!d || !d.properties) return '';
    const lines = [];
    switch (MapState.currentLayer) {
        case 'districts':
            if (d.properties.ADM1_EN) lines.push(`Province: ${d.properties.ADM1_EN}`);
            if (d.properties.DIST_PCODE) lines.push(`Code: ${d.properties.DIST_PCODE}`);
            break;
        case 'states':
            if (d.properties.ADM1_PCODE) lines.push(`Code: ${d.properties.ADM1_PCODE}`);
            break;
        case 'municipalities':
            if (d.properties.DISTRICT) lines.push(`District: ${d.properties.DISTRICT}`);
            if (d.properties.LEVEL) lines.push(`Type: ${d.properties.LEVEL}`);
            break;
        case 'wards':
            if (d.properties.DISTRICT) lines.push(`District: ${d.properties.DISTRICT}`);
            if (d.properties.ZONE_NAME) lines.push(`Zone: ${d.properties.ZONE_NAME}`);
            break;
    }
    return lines.map(l => `<p class="region-meta">${l}</p>`).join('');
}

svg.on("mouseleave", function () {
    if (MapState.isHoverPaused) return;
    mapGroup.selectAll(".hover-district").classed("hover-district", false);
});

// ─── Responsive redraw ───────────────────────────────────────────

function handleResize() {
    const w = svg.node().clientWidth;
    const h = svg.node().clientHeight;
    projection.scale(w * 5.5).translate([w / 2, h / 2]);
    path = d3.geoPath().projection(projection);
    mapGroup.selectAll(".district").attr("d", path);
    if (MapState.layerData.length > 0) {
        MapState.layerData.forEach(d => { d.centroid = path.centroid(d); });
        mapGroup.selectAll(".region-label")
            .attr("x", d => d.centroid[0])
            .attr("y", d => d.centroid[1]);
    }
    equivalentGroup.selectAll(".equivalent-area").attr("d", path);
}

let _resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(handleResize, 150);
});

// ─── Modal ───────────────────────────────────────────────────────

const modal = document.getElementById('instructionModal');
const infoButton = document.getElementById('infoButton');
const closeButton = modal.querySelector('.close-button');

infoButton.addEventListener('click', e => { e.stopPropagation(); modal.style.display = 'block'; });
closeButton.addEventListener('click', e => { e.stopPropagation(); modal.style.display = 'none'; });
window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.style.display = 'none'; });

if (!localStorage.getItem('hasVisitedBefore')) {
    modal.style.display = 'block';
    localStorage.setItem('hasVisitedBefore', 'true');
}
