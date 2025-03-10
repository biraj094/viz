// Configuration object for all map layers and their properties
const MAP_CONFIG = {
    "development-regions": {
        title: "Development Regions",
        emoji: "🌏",
        file: "nepal-development-regions.geojson",
        nameField: "REGION",
        codeField: null,
        parentField: null,
        description: "Compare development regions",
        color: "#2c3e50",
        showLabels: true
    },
    "states": {
        title: "States",
        emoji: "🏛️",
        file: "nepal-states.geojson",
        nameField: "ADM1_EN",
        codeField: "ADM1_PCODE",
        parentField: "ADM0_EN",
        description: "Analyze state areas",
        color: "#2c3e50",
        showLabels: true
    },
    "districts": {
        title: "Districts",
        emoji: "📍",
        file: "nepal-districts-new.geojson",
        nameField: "DIST_EN",
        codeField: "DIST_PCODE",
        parentField: "ADM1_EN",
        description: "Explore district areas",
        color: "#2c3e50",
        showLabels: true
    },
    "wards": {
        title: "Wards",
        emoji: "🏘️",
        file: "nepal-wards.geojson",
        nameField: "VDC_NAME",
        codeField: "VDC_CODE",
        parentField: "DISTRICT",
        description: "View ward areas",
        color: "#2c3e50",
        showLabels: false
    },
    "municipalities": {
        title: "Municipalities",
        emoji: "🏢",
        file: "nepal-municipalities.geojson",
        nameField: "NAME",
        codeField: "N_ID",
        parentField: "DISTRICT",
        description: "Explore municipalities",
        color: "#2c3e50",
        showLabels: false
    }
};

const svg = d3.select("svg");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

// Adjust projection for Nepal
const projection = d3.geoMercator()
    .center([84, 28.3])  // Center of Nepal
    .scale(width * 5.5)  // Increased scale to fill more of the canvas
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

const mapGroup = svg.append("g");
const hoverGroup = svg.append("g");
const equivalentGroup = svg.append("g");

// Map State Management
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
        
        // Update visual state
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

