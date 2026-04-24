const svg = d3.select("svg");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

const projection = d3.geoMercator()
    .scale(width / 6)
    .translate([width / 2, height / 1.65]);

let path = d3.geoPath().projection(projection);

const mapGroup = svg.append("g");
const equivalentGroup = svg.append("g");

const SCALE_FACTOR = 500;
const AREA_TOLERANCE_PCT = 0.05;

const State = {
    selectedCountry: null,
    currentHoverCountry: null,
    coveredCountries: null,
    isHoverPaused: false,

    reset() {
        this.selectedCountry = null;
        this.currentHoverCountry = null;
        this.coveredCountries = null;
        this.isHoverPaused = false;
    }
};

let worldData = [];

d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json").then(function(world) {
    const countries = topojson.feature(world, world.objects.countries);

    fetch('https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/slim-2/slim-2.json')
        .then(res => res.json())
        .then(isoData => {
            const isoMap = new Map(isoData.map(d => [d.name, {
                code: d['alpha-2'].toLowerCase(),
                region: d['region'] || null,
                subRegion: d['sub-region'] || null
            }]));

            worldData = countries.features.map(d => {
                const iso = isoMap.get(d.properties.name) || {};
                const area = path.area(d);
                return {
                    ...d,
                    properties: {
                        ...d.properties,
                        name: d.properties.name || 'Unknown',
                        code: iso.code || null,
                        region: iso.region || null,
                        subRegion: iso.subRegion || null,
                        areaKm2: Math.round(area * SCALE_FACTOR)
                    },
                    area,
                    centroid: path.centroid(d)
                };
            });

            mapGroup.selectAll(".country")
                .data(worldData)
                .enter()
                .append("path")
                .attr("class", "country")
                .attr("d", path)
                .on("click", handleClick)
                .on("mouseover", handleMouseOver)
                .on("mouseout", handleMouseOut);
        });
});

function getEquivalentCountries(selected, hovered) {
    if (hovered.area >= selected.area) return null;

    const tolerance = selected.area * AREA_TOLERANCE_PCT;
    const byDistance = worldData
        .filter(c => c !== selected && c !== hovered)
        .sort((a, b) => {
            const ax = a.centroid[0] - hovered.centroid[0], ay = a.centroid[1] - hovered.centroid[1];
            const bx = b.centroid[0] - hovered.centroid[0], by = b.centroid[1] - hovered.centroid[1];
            return (ax*ax + ay*ay) - (bx*bx + by*by);
        });

    const covered = [hovered];
    let total = hovered.area;

    for (const c of byDistance) {
        if (Math.abs(total - selected.area) <= tolerance) break;
        if (total >= selected.area + tolerance) break;
        total += c.area;
        covered.push(c);
    }
    while (total > selected.area + tolerance && covered.length > 1) {
        total -= covered.pop().area;
    }

    return covered;
}

function handleClick(event, d) {
    if (State.isHoverPaused) return;

    const isHovered = d3.select(event.target).classed("hover-country");

    if (isHovered && State.selectedCountry) {
        State.isHoverPaused = true;
        mapGroup.selectAll(".country")
            .style("pointer-events", "none")
            .style("cursor", "default");
        renderLegend(State.selectedCountry, d, true);
        return;
    }

    if (State.selectedCountry === d) {
        State.selectedCountry = null;
        State.currentHoverCountry = null;
        State.coveredCountries = null;
        d3.select(event.target).classed("selected-country", false);
        equivalentGroup.selectAll("*").remove();
        showInitialLegend();
        return;
    }

    mapGroup.selectAll(".selected-country").classed("selected-country", false);
    mapGroup.selectAll(".hover-country").classed("hover-country", false);
    equivalentGroup.selectAll("*").remove();

    State.selectedCountry = d;
    State.currentHoverCountry = null;
    State.coveredCountries = null;

    d3.select(event.target).classed("selected-country", true);
    renderLegend(d, null, false);
}

function handleMouseOver(event, d) {
    if (!State.selectedCountry || d === State.selectedCountry || State.isHoverPaused) return;

    mapGroup.selectAll(".hover-country").classed("hover-country", false);
    State.currentHoverCountry = d;
    d3.select(event.target).classed("hover-country", true);

    equivalentGroup.selectAll(".equivalent-area").remove();

    if (d.area < State.selectedCountry.area) {
        const covered = getEquivalentCountries(State.selectedCountry, d);
        State.coveredCountries = covered;
        if (covered) {
            equivalentGroup.selectAll(".equivalent-area")
                .data(covered)
                .enter()
                .append("path")
                .attr("class", "equivalent-area")
                .attr("d", path);
        }
    } else {
        State.coveredCountries = null;
    }

    renderLegend(State.selectedCountry, d, false);
}

function handleMouseOut(event, d) {
    if (!State.selectedCountry || State.isHoverPaused) return;

    State.currentHoverCountry = null;
    State.coveredCountries = null;
    d3.select(event.target).classed("hover-country", false);
    equivalentGroup.selectAll("*").remove();

    renderLegend(State.selectedCountry, null, false);
}

