let mapEl = document.getElementById("map");
let stopInfoEl = document.getElementById("stop-info");

// Create Leaflet map
let map = L.map('map').setView([59.91, 10.75], 13);

var markerGroup = L.layerGroup().addTo(map);

// Add MapTiler tiles and correct attribution
L.tileLayer('https://api.maptiler.com/maps/basic-v2-dark/{z}/{x}/{y}.png?key=0EfHAMqq8iHZOSlF3MU9', {
    attribution: 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors | <a href="https://maptiler.com/">© MapTiler</a><a href="https://www.openstreetmap.org/copyright">',
    maxZoom: 19
}).addTo(map);

let markers = {};

function createCustomIcon(transportModes) {
    let iconHtml = transportModes.map(mode => `<img src="icons/${mode}.svg" class="transport-icon">`).join('');
    let customDiv = document.createElement('div');
    customDiv.className = 'custom-div';
    customDiv.innerHTML = iconHtml;

    // Temporarily add the div to the body to calculate its width
    document.body.appendChild(customDiv);
    let width = customDiv.offsetWidth;
    document.body.removeChild(customDiv);

    return L.divIcon({
        html: `<div class="custom-div">${iconHtml}</div>`,
        className: '',  // Remove default class
        iconSize: [width, 30],
        iconAnchor: [width / 2, 15]  // Adjust the anchor to the center of the icon
    });
}

function updateStops() {
    // Get current zoom level
    var currentZoom = map.getZoom();
    var minZoom = 14; // Set your minimum zoom level for displaying markers

    // Check if the zoom level is sufficient to load the markers
    if (currentZoom < minZoom) {
        markerGroup.clearLayers();
        markers = {};
        return;  // Don't fetch markers if the zoom level is below the minimum
    }

    // Get map bounds (Where the user currently is on the map)
    var bounds = map.getBounds();
    var maximumLatitude = bounds.getNorthEast().lat;
    var maximumLongitude = bounds.getNorthEast().lng;
    var minimumLatitude = bounds.getSouthWest().lat;
    var minimumLongitude = bounds.getSouthWest().lng;

    // Create query with map bounds for Entur API
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

    // Send query to Entur API
    fetch('https://api.entur.io/journey-planner/v3/graphql', {
        method: 'POST',
        headers: {
            'ET-Client-Name': 'alsta017-kart',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)  // Simply pass the query object as a JSON string
    })
        .then(response => response.json())
        .then(data => {
            console.log(data);  // Handle your API response here
            let newMarkers = {};

            data.data.stopPlacesByBbox.forEach(stop => {
                if (!markers[stop.id]) {
                    let customIcon = createCustomIcon(stop.transportMode);  // Create the custom icon
                    let marker = L.marker([stop.latitude, stop.longitude], { icon: customIcon }).addTo(markerGroup).on('click', () => {
                        document.getElementById('stop-info').innerHTML = `
                            <h3>${stop.name}</h3>
                            <p>Transport Modes: ${stop.transportMode.join(', ')}</p>
                        `;
                        stopInfoEl.style.display = 'flex';
                    });
                    newMarkers[stop.id] = marker;
                } else {
                    newMarkers[stop.id] = markers[stop.id];
                }
            });

            // Remove markers that are no longer in the current view
            for (let id in markers) {
                if (!newMarkers[id]) {
                    markerGroup.removeLayer(markers[id]);
                }
            }

            markers = newMarkers;
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to fetch stop places. Please try again later.');
        });
}

// Trigger marker update on move end and zoom end
map.on('move', updateStops);
map.on('zoom', updateStops);

// Hide stop-info when clicking on the map
map.on('click', () => {
    stopInfoEl.style.display = 'none';
});

// Initial load of markers based on current zoom level
updateStops();