// Map Interaction Handlers
const MapInteractions = {
    handleClick(event, d) {
        event.stopPropagation();
        
        if (MapState.isHoverPaused) return;
        
        if (!d || !d.properties || !d.properties.areaKm2) {
            console.warn('Invalid click data:', d);
            return;
        }
        
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
        
        if (!d || !d.properties || !d.properties.areaKm2) {
            console.warn('Invalid hover data:', d);
            return;
        }
        
        mapGroup.selectAll(".hover-district").classed("hover-district", false);
        
        MapState.currentHoverDistrict = d;
        const target = d3.select(event.target)
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

// Layer Button Handlers
const LayerControls = {
    init() {
        document.querySelectorAll('.layer-button').forEach(button => {
            button.addEventListener('click', this.handleLayerChange);
        });
    },

    handleLayerChange(event) {
        if (MapState.isHoverPaused) return;

        document.querySelectorAll('.layer-button').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        const layerType = event.target.getAttribute('data-layer');
        MapState.currentLayer = layerType;
        loadLayerData(layerType);
    }
};

// Reset Button Handler
document.getElementById('resetMap').addEventListener('click', function() {
    MapState.reset();
    
    // Reset visual state
    mapGroup.selectAll(".district")
        .style("pointer-events", "auto")
        .style("cursor", "pointer")
        .style("opacity", "0.7")
        .classed("selected-district", false)
        .classed("hover-district", false);
    
    hoverGroup.selectAll("*").remove();
    equivalentGroup.selectAll("*").remove();
    
    // Reattach event handlers
    mapGroup.selectAll(".district")
        .on("click", MapInteractions.handleClick)
        .on("mouseover", MapInteractions.handleHover)
        .on("mouseout", MapInteractions.handleHoverEnd);
    
    d3.select("#legend").html(`
        <h3>No region selected</h3>
        <p>Click on a region to begin</p>
    `);
});

// Initialize layer controls
LayerControls.init();

// Load districts layer by default
loadLayerData('districts');

// Update map event handlers
mapGroup.selectAll(".district")
    .on("click", MapInteractions.handleClick)
    .on("mouseover", MapInteractions.handleHover)
    .on("mouseout", MapInteractions.handleHoverEnd);

// SVG background click handler
svg.on("click", function(event) {
    if (event.target === this && !MapState.isHoverPaused) {
        MapState.reset();
        mapGroup.selectAll(".selected-district").classed("selected-district", false);
        mapGroup.selectAll(".hover-district").classed("hover-district", false);
        d3.select("#legend").html(`
            <h3>No region selected</h3>
            <p>Click on a region to begin</p>
        `);
    }
});

function loadLayerData(layerType) {
    const config = MAP_CONFIG[layerType];
    if (!config) {
        console.error(`No configuration found for layer type: ${layerType}`);
        return;
    }

    // Clear existing data
    mapGroup.selectAll("*").remove();
    hoverGroup.selectAll("*").remove();
    hoverGroup.selectAll("*").remove();
    MapState.selectedDistrict = null;
    MapState.currentHoverDistrict = null;

    // Update legend
    d3.select("#legend").html(`
        <h3>Loading ${config.title}...</h3>
        <p>Please wait...</p>
    `);

    // Determine if we're running locally or on GitHub Pages
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let dataPath;
    if (isLocal) {
        // Local development path
        dataPath = `data/${config.file}`;
    } else {
        // Use GitHub raw content directly
        const repoOwner = 'biraj094'; 
        const repoName = 'viz'; 
        dataPath = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/viz1/data/${config.file}`;
    }

    console.log('Attempting to load:', dataPath);

    fetch(dataPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Log the content type to verify it's being served correctly
            console.log('Content-Type:', response.headers.get('content-type'));
            return response.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error('Failed to parse JSON:', text.substring(0, 200) + '...');
                    throw new Error('Invalid JSON format in response');
                }
            });
        })
        .then(data => {
            console.log(`${layerType} data loaded successfully:`, data);
            
            // Special handling for district headquarters (points)
            if (layerType === 'district-headquarters') {
                MapState.layerData = data.features.map(d => ({
                    ...d,
                    properties: {
                        ...d.properties,
                        name: d.properties[config.nameField] || 'Unknown',
                        code: null,
                        province: null,
                        areaKm2: null
                    },
                    area: null,
                    centroid: d.geometry.coordinates
                }));

                // Draw points for headquarters
                mapGroup.selectAll("circle")
                    .data(MapState.layerData)
                    .enter()
                    .append("circle")
                    .attr("class", "district")
                    .attr("cx", d => projection(d.centroid)[0])
                    .attr("cy", d => projection(d.centroid)[1])
                    .attr("r", 5)
                    .style("fill", "#e53e3e")
                    .style("stroke", "#fff")
                    .style("stroke-width", "1px")
                    .style("opacity", "0.7")
                    .on("click", MapInteractions.handleClick)
                    .on("mouseover", function(event, d) {
                        if (MapState.selectedDistrict) {
                            MapState.currentHoverDistrict = d;
                            d3.select(this).classed("hover-district", true);
                            showHeadquarterInfo(d);
                        }
                    })
                    .on("mouseout", function() {
                        if (MapState.selectedDistrict) {
                            MapState.currentHoverDistrict = null;
                            d3.select(this).classed("hover-district", false);
                            updateLegend(MapState.selectedDistrict);
                        }
                    });

                return;
            }
            
            // Calculate total area in pixels first
            const totalAreaInPixels = data.features.reduce((sum, d) => sum + path.area(d), 0);
            // Known area of Nepal in square kilometers
            const NEPAL_TOTAL_AREA_KM2 = 147181;
            // Calculate the correct scale factor
            const SCALE_FACTOR = NEPAL_TOTAL_AREA_KM2 / totalAreaInPixels;
            
            MapState.layerData = data.features.map(d => {
                const areaInPixels = path.area(d);
                const areaKm2 = Math.round(areaInPixels * SCALE_FACTOR);
                
                return {
                    ...d,
                    properties: {
                        ...d.properties,
                        name: d.properties[config.nameField] || 'Unknown',
                        code: config.codeField ? String(d.properties[config.codeField]).toLowerCase().replace(/\s+/g, '-') : null,
                        province: config.parentField ? d.properties[config.parentField] : null,
                        areaKm2: areaKm2
                    },
                    area: areaInPixels,
                    centroid: path.centroid(d)
                };
            });

            // Draw the regions
            mapGroup.selectAll(".region")
                .data(MapState.layerData)
                .enter()
                .append("path")
                .attr("class", "district")
                .attr("d", path)
                .style("fill", "#2c3e50")
                .style("opacity", "0.7")
                .style("cursor", "pointer")
                .attr("data-id", d => d.properties.name)
                .on("click", MapInteractions.handleClick)
                .on("mouseover", MapInteractions.handleHover)
                .on("mouseout", MapInteractions.handleHoverEnd);

            // Add labels if configured for this layer
            if (config.showLabels) {
                mapGroup.selectAll(".region-label")
                    .data(MapState.layerData)
                    .enter()
                    .append("text")
                    .attr("class", "region-label")
                    .attr("x", d => d.centroid[0])
                    .attr("y", d => d.centroid[1])
                    .attr("text-anchor", "middle")
                    .attr("alignment-baseline", "middle")
                    .style("font-size", layerType === "districts" ? "8px" : "12px")
                    .style("font-weight", "bold")
                    .style("fill", "#000")
                    .style("pointer-events", "none")
                    .style("text-shadow", "1px 1px 1px #fff, -1px -1px 1px #fff, 1px -1px 1px #fff, -1px 1px 1px #fff")
                    .text(d => d.properties.name);
            }

            // Update legend
            d3.select("#legend").html(`
                <h3>No region selected</h3>
                <p>Click on a region to begin</p>
            `);
        })
        .catch(error => {
            console.error(`Error loading ${layerType} data:`, error);
            d3.select("#legend").html(`
                <h3 style="color: red;">Error Loading Map</h3>
                <p>There was an error loading the ${config.title} data. Please try again.</p>
            `);
        });
}

// Modal functionality
const modal = document.getElementById('instructionModal');
const infoButton = document.getElementById('infoButton');
const closeButton = modal.querySelector('.close-button');

infoButton.addEventListener('click', (event) => {
    event.stopPropagation();
    modal.style.display = 'block';
});

closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    modal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

// Show modal on first visit
if (!localStorage.getItem('hasVisitedBefore')) {
    modal.style.display = 'block';
    localStorage.setItem('hasVisitedBefore', 'true');
}

function compareDistricts(selected, hovered) {
    // If we're in frozen state, use the frozen districts
    if (MapState.isHoverPaused) {
        selected = MapState.frozenSelectedDistrict;
        hovered = MapState.frozenHoverDistrict;
    }
    
    // If we don't have valid data for comparison, show only selected district info
    if (!hovered || !hovered.properties || !hovered.properties.areaKm2) {
        const legendContent = `
            <div class="legend-container">
                <div class="selected-info">
                    <h3>Selected Region</h3>
                    <div class="region-card selected-card">
                        <strong>${selected.properties.name}</strong>
                        <p>Area: ${selected.properties.areaKm2.toLocaleString()} km²</p>
                        ${getAdditionalInfo(selected)}
                    </div>
                </div>
                ${!MapState.isHoverPaused ? `
                    <hr>
                    <div class="hover-instruction">
                        <p>Hover over another region within Nepal to compare areas</p>
                    </div>
                ` : ''}
            </div>
        `;
        d3.select("#legend").html(legendContent);
        return;
    }
    
    const selectedArea = selected.properties.areaKm2;
    const hoveredArea = hovered.properties.areaKm2;
    const ratio = hoveredArea / selectedArea;
    const percentDiff = Math.abs(hoveredArea - selectedArea) / selectedArea * 100;

    // Clear previous equivalent areas
    equivalentGroup.selectAll(".equivalent-area").remove();

    let equivalentContent = '';
    let coveredDistricts = [];

    // If hovered district is larger, show how many selected districts fit inside it
    if (hoveredArea > selectedArea) {
        // Calculate distances from hover district to all other districts
        const distancesFromHover = MapState.layerData
            .filter(d => d !== selected && d !== hovered)
            .map(d => {
                const dx = d.centroid[0] - hovered.centroid[0];
                const dy = d.centroid[1] - hovered.centroid[1];
                return {
                    district: d,
                    distance: Math.sqrt(dx*dx + dy*dy)
                };
            })
            .sort((a, b) => a.distance - b.distance)
            .map(d => d.district);

        const TOLERANCE_PERCENTAGE = 0.05; // 5% tolerance
        const targetArea = selectedArea;
        const tolerance = targetArea * TOLERANCE_PERCENTAGE;

        coveredDistricts = [hovered];
        let totalArea = hoveredArea;

        for (const district of distancesFromHover) {
            if (Math.abs(totalArea - targetArea) <= tolerance) break;
            if (totalArea < targetArea) {
                coveredDistricts.push(district);
                totalArea += district.properties.areaKm2;
            }
        }

        equivalentGroup.selectAll(".equivalent-area")
            .data(coveredDistricts)
            .enter()
            .append("path")
            .attr("class", "equivalent-area")
            .attr("d", path)
            .style("fill", "rgba(0, 150, 255, 0.5)")
            .style("stroke", "#000")
            .style("stroke-width", "1px");

        equivalentContent = `
            <div class="equivalence-info">
                <h4>Area Comparison</h4>
                <div class="equivalence-card">
                    <p class="highlight">${ratio.toFixed(2)} ${selected.properties.name}s can fit inside ${hovered.properties.name}</p>
                    <p class="sub-info">Combined area: ${totalArea.toLocaleString()} km²</p>
                </div>
            </div>
        `;
    } else {
        const fitCount = selectedArea / hoveredArea;
        equivalentContent = `
            <div class="equivalence-info">
                <h4>Area Comparison</h4>
                <div class="equivalence-card">
                    <p class="highlight">${fitCount.toFixed(2)} ${hovered.properties.name}s can fit inside ${selected.properties.name}</p>
                </div>
            </div>
        `;
    }

    const legendContent = `
        <div class="legend-container">
            <div class="selected-info">
                <h3>Selected Region</h3>
                <div class="region-card selected-card">
                    <strong>${selected.properties.name}</strong>
                    <p>Area: ${selectedArea.toLocaleString()} km²</p>
                    ${getAdditionalInfo(selected)}
                </div>
            </div>
            <hr>
            <div class="comparison-info">
                <h3>Comparing with</h3>
                <div class="region-card hover-card">
                    <strong>${hovered.properties.name}</strong>
                    ${getAdditionalInfo(hovered)}
                    <p>Area: ${hoveredArea.toLocaleString()} km²</p>
                </div>
                <div class="comparison-stats">
                    <p class="stat">
                        <span class="label">Size Ratio:</span>
                        <span class="value">${ratio.toFixed(2)}x</span>
                    </p>
                    <p class="stat">
                        <span class="label">Difference:</span>
                        <span class="value">${Math.abs(hoveredArea - selectedArea).toLocaleString()} km²</span>
                    </p>
                    <p class="stat">
                        <span class="label">Percent Difference:</span>
                        <span class="value">${percentDiff.toFixed(1)}%</span>
                    </p>
                </div>
                ${equivalentContent}
            </div>
            ${MapState.isHoverPaused ? `
                <div class="frozen-note">
                    This comparison is frozen. Click Reset to start a new comparison.
                </div>
            ` : ''}
        </div>
    `;

    d3.select("#legend").html(legendContent);
}

// Helper function to get additional info based on region type
function getAdditionalInfo(d) {
    if (!d || !d.properties) return '';
    
    switch(MapState.currentLayer) {
        case 'districts':
            return `
                <p>State: ${d.properties.ADM1_EN || 'N/A'}</p>
                <p>District Code: ${d.properties.DIST_PCODE || 'N/A'}</p>
            `;
        case 'states':
            return `
                <p>State Code: ${d.properties.ADM1_PCODE || 'N/A'}</p>
            `;
        case 'municipalities':
            return `
                <p>District: ${d.properties.DISTRICT || 'N/A'}</p>
                <p>Level: ${d.properties.LEVEL || 'N/A'}</p>
            `;
        case 'wards':
            return `
                <p>District: ${d.properties.DISTRICT || 'N/A'}</p>
                <p>Zone: ${d.properties.ZONE_NAME || 'N/A'}</p>
                <p>Region: ${d.properties.REGION || 'N/A'}</p>
            `;
        default:
            return '';
    }
}

function showHeadquarterInfo(d) {
    const legendContent = `
        <div class="legend-container">
            <div class="selected-info">
                <h3>Selected Headquarters</h3>
                <div class="region-card">
                    <strong>${d.properties.name}</strong>
                    <p>Type: District Headquarters</p>
                    <p>Location: [${d.centroid[0].toFixed(4)}, ${d.centroid[1].toFixed(4)}]</p>
                </div>
            </div>
        </div>
    `;
    
    d3.select("#legend").html(legendContent);
}

function updateLegend(d) {
    const config = MAP_CONFIG[MapState.currentLayer];
    const areaKm2 = d.properties.areaKm2;
    
    let additionalInfo = '';
    // Add specific information based on the layer type
    switch(MapState.currentLayer) {
        case 'districts':
            additionalInfo = `
                <p>State: ${d.properties.ADM1_EN}</p>
                <p>District Code: ${d.properties.DIST_PCODE}</p>
            `;
            break;
        case 'states':
            additionalInfo = `
                <p>State Code: ${d.properties.ADM1_PCODE}</p>
            `;
            break;
        case 'municipalities':
            additionalInfo = `
                <p>District: ${d.properties.DISTRICT}</p>
                <p>Level: ${d.properties.LEVEL}</p>
            `;
            break;
        case 'wards':
            additionalInfo = `
                <p>District: ${d.properties.DISTRICT}</p>
                <p>Zone: ${d.properties.ZONE_NAME}</p>
                <p>Region: ${d.properties.REGION}</p>
            `;
            break;
    }
    
    const legendContent = `
        <div class="legend-container">
            <div class="selected-info">
                <h3>Selected ${config.title.slice(0, -1)}</h3>
                <div class="region-card">
                    <strong>${d.properties.name}</strong>
                    ${additionalInfo}
                    <p>Area: ${areaKm2.toLocaleString()} km²</p>
                </div>
            </div>
            <hr>
            <div class="hover-instruction">
                <p>${MapState.isHoverPaused ? 'Click Reset to start a new comparison' : 'Hover over another region to compare areas'}</p>
            </div>
        </div>
    `;
    
    d3.select("#legend").html(legendContent);
}

// Add a handler for when mouse leaves the SVG completely
svg.on("mouseleave", function() {
    // If we have a frozen comparison, do nothing at all
    if (MapState.isHoverPaused) return;
    
    // Just remove the hover highlight if not frozen
    mapGroup.selectAll(".hover-district").classed("hover-district", false);
});

// Add keydown listener for escape key to close modal
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        modal.style.display = 'none';
    }
}); 