function fmt(n) { return n.toLocaleString(); }
function fmtArea(km2) { return `${fmt(km2)} km²`; }
function flagSpan(code) {
    return code ? `<span class="flag-icon flag-icon-${code}"></span>` : '';
}

function countryCardHTML(d, cardClass) {
    const { name, code, subRegion, region, areaKm2 } = d.properties;
    const locationLine = subRegion || region;
    return `
        <div class="country-card ${cardClass}">
            <p class="country-name">${flagSpan(code)} ${name}</p>
            ${locationLine ? `<p class="country-meta">${locationLine}</p>` : ''}
            <p class="country-area">${fmtArea(areaKm2)}</p>
        </div>
    `;
}

function showInitialLegend() {
    d3.select("#legend").html(`<p class="legend-hint">Click on a country to begin comparing areas</p>`);
}

function renderLegend(selected, hovered, frozen) {
    if (!hovered) {
        d3.select("#legend").html(`
            <p class="legend-heading">Selected</p>
            ${countryCardHTML(selected, 'selected-card')}
            <hr class="legend-divider">
            <p class="legend-hint">Hover over another country to compare</p>
        `);
        return;
    }

    const selArea = selected.properties.areaKm2;
    const hovArea = hovered.properties.areaKm2;
    const diff = Math.abs(hovArea - selArea);
    const larger = hovArea >= selArea ? hovered : selected;
    const smaller = hovArea >= selArea ? selected : hovered;
    const ratio = (larger.properties.areaKm2 / (smaller.properties.areaKm2 || 1)).toFixed(2);
    const diffPct = selArea > 0 ? (diff / selArea * 100).toFixed(1) : '0';

    let extraHTML = '';

    if (hovArea >= selArea) {
        extraHTML = `
            <div class="insight-card">
                <strong>${ratio}×</strong> <em>${selected.properties.name}</em>s fit inside <em>${hovered.properties.name}</em>
            </div>
        `;
    } else {
        const covered = State.coveredCountries;
        if (covered && covered.length > 0) {
            const totalAreaKm2 = Math.round(covered.reduce((s, c) => s + c.area, 0) * SCALE_FACTOR);
            const label = covered.length === 1 ? 'country' : 'countries';
            extraHTML = `
                <p class="comparison-label" style="margin-top:0.65rem">Combined to match</p>
                <ul class="equiv-countries-list">
                    ${covered.map(c => `
                        <li class="equiv-country-item">
                            ${flagSpan(c.properties.code)}
                            <span>${c.properties.name}</span>
                            <span class="equiv-country-area">${fmtArea(c.properties.areaKm2)}</span>
                        </li>
                    `).join('')}
                </ul>
                <div class="insight-card">
                    ${covered.length} ${label} combine to ≈ <strong>${fmtArea(totalAreaKm2)}</strong>
                </div>
            `;
        }
    }

    d3.select("#legend").html(`
        <p class="legend-heading">Comparing</p>
        ${countryCardHTML(selected, 'selected-card')}
        ${countryCardHTML(hovered, 'hover-card')}
        <hr class="legend-divider">
        <p class="comparison-label">Statistics</p>
        <div class="stat-row">
            <span class="stat-label">Size ratio</span>
            <span class="stat-value">${ratio}×</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Difference</span>
            <span class="stat-value">${fmtArea(diff)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">% difference</span>
            <span class="stat-value">${diffPct}%</span>
        </div>
        ${extraHTML}
        ${frozen ? `<p class="frozen-note">Frozen · Click Reset to restart</p>` : ''}
    `);
}

// Reset
d3.select("#resetMap").on("click", function() {
    State.reset();
    mapGroup.selectAll(".country")
        .classed("selected-country", false)
        .classed("hover-country", false)
        .style("pointer-events", null)
        .style("cursor", null);
    equivalentGroup.selectAll("*").remove();
    showInitialLegend();
});

// Click on empty svg area deselects
svg.on("click", function(event) {
    if (event.target === this && !State.isHoverPaused) {
        State.reset();
        mapGroup.selectAll(".selected-country").classed("selected-country", false);
        mapGroup.selectAll(".hover-country").classed("hover-country", false);
        equivalentGroup.selectAll("*").remove();
        showInitialLegend();
    }
});

// Modal
const modal = document.getElementById('instructionModal');
const learnButton = document.getElementById('learnButton');
const closeButton = modal.querySelector('.close-button');

learnButton.addEventListener('click', e => { e.stopPropagation(); modal.style.display = 'block'; });
closeButton.addEventListener('click', e => { e.stopPropagation(); modal.style.display = 'none'; });
window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.style.display = 'none'; });

// ─── Responsive redraw ───────────────────────────────────────────

function handleResize() {
    const w = svg.node().clientWidth;
    const h = svg.node().clientHeight;
    projection.scale(w / 6).translate([w / 2, h / 1.65]);
    path = d3.geoPath().projection(projection);
    mapGroup.selectAll(".country").attr("d", path);
    equivalentGroup.selectAll(".equivalent-area").attr("d", path);
    worldData.forEach(d => { d.centroid = path.centroid(d); });
}

let _resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(handleResize, 150);
});
