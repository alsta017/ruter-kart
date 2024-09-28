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
let iconCache = {};

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
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function updateStops() {
    var currentZoom = map.getZoom();
    var minZoom = 14;

    if (currentZoom < minZoom) {
        markerGroup.clearLayers();
        markers = {};
        return;
    }

    var bounds = map.getBounds();
    var maximumLatitude = bounds.getNorthEast().lat;
    var maximumLongitude = bounds.getNorthEast().lng;
    var minimumLatitude = bounds.getSouthWest().lat;
    var minimumLongitude = bounds.getSouthWest().lng;

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

    try {
        let response = await fetch('https://api.entur.io/journey-planner/v3/graphql', {
            method: 'POST',
            headers: {
                'ET-Client-Name': 'alsta017-kart',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });

        let data = await response.json();
        let newMarkers = {};

        data.data.stopPlacesByBbox.forEach(stop => {
            if (!markers[stop.id]) {
                let customIcon = createCustomIcon(stop.transportMode);
                let marker = L.marker([stop.latitude, stop.longitude], { icon: customIcon }).addTo(markerGroup).on('click', () => {
                    stopInfoEl.innerHTML = `
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

        for (let id in markers) {
            if (!newMarkers[id]) {
                markerGroup.removeLayer(markers[id]);
            }
        }

        markers = newMarkers;
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to fetch stop places. Please try again later.');
    }
}

let debouncedUpdateStops = debounce(updateStops, 300);

map.on('move', debouncedUpdateStops);
map.on('zoom', debouncedUpdateStops);

map.on('click', () => {
    stopInfoEl.style.display = 'none';
});

updateStops();
