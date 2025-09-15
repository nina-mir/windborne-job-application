import { loadFiles } from './fileLoading.js'
import { createColorLegendBar } from './color_legend.js'

// Debug output element
const debugOutput = document.getElementById('debug-output');

// Set up SVG and dimensions
const svg = d3.select("svg");
const width = svg.node().getBoundingClientRect().width;
const height = svg.node().getBoundingClientRect().height;



// Create separate layers for different visual elements
const mapLayer = svg.append("g").attr("class", "map-layer");
const trajectoryLayer = svg.append("g").attr("class", "trajectory-layer");
// const altitudeLayer = svg.append("g").attr("class", "altitude-layer");

// ====================== Canvas related code ======================
// Get the container element that holds both SVG and canvas
const container = d3.select(".map-container");

// Add canvas element for Altitude rendering
const canvas = container
    .insert("canvas", "svg")
    .attr("width", width)
    .attr("height", height)
    .style("position", "absolute")
    .style("top", 0)
    .style("left", 0)
    .style("pointer-events", "none"); // Allow clicks to pass through to SVG

// Make sure the container has relative positioning
container.style("position", "relative");

const ctx = canvas.node().getContext("2d");

// =================== Canvas quality re: device Pixel ratio
// improve the canvas resolution for sharper rendering
function setupHighResCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const canvas = d3.select(".map-container canvas").node();

    // Set the actual size in pixels (double resolution)
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    // Normalize coordinate system to use CSS pixels
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    // Scale the context to ensure correct drawing operations
    ctx.scale(dpr, dpr);
}

// Call this after creating the canvas
setupHighResCanvas();


function clearTrajectories() {
    // Clear the global points data array
    window.altitudePointsData = [];
    
    // Clear the canvas (assumes you have a canvas context available)
    // You'll need to adjust this based on how you access your canvas
    const canvas = document.querySelector('canvas'); // or however you get your canvas
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// ==========================================================


// Custom color scale building
function cutomColorBuilder() {
    // Define your custom colors
    // Brown (low) → Gold → Sky blue → Light blue (high)
    const customColors = ["#2c1810", "#8b4513", "#daa520", "#87ceeb", "#f0f8ff"]

    // Create interpolator
    return d3.scaleLinear()
        .domain([0, 0.25, 0.5, 0.75, 1])
        .range(customColors)
        .interpolate(d3.interpolateHsl); // or d3.interpolateRgb
}

// Create a color scale for altitude
const colorScale = d3.scaleSequential(cutomColorBuilder())
    .domain([1, 25]); // Adjust based on your altitude range


// Create a projection
const projection = d3.geoEquirectangular()
    .scale(width / (2 * Math.PI))  // Adjusted scale calculation
    .translate([width / 2, height / 3]);

// Create a geo path generator
const path = d3.geoPath().projection(projection);

// zoom behavior to handle both SVG and canvas
const zoom = d3.zoom()
    .scaleExtent([0.1, 8])
    .on('zoom', (event) => {
        mapLayer.attr('transform', event.transform);
        trajectoryLayer.attr('transform', event.transform);
        // For canvas, we need to redraw everything with the new transform
        redrawCanvas(event.transform);
    });

// Apply zoom to the SVG
svg.call(zoom);

// Load the world map data
d3.json("https://raw.githubusercontent.com/janasayantan/datageojson/master/world.json")
    .then(function (data) {
        debugOutput.textContent = "Data loaded successfully. Rendering map...";

        // Draw the map layer
        mapLayer.selectAll("path")
            .data(data.features)
            .enter().append("path")
            .attr("d", path)
            .attr("fill", "gray")
            .attr("opacity", 0.5)
            .style("stroke", "black")
            .style("stroke-width", .35);

        debugOutput.textContent = "Map rendered successfully!";
        data = []
    })
    .catch(function (error) {
        debugOutput.textContent = "Error loading data: " + error;
        console.error("Error loading the GeoJSON data:", error);
    });


// handle graticule
let graticule = (path, lonStep = 10, latStep = 10) => {
    // Create graticule generator
    const graticule = d3.geoGraticule();
    graticule.step([lonStep, latStep])

    mapLayer.append("path")
        .datum(graticule)
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "#ccc")
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.5);
}

// call graticule
graticule(path)

// =================== handle getting data_files for trajectory and whatnot ===========


// Store balloons data globally so we can re-render when slider changes
let balloonsData = [];

loadFiles().then(data => {
    if (Array.isArray(data)) {
        let allTrajectories = Array.from({ length: 1000 }, (_, i) =>
            data.map(hourlySnapshot => hourlySnapshot[i])
        );

        // Initialize the points data array
        window.altitudePointsData = [];

        return allTrajectories;
    }
}).then(balloons => {
    // store data globally
    balloonsData = balloons
    //initial render with default value
    const slider = document.querySelector('#trajectorySlider')
    renderTrajectories(parseInt(slider.value));
    // Clear the data to free memory
    balloons = [];
});

function renderTrajectories(maxTrajectories) {
    // Clear existing data and canvas
    clearTrajectories();
    
    // Draw the specified number of trajectories
    for (let idx = 0; idx < Math.min(balloonsData.length, maxTrajectories); idx++) {
        renderTrajectory(balloonsData[idx], idx);
    }
}


// =============================CANVAS func =============================
// Function to redraw canvas elements used in Zoom function above
// Update redrawCanvas function to handle high DPI
function redrawCanvas(transform) {
    const dpr = window.devicePixelRatio || 1;

    // Clear canvas at the actual resolution
    ctx.clearRect(0, 0, width * dpr, height * dpr);

    // Reset transform and apply the new one
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Redraw all points
    if (window.altitudePointsData) {
        window.altitudePointsData.forEach(point => {
            drawCanvasPoint(point);
        });
    }
}

