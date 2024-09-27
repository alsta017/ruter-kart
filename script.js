let mapEl = document.getElementById("map");

// Create Leaflet map
let map = L.map('map').setView([59.91, 10.75], 13);

var markerGroup = L.layerGroup().addTo(map);

// Add MapTiler tiles and correct attribution
L.tileLayer('https://api.maptiler.com/maps/basic-v2-dark/{z}/{x}/{y}.png?key=0EfHAMqq8iHZOSlF3MU9', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors | <a href="https://maptiler.com/">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright">',
    maxZoom: 19
}).addTo(map);

function updateStops() {

    // Get current zoom level
    var currentZoom = map.getZoom();
    var minZoom = 14; // Set your minimum zoom level for displaying markers

    // Clear all markers before deciding to add them
    markerGroup.clearLayers();

    // Check if the zoom level is sufficient to load the markers
    if (currentZoom < minZoom) {
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
            markerGroup.clearLayers();
            for (let x = 0; x < data.data.stopPlacesByBbox.length; x++) {
                let stop = data.data.stopPlacesByBbox[x];
                L.marker([stop.latitude, stop.longitude]).addTo(markerGroup).bindPopup(
                    L.popup({
                        closeButton: false
                    }).setContent(
                        `<h3>${stop.name}</h3>`
                    )
                );
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Trigger marker update on move end and zoom end
map.on('moveend', updateStops);
map.on('zoomend', updateStops);

// Initial load of markers based on current zoom level
updateStops();