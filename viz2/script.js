const svg = d3.select("svg");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

const projection = d3.geoMercator()
    .scale(width / 6)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

const mapGroup = svg.append("g");
const hoverGroup = svg.append("g");
const equivalentGroup = svg.append("g");

let selectedCountry = null;
let worldData = [];
let currentHoverCountry = null;
let isHoverPaused = false;

// Load world map data
d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json").then(function(world) {
    const countries = topojson.feature(world, world.objects.countries);
    
    // Load ISO country codes mapping
    fetch('https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/slim-2/slim-2.json')
        .then(response => response.json())
        .then(isoData => {
            const isoMap = new Map(isoData.map(d => [d.name, d['alpha-2'].toLowerCase()]));
            
            // Approximate conversion factor from map units to km²
            const SCALE_FACTOR = 500;
            
            worldData = countries.features.map(d => ({
                ...d,
                properties: {
                    ...d.properties,
                    name: d.properties.name,
                    code: isoMap.get(d.properties.name) || d.id?.toLowerCase(),
                    areaKm2: Math.round(path.area(d) * SCALE_FACTOR)
                },
                area: path.area(d),
                centroid: path.centroid(d)
            }));

            mapGroup.selectAll(".country")
                .data(worldData)
                .enter()
                .append("path")
                .attr("class", "country")
                .attr("d", path)
                .on("click", clicked)
                .on("mouseover", handleMouseOver)
                .on("mouseout", handleMouseOut);
        });
});

function clicked(event, d) {
    // If we're in hover state and clicking, don't do anything
    // The pause functionality will be handled by the hover click handler
    if (currentHoverCountry) {
        return;
    }

    if (isHoverPaused) {
        // If hover is paused, clicking anywhere resumes normal behavior
        isHoverPaused = false;
        if (selectedCountry) {
            // Return to showing selected country
            mapGroup.selectAll(".hover-country").classed("hover-country", false);
            equivalentGroup.selectAll(".equivalent-area").remove();
            updateLegend(selectedCountry);
        }
        return;
    }

    if (selectedCountry === d) {
        // If clicking the same country, deselect it
        selectedCountry = null;
        d3.select(event.target).classed("selected-country", false);
        resetLegend();
        return;
    }

    // Remove hover class from previously selected country
    if (selectedCountry) {
        mapGroup.selectAll(".country")
            .filter(c => c === selectedCountry)
            .classed("hover-country", false);
    }
    
    // Clear previous equivalent areas and hover text
    hoverGroup.selectAll("*").remove();
    equivalentGroup.selectAll(".equivalent-area").remove();
    
    // Set new selection
    selectedCountry = d;
    
    // Update visual state
    mapGroup.selectAll(".selected-country").classed("selected-country", false);
    d3.select(event.target)
        .classed("selected-country", true)
        .classed("hover-country", false);
    
    updateLegend(d);
}

function handleMouseOver(event, d) {
    if (!selectedCountry || d === selectedCountry || isHoverPaused) return;
    
    currentHoverCountry = d;
    const currentElement = d3.select(this);
    currentElement.classed("hover-country", true);
    
    const hoverArea = path.area(d);
    const targetArea = path.area(selectedCountry);
    const AREA_TOLERANCE = 100;

    equivalentGroup.selectAll(".equivalent-area").remove();

    let currentComparison;
    if (hoverArea > targetArea) {
        const fitCount = (hoverArea / targetArea).toFixed(4);
        const SCALE_FACTOR = 500;
        const smallAreaKm = Math.round(targetArea * SCALE_FACTOR);
        const largeAreaKm = Math.round(hoverArea * SCALE_FACTOR);

        currentComparison = {
            partial: {
                fitCount: fitCount,
                smallAreaKm: smallAreaKm,
                largeAreaKm: largeAreaKm
            }
        };
    } else {
        const nearbyCountries = worldData
            .filter(country => country !== selectedCountry && country !== d)
            .sort((a, b) => {
                const dx1 = a.centroid[0] - d.centroid[0];
                const dy1 = a.centroid[1] - d.centroid[1];
                const dx2 = b.centroid[0] - d.centroid[0];
                const dy2 = b.centroid[1] - d.centroid[1];
                return (dx1*dx1 + dy1*dy1) - (dx2*dx2 + dy2*dy2);
            });

        const coveredCountries = [d];
        let totalArea = hoverArea;
        
        for (const country of nearbyCountries) {
            if (Math.abs(totalArea - targetArea) <= AREA_TOLERANCE) break;
            if (totalArea >= targetArea + AREA_TOLERANCE) break;
            totalArea += country.area;
            coveredCountries.push(country);
        }

        while (totalArea > targetArea + AREA_TOLERANCE && coveredCountries.length > 1) {
            const last = coveredCountries.pop();
            totalArea -= last.area;
        }

        if (totalArea < targetArea - AREA_TOLERANCE) {
            for (const country of nearbyCountries) {
                if (coveredCountries.includes(country)) continue;
                if (totalArea + country.area <= targetArea + AREA_TOLERANCE) {
                    totalArea += country.area;
                    coveredCountries.push(country);
                }
            }
        }

        currentComparison = { 
            countries: coveredCountries,
            totalArea: totalArea,
            targetArea: targetArea,
            difference: Math.abs(totalArea - targetArea)
        };

        // Show equivalent areas on map
        equivalentGroup.selectAll(".equivalent-area")
            .data(coveredCountries)
            .enter()
            .append("path")
            .attr("class", "equivalent-area")
            .attr("d", path)
            .style("fill", "rgba(40, 167, 69, 0.5)")
            .style("stroke", "#000")
            .style("stroke-width", "1px")
            .style("opacity", 0)
            .transition()
            .duration(300)
            .style("opacity", 1);
    }
    
    updateLegend(selectedCountry, currentComparison, d.properties.name);

    // Add click handler for pausing
    currentElement.on("click", (event) => {
        event.stopPropagation(); // Prevent the regular click handler
        event.preventDefault();
        isHoverPaused = true;
        // Keep the current comparison state
        updateLegend(selectedCountry, currentComparison, d.properties.name);
    });
}

