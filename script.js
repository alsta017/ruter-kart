let mapEl = document.getElementById("map");
let stopInfoEl = document.getElementById("stop-info");

// Create Leaflet map
let map = L.map('map').setView([59.91, 10.75], 15);
map.setMaxZoom(21);

var markerGroup = L.layerGroup().addTo(map);

const key = 'B38UkAr4o4dNX87Kc0VF';

// Add MapTiler tiles and correct attribution
L.maptilerLayer({
    apiKey: key,
    style: '26e8d7db-985a-4f4a-afb8-027e6cae2787' // update with your custom map ID
}).addTo(map);

let markers = {};
let iconCache = {};
let selectedMarker = null;
let selectedStopId = null; // Variable to store the currently selected stopId

function createCustomIcon(transportModes) {
    let key = transportModes.join('-');
    if (iconCache[key]) return iconCache[key];

    let iconHtml = transportModes.map(mode => `<img src="icons/${mode}.svg" class="transport-icon">`).join('');
    let customDiv = document.createElement('div');
    customDiv.className = 'custom-div';
    customDiv.innerHTML = iconHtml;

    document.body.appendChild(customDiv);
    let width = customDiv.offsetWidth;
    document.body.removeChild(customDiv);

    let icon = L.divIcon({
        html: `<div class="custom-div">${iconHtml}</div>`,
        className: '',
        iconSize: [width, 30],
        iconAnchor: [width / 2, 15]
    });

    iconCache[key] = icon;
    return icon;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Function to determine the background color based on line number
function getLineColor(line, authorityName) {

    // FIX LINE 300E / LINJER SOM SLUTTER PÅ B OG N SOM ER OVER 100!
    const exceptions = ["100", "110", "130", "140", "145", "300", "300E"];

    const exceptionsGreen = ["210B", "215B", "370B", "545B" , "560N", "240N", "250N", "500N", "540N"];

    // Non-Ruter lines
    if (authorityName !== "Ruter") {
        return "#9799a3"; // Gray for non-Ruter lines
    }

    if (exceptions.includes(line)) {
        return "#e60000"; // Red for exceptions
    }

    if (exceptionsGreen.includes(line)) {
        return "#75a300"; // Green for exceptions
    }

    // Check for night and replacement buses
    if (line.endsWith("N") || line.endsWith("B")) {
        return "#e60000"; // Red for night or replacement buses
    }
    
    // Determine color based on line number range
    const lineNumber = parseInt(line, 10);

    if (lineNumber >= 1 && lineNumber <= 9) return "#ec700c"; // Orange
    if (lineNumber >= 10 && lineNumber <= 19) return "#28a2f8"; // Blue
    if (lineNumber >= 20 && lineNumber <= 99) return "#e60000"; // Red
    if (lineNumber >= 100 && lineNumber <= 4000) return "#75a300"; // Green

    return "#cccccc"; // Default gray for undefined ranges
}

function updateStops() {
    const currentZoom = map.getZoom();
    const minZoom = 14;

    if (currentZoom < minZoom) {
        markerGroup.clearLayers();
        markers = {};
        if (selectedMarker) {
            selectedMarker.getElement().querySelector('.custom-div').classList.remove('selected-marker');
            selectedMarker = null;
            stopInfoEl.style.display = 'none';
        }
        return;
    }

    const bounds = map.getBounds();
    const maximumLatitude = bounds.getNorthEast().lat;
    const maximumLongitude = bounds.getNorthEast().lng;
    const minimumLatitude = bounds.getSouthWest().lat;
    const minimumLongitude = bounds.getSouthWest().lng;

    // GraphQL query
    const query = {
        query: `
        {
            stopPlacesByBbox(
                maximumLatitude: ${maximumLatitude}
                maximumLongitude: ${maximumLongitude}
                minimumLatitude: ${minimumLatitude}
                minimumLongitude: ${minimumLongitude}
            ) {
                id
                name
                latitude
                longitude
                transportMode
            }
        }
        `
    };

    // Fetch data using .then()
    fetch('https://api.entur.io/journey-planner/v3/graphql', {
        method: 'POST',
        headers: {
            'ET-Client-Name': 'alsta017-kart',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
    })
        .then(response => response.json())
        .then(data => {
            if (!data || !data.data || !data.data.stopPlacesByBbox) {
                console.error('Invalid API response:', data);
                return;
            }

            const newMarkers = {};

            // Iterate through stops
            for (let b = 0; b < data.data.stopPlacesByBbox.length; b++) {
                const stop = data.data.stopPlacesByBbox[b];

                if (!markers[stop.id]) {
                    const customIcon = createCustomIcon(stop.transportMode);

                    const marker = L.marker([stop.latitude, stop.longitude], { icon: customIcon })
                        .addTo(markerGroup)
                        .on('click', () => {
                            if (selectedMarker) {
                                selectedMarker.getElement().querySelector('.custom-div').classList.remove('selected-marker');
                            }

                            marker.getElement().querySelector('.custom-div').classList.add('selected-marker');
                            selectedMarker = marker;
                            selectedStopId = stop.id; // Update the selected stop ID

                            stopInfoEl.innerHTML = 'Loading...';
                            const stopInfoQuery = {
                                query: `
                                {
                                    stopPlace(id: "${selectedStopId}") {
                                        name
                                        transportMode
                                        quays {
                                            lines {
                                                publicCode
                                                authority {
                                                    name
                                                }
                                            }
                                        }
                                    }
                                }
                                `
                            };

                            fetch('https://api.entur.io/journey-planner/v3/graphql', {
                                method: 'POST',
                                headers: {
                                    'ET-Client-Name': 'alsta017-kart',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(stopInfoQuery)
                            })
                                .then(response => response.json())
                                .then(data => {
                                    if (!data || !data.data || !data.data.stopPlace) {
                                        console.error('Invalid API response:', data);
                                        return;
                                    }
                            
                                    const stopInfo = data.data.stopPlace;
                            
                                    stopInfoEl.innerHTML = ''; // Clear previous content
                            
                                    // Create and add stop name and transport icons
                                    let stopHeader = document.createElement('div');
                                    stopHeader.className = 'stop-header';
                            
                                    let stopNameEl = document.createElement('h2');
                                    stopNameEl.textContent = stopInfo.name;
                                    stopNameEl.style.color = 'white';
                                    stopHeader.appendChild(stopNameEl);
                            
                                    let stopIconsAll = document.createElement('div');
                                    stopIconsAll.className = 'stop-icons-all';
                            
                                    stopInfo.transportMode.forEach(mode => {
                                        const img = document.createElement('img');
                                        img.src = `icons/${mode}.svg`;
                                        img.alt = mode;
                                        img.className = 'transport-icon';
                                        stopIconsAll.appendChild(img);
                                    });
                            
                                    stopHeader.appendChild(stopIconsAll);
                                    stopInfoEl.appendChild(stopHeader);
                            
                                    // Collect and sort lines
                                    let stopInfoLines = [];
                                    stopInfo.quays.forEach(quay => {
                                        quay.lines.forEach(line => {
                                            stopInfoLines.push({
                                                code: line.publicCode,
                                                color: getLineColor(line.publicCode, line.authority.name), // Pass authority name
                                            });
                                        });
                                    });
                            
                                    stopInfoLines = [...new Set(stopInfoLines.map(l => l.code))]
                                        .map(code => stopInfoLines.find(l => l.code === code)) // Ensure unique lines with their colors
                                        .sort((a, b) => {
                                            const numA = parseInt(a.code, 10);
                                            const numB = parseInt(b.code, 10);
                                            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                                            return a.code.localeCompare(b.code, undefined, { numeric: true });
                                        });
                            
                                    // Create and add line divs
                                    let linesContainer = document.createElement('div');
                                    linesContainer.className = 'lines-container';
                            
                                    stopInfoLines.forEach(line => {
                                        let lineDiv = document.createElement('div');
                                        lineDiv.className = 'line';
                                        lineDiv.textContent = line.code; // Only display the line code
                                        lineDiv.style.backgroundColor = line.color; // Set background color dynamically
                                        linesContainer.appendChild(lineDiv);
                                    });
                            
                                    stopInfoEl.appendChild(linesContainer);
                                })
                                .catch(error => {
                                    console.error('Error fetching stop info:', error);
                                    alert('Failed to fetch stop info. Please try again later.');
                                });

                            stopInfoEl.style.display = 'flex';
                        });

                    newMarkers[stop.id] = marker;
                } else {
                    newMarkers[stop.id] = markers[stop.id];
                }
            }

            // Remove outdated markers
            for (let id in markers) {
                if (!newMarkers[id] && markerGroup.hasLayer(markers[id])) {
                    markerGroup.removeLayer(markers[id]);
                }
            }

            markers = newMarkers;
        })
        .catch(error => {
            console.error('Error fetching stop places:', error);
            alert('Failed to fetch stop places. Please try again later.');
        });
}

let debouncedUpdateStops = debounce(updateStops, 75);

map.on('move', debouncedUpdateStops);
map.on('zoom', debouncedUpdateStops);

map.on('click', () => {
    if (selectedMarker) {
        selectedMarker.getElement().querySelector('.custom-div').classList.remove('selected-marker');
        selectedMarker = null;
    }
    stopInfoEl.style.display = 'none';
});

updateStops();
