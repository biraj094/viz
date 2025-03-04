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

let selectedDistrict = null;
let currentLayer = 'districts';
let layerData = [];
let currentHoverDistrict = null;

// Initialize map with districts layer
loadLayerData('districts');

// Add click handlers for layer buttons
document.querySelectorAll('.layer-button').forEach(button => {
    button.addEventListener('click', function() {
        // Update active state
        document.querySelectorAll('.layer-button').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        // Load the new layer
        const layerType = this.getAttribute('data-layer');
        currentLayer = layerType;
        loadLayerData(layerType);
    });
});

// Reset button handler
document.getElementById('resetMap').addEventListener('click', function() {
    selectedDistrict = null;
    currentHoverDistrict = null;
    mapGroup.selectAll(".selected-district").classed("selected-district", false);
    mapGroup.selectAll(".hover-district").classed("hover-district", false);
    hoverGroup.selectAll("*").remove();
    equivalentGroup.selectAll(".equivalent-area").remove();
    
    d3.select("#legend").html(`
        <h3>No region selected</h3>
        <p>Click on a region to begin</p>
    `);
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
    equivalentGroup.selectAll("*").remove();
    selectedDistrict = null;
    currentHoverDistrict = null;

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
                layerData = data.features.map(d => ({
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
                    .data(layerData)
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
                    .on("click", clicked)
                    .on("mouseover", function(event, d) {
                        if (selectedDistrict) {
                            currentHoverDistrict = d;
                            d3.select(this).classed("hover-district", true);
                            showHeadquarterInfo(d);
                        }
                    })
                    .on("mouseout", function() {
                        if (selectedDistrict) {
                            currentHoverDistrict = null;
                            d3.select(this).classed("hover-district", false);
                            updateLegend(selectedDistrict);
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
            
            layerData = data.features.map(d => {
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
                .data(layerData)
                .enter()
                .append("path")
                .attr("class", "district")
                .attr("d", path)
                .style("fill", "#2c3e50")
                .style("opacity", "0.7")
                .on("click", clicked)
                .on("mouseover", function(event, d) {
                    if (selectedDistrict) {
                        currentHoverDistrict = d;
                        d3.select(this).classed("hover-district", true);
                        compareDistricts(selectedDistrict, d);
                    }
                })
                .on("mouseout", function() {
                    if (selectedDistrict) {
                        currentHoverDistrict = null;
                        d3.select(this).classed("hover-district", false);
                        equivalentGroup.selectAll(".equivalent-area").remove();
                        updateLegend(selectedDistrict);
                    }
                });

            // Add labels if configured for this layer
            if (config.showLabels) {
                mapGroup.selectAll(".region-label")
                    .data(layerData)
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

function clicked(event, d) {
    if (selectedDistrict) {
        mapGroup.selectAll(".district")
            .filter(c => c === selectedDistrict)
            .classed("hover-district", false);
    }
    
    hoverGroup.selectAll("*").remove();
    equivalentGroup.selectAll(".equivalent-area").remove();
    
    selectedDistrict = d;
    
    mapGroup.selectAll(".selected-district").classed("selected-district", false);
    d3.select(event.target)
        .classed("selected-district", true)
        .classed("hover-district", false);
    
    updateLegend(d);
}

function compareDistricts(selected, hovered) {
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
        const distancesFromHover = layerData
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

        coveredDistricts = [hovered]; // Start with hovered district
        let totalArea = hoveredArea;

        // Add nearby districts until we reach target area
        for (const district of distancesFromHover) {
            if (Math.abs(totalArea - targetArea) <= tolerance) break;
            if (totalArea < targetArea) {
                coveredDistricts.push(district);
                totalArea += district.properties.areaKm2;
            }
        }

        // Visualize equivalent areas
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
                <h4>Area Equivalence</h4>
                <div class="equivalence-card">
                    <p class="highlight">${ratio.toFixed(2)} ${selected.properties.name}s can fit inside ${hovered.properties.name}</p>
                    <p class="sub-info">Combined area: ${totalArea.toLocaleString()} km²</p>
                </div>
            </div>
        `;
    } else {
        // If hovered district is smaller, show how many of it fit in selected
        const fitCount = selectedArea / hoveredArea;
        equivalentContent = `
            <div class="equivalence-info">
                <h4>Area Equivalence</h4>
                <div class="equivalence-card">
                    <p class="highlight">${fitCount.toFixed(2)} ${hovered.properties.name}s can fit inside ${selected.properties.name}</p>
                </div>
            </div>
        `;
    }

    // Update legend with comparison
    const legendContent = `
        <div class="legend-container">
            <div class="selected-info">
                <h3>Selected Region</h3>
                <div class="region-card selected-card">
                    <strong>${selected.properties.name}</strong>
                    <p>Province: ${selected.properties.province}</p>
                    <p>Area: ${selectedArea.toLocaleString()} km²</p>
                </div>
            </div>
            <hr>
            <div class="comparison-info">
                <h3>Comparison with Hovered Region</h3>
                <div class="region-card hover-card">
                    <strong>${hovered.properties.name}</strong>
                    <p>Province: ${hovered.properties.province}</p>
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
        </div>
    `;

    d3.select("#legend").html(legendContent);

    // Add styles for the new legend format
    const style = document.createElement('style');
    style.textContent = `
        .legend-container {
            padding: 15px;
        }
        .region-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 12px;
            margin: 10px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .hover-card {
            background: rgba(49, 130, 206, 0.1);
            border: 1px solid rgba(49, 130, 206, 0.2);
        }
        .selected-card {
            background: rgba(229, 62, 62, 0.1);
            border: 1px solid rgba(229, 62, 62, 0.2);
        }
        .region-card strong {
            font-size: 1.1em;
            color: #2c3e50;
            display: block;
            margin-bottom: 8px;
        }
        .region-card p {
            margin: 5px 0;
            color: #5a6c7d;
        }
        .comparison-stats {
            background: #fff;
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
            border: 1px solid #e1e8ed;
        }
        .equivalence-info {
            margin-top: 20px;
        }
        .equivalence-info h4 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        .equivalence-card {
            background: #fff3cd;
            border-radius: 8px;
            padding: 15px;
            border: 1px solid #ffeeba;
        }
        .equivalence-card .highlight {
            color: #856404;
            font-weight: 600;
            font-size: 1.1em;
            margin-bottom: 8px;
        }
        .equivalence-card .sub-info {
            color: #666;
            font-size: 0.9em;
        }
        .stat {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 8px 0;
            padding: 5px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .stat:last-child {
            border-bottom: none;
        }
        .stat .label {
            color: #718096;
            font-weight: 500;
        }
        .stat .value {
            color: #2d3748;
            font-weight: 600;
        }
        hr {
            border: none;
            border-top: 2px solid #edf2f7;
            margin: 20px 0;
        }
    `;
    document.head.appendChild(style);
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
    const config = MAP_CONFIG[currentLayer];
    const areaKm2 = d.properties.areaKm2;
    
    let parentInfo = '';
    if (d.properties.province && config.parentField) {
        parentInfo = `<p>${config.parentField.split('_')[0]}: ${d.properties.province}</p>`;
    }
    
    let areaInfo = '';
    if (areaKm2 !== null) {
        areaInfo = `<p>Area: ${areaKm2.toLocaleString()} km²</p>`;
    }
    
    const legendContent = `
        <div class="legend-container">
            <div class="selected-info">
                <h3>Selected ${config.title.slice(0, -1)}</h3>
                <div class="region-card">
                    <strong>${d.properties.name}</strong>
                    ${parentInfo}
                    ${areaInfo}
                </div>
            </div>
            <hr>
            <div class="hover-instruction">
                <p>Hover over another region to compare areas</p>
            </div>
        </div>
    `;
    
    d3.select("#legend").html(legendContent);
} 