function handleMouseOut(event, d) {
    if (!selectedCountry || isHoverPaused) return;
    
    currentHoverCountry = null;
    const currentElement = d3.select(this);
    currentElement.classed("hover-country", false);
    // Remove the pause click handler
    currentElement.on("click", null);
    
    equivalentGroup.selectAll(".equivalent-area")
        .transition()
        .duration(300)
        .style("opacity", 0)
        .remove();
        
    updateLegend(selectedCountry);
}

function formatNumber(num) {
    return num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function updateLegend(d, covered = null, hoverCountryName = null) {
    const areaKm2 = d.properties.areaKm2;
    let content = `
        <h3>
            <span class="flag-icon flag-icon-${d.properties.code || 'xx'}"></span>
            ${d.properties.name}
        </h3>
        <p class="copyable"><strong>Area:</strong> ${formatNumber(areaKm2)} km²</p>
        <hr>
        <p class="hovering-country">Currently comparing: ${hoverCountryName || 'Hover over a country'}</p>
    `;

    if (!covered) {
        content += `
            <div class="comparison-box selected">
                <p>${isHoverPaused ? 'Click anywhere to resume' : 'Click while hovering to pause comparison'}</p>
            </div>
        `;
    } else if (covered.countries) {
        const totalCountries = covered.countries.length;
        const totalAreaKm2 = Math.round(covered.totalArea * 500);
        const targetAreaKm2 = Math.round(covered.targetArea * 500);
        const differenceKm2 = Math.abs(targetAreaKm2 - totalAreaKm2);
        
        content += `
            <div class="comparison-box hovering${isHoverPaused ? ' paused' : ''}">
                <h4>Combined Area Comparison${isHoverPaused ? ' (Paused)' : ''}</h4>
                <p class="copyable"><strong>Countries needed:</strong> ${totalCountries}</p>
                <p class="copyable"><strong>Target Area:</strong> ${formatNumber(targetAreaKm2)} km²</p>
                <p class="copyable"><strong>Combined Area:</strong> ${formatNumber(totalAreaKm2)} km²</p>
                <p class="copyable"><strong>Difference:</strong> ${formatNumber(differenceKm2)} km²</p>
            </div>
            <h4>Countries Combined:</h4>
            <ul>
                ${covered.countries.map(c => `
                    <li class="${c === currentHoverCountry ? 'highlight' : ''} copyable">
                        <span class="flag-icon flag-icon-${c.properties.code || 'xx'}"></span>
                        <span>${c.properties.name}</span>
                        <span style="margin-left: auto">${formatNumber(c.properties.areaKm2)} km²</span>
                    </li>
                `).join('')}
            </ul>
        `;
    } else if (covered.partial) {
        const { fitCount, smallAreaKm, largeAreaKm } = covered.partial;
        content += `
            <div class="comparison-box hovering${isHoverPaused ? ' paused' : ''}">
                <h4>Area Comparison${isHoverPaused ? ' (Paused)' : ''}</h4>
                <p class="copyable"><strong>${hoverCountryName}</strong>: ${formatNumber(largeAreaKm)} km²</p>
                <p class="copyable"><strong>${d.properties.name}</strong>: ${formatNumber(smallAreaKm)} km²</p>
                <p class="copyable fit-count"><strong>${formatNumber(fitCount)}</strong> ${d.properties.name}(s) can fit inside ${hoverCountryName}</p>
            </div>
        `;
    }
    
    d3.select("#legend").html(content);
}

function resetLegend() {
    d3.select("#legend").html(`
        <div class="comparison-box">
            <h3>No country selected</h3>
            <p>Click on a country to begin comparing areas</p>
        </div>
    `);
}

// Update reset functionality
d3.select("#resetMap").on("click", function() {
    // Clear all state variables
    selectedCountry = null;
    currentHoverCountry = null;
    isHoverPaused = false;
    
    // Clear all visual states from the map
    mapGroup.selectAll(".country")
        .classed("selected-country", false)
        .classed("hover-country", false)
        .style("fill", "#e0e0e0")  // Reset to default color
        .on("click", clicked)      // Reset event handlers
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut);
    
    // Clear all additional visual elements
    hoverGroup.selectAll("*").remove();
    equivalentGroup.selectAll("*").remove();
    
    // Clear any transitions
    d3.selectAll(".equivalent-area").interrupt();
    
    // Reset the legend
    resetLegend();
    
    // Force a redraw of the map
    mapGroup.selectAll(".country")
        .transition()
        .duration(300)
        .style("fill", "#e0e0e0");
});

// Modal handling
const modal = document.getElementById('instructionModal');
const learnButton = document.getElementById('learnButton');
const closeButton = modal.querySelector('.close-button');

function openModal() {
    modal.style.display = 'block';
    // Force reflow
    modal.offsetHeight;
    modal.classList.add('show');
}

function closeModal() {
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300); // Match the CSS transition duration
}

learnButton.addEventListener('click', openModal);
closeButton.addEventListener('click', closeModal);

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
        closeModal();
    }
}); 