// Function to draw a single point on canvas
function drawCanvasPoint(point) {
    const [lat, lon, alt] = point;
    const normalizedLon = ((lon + 180) % 360 + 360) % 360 - 180;
    const [x, y] = projection([normalizedLon, lat]);

    // Get the exact color from color scale
    const color = colorScale(alt);

    ctx.beginPath();

    // Use a gradient for smoother circles
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 1.5);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, d3.color(color).brighter(0.8)); // Slight gradient for depth

    ctx.fillStyle = gradient;
    ctx.arc(x, y, 1., 0, 2 * Math.PI);
    ctx.fill();

    // Optional: Add a subtle outline for better definition
    ctx.strokeStyle = d3.color(color).darker(0.5);
    ctx.lineWidth = 0.3;
    ctx.stroke();
}
// =========================================

// function to render trajectory data
function renderTrajectory(trajectoryData, datasetIndex) {
    // Check if the trajectory crosses the antimeridian
    const crossesAntimeridian = trajectoryData.some((d, i, arr) => {
        if (i === 0) return false;
        return Math.abs(arr[i][1] - arr[i - 1][1]) > 180;
    });

    if (!crossesAntimeridian) {
        // Draw normal trajectory path
        // drawSinglePath(trajectoryData, datasetIndex);
        drawAltitudePoints(trajectoryData, datasetIndex);

    } else {
        // Split the path at the antimeridian
        const pathSegments = splitAtAntimeridian(trajectoryData);
        pathSegments.forEach(segment => {
            // drawSinglePath(segment, datasetIndex);
            drawAltitudePoints(segment, datasetIndex);

        });
    }
}

function drawSinglePath(segment, datasetIndex) {
    const lineGenerator = d3.line()
        .x(d => projection([d[1], d[0]])[0])
        .y(d => projection([d[1], d[0]])[1]);

    trajectoryLayer.append("path")
        .datum(segment)
        .attr("class", `trajectory-path dataset-${datasetIndex}`)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", 'black')
        .attr("stroke-width", 0.4)
        .attr("stroke-dasharray", "5 5");
}

function splitAtAntimeridian(data) {
    const segments = [];
    let currentSegment = [];

    for (let i = 0; i < data.length; i++) {
        if (i > 0 && Math.abs(data[i][1] - data[i - 1][1]) > 180) {
            // We've crossed the antimeridian, start a new segment
            if (currentSegment.length > 0) {
                segments.push(currentSegment);
            }
            currentSegment = [data[i]];
        } else {
            currentSegment.push(data[i]);
        }
    }

    if (currentSegment.length > 0) {
        segments.push(currentSegment);
    }

    return segments;
}


// ====================color Legend ==================
const legendContainer = d3.select(".altitude-legend");
createColorLegendBar(legendContainer.node(), colorScale, {
    width: 250,
    ticks: 6,
    title: "Balloon Altitude (km or miles!)"
});

// function drawAltitudePoints(segment, datasetIndex) {

//     // Draw points on altitude layer
//     altitudeLayer.selectAll(`circle.point.dataset-${datasetIndex}`)
//         .data(segment)
//         .enter().append("circle")
//         .attr("class", `point dataset-${datasetIndex}`)
//         .attr("cx", d => {
//             // Normalize longitude for proper positioning
//             const normalizedLon = ((d[1] + 180) % 360 + 360) % 360 - 180;
//             return projection([normalizedLon, d[0]])[0];
//         })
//         .attr("cy", d => projection([d[1], d[0]])[1])
//         .attr("r", 1) // Smaller points for better visibility with many trajectories
//         .attr("fill", d => colorScale(d[2]))
//         .attr("stroke", "none")
//         .attr("stroke-width", 0.1)
//         .style("opacity", 0.9) // Semi-transparent for overlapping points
//         .append("title")
//         .text(d => `Lat: ${d[0].toFixed(2)}°, Long: ${d[1].toFixed(2)}°, Alt: ${d[2].toFixed(2)}km`);
// }

// Replace your drawAltitudePoints function with this canvas version
function drawAltitudePoints(segment, datasetIndex) {
    // Store data for redrawing on zoom
    if (!window.altitudePointsData) {
        window.altitudePointsData = [];
    }

    // Add points to global collection
    segment.forEach(point => {
        window.altitudePointsData.push(point);
    });

    // Draw points on canvas
    segment.forEach(point => {
        drawCanvasPoint(point);
    });
}


// Button event listeners
document.getElementById('reset-btn').addEventListener('click', function () {
    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
    );
});

document.getElementById('zoom-in-btn').addEventListener('click', function () {
    svg.transition().duration(750).call(
        zoom.scaleBy,
        1.5
    );
});

document.getElementById('zoom-out-btn').addEventListener('click', function () {
    svg.transition().duration(750).call(
        zoom.scaleBy,
        0.75
    );
});

// Event listener for the slider
document.addEventListener('DOMContentLoaded', function() {
    const slider = document.getElementById('trajectorySlider');
    const valueDisplay = document.getElementById('trajectoryValue');
    
    slider.addEventListener('input', function() {
        const value = parseInt(this.value);
        valueDisplay.textContent = value;
        renderTrajectories(value);
    });
});

// Handle window resize
window.addEventListener('resize', () => {
    const newWidth = svg.node().getBoundingClientRect().width;
    const newHeight = svg.node().getBoundingClientRect().height;

    // Update canvas size
    canvas.attr("width", newWidth).attr("height", height);

    // Update projection
    projection
        .scale(newWidth / (2 * Math.PI))
        .translate([newWidth / 2, newHeight / 3]);

    // Redraw everything
    redrawCanvas(d3.zoomIdentity);
});
