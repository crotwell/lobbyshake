import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { showRealtime } from './realtime.ts'
import {loadQuakes, loadStations, loadSCEarthquakes} from './quake_station.ts';
import * as L from "leaflet";

import * as sp from 'seisplotjs';
const qsmap = new sp.leafletutil.QuakeStationMap();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="header">
    <span><img class="logo" src="seoelogo.png" alt="SEOE Logo"/></span>
    <span><h1>SEOE Lobby Shakes...</h1></span>
  </div>
  <div class="content">
    <div id="thegrid">
      <div id="toprow">
      <div id="realtime" class="realtime">
      </div>
      <div class="globalmap">
        <h5>Earthquakes across the world in the past X days</h5>
        <sp-station-quake-map id="globalmap"
        centerLon="-80.25" centerLat="0" maxZoom="3" zoomLevel="2"
        fitBounds="false">
        </sp-station-quake-map>
      </div>
      </div>
      <div id="botrow">
      <div id="scmap">
        <h5>Earthquakes in South Carolina in the past 90 days</h5>
        <sp-station-quake-map id="scmap"
          centerLat="33.9" centerLon="-80.3" zoomLevel="6"
          tileUrl="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          tileAttribution="OpenStreetMap"
          >
        </sp-station-quake-map>
      </div>
      <div id="explain">
        <img src="USCbox.svg" id="explainbox"></img>
        <img src="USCbox_legend.svg" id="legendbox"></img>
      </div>
      </div>
    </div>
    <div id="debug">
    </div>
  </div>
  <div class="footer">
    <button id="pause">Pause</button>
    <button id="disconnect">Disconnect</button>
    <h3><a href="http://eeyore.seis.sc.edu/scsn/lobbyshake">http://eeyore.seis.sc.edu/scsn/lobbyshake</a></h3>
    <h5>Generated with <a href="https://github.com/crotwell/seisplotjs">Seisplotjs version <span id="sp_version">3</span></a>.</h5>
  </div>
`

const verEl = document.querySelector('#sp_version');
if (verEl) { verEl.textContent = sp.version; console.log(`SeisplotJS version: ${sp.version}`);}

const mapList = document.querySelectorAll('sp-station-quake-map');
mapList.forEach( map => {
  map.fitBounds = false;
  console.log(map.quakeList.length)
  map.draw();
});

const scMap = document.querySelector('sp-station-quake-map#scmap');

const globalMap = document.querySelector('sp-station-quake-map#globalmap');
globalMap.fitBounds = false;

scMap.onRedraw = scMap => {
  const legend = L.control({position: 'bottomleft'});
  legend.onAdd = map => {
    console.log(`###### add legend to map`)
    const div = document.createElement("div");
    div.setAttribute("class", "legend");
    const h3 = document.createElement("h3");
    h3.textContent = "Hi";
    div.appendChild(h3);
    return div;
  };
  legend.addTo(scMap.map);
  console.log("redraw with legend")
  }

loadStations().then( networkList => {
  showRealtime(networkList)

  const allSta = Array.from(sp.stationxml.allStations(networkList));
  scMap.addStation(allSta);
  scMap.draw();
  globalMap.addStation(allSta);
  globalMap.draw();
}).catch( function(error) {
  const div = document.querySelector('div#debug');
  div.innerHTML = `
    <p>Error loading data. ${error}</p>
  `;
  console.assert(false, error);
});

loadQuakes().then( quakeList => {
  globalMap.addQuake(quakeList);
  globalMap.draw();

}).catch( function(error) {
  const div = document.querySelector('div#debug');
  div.innerHTML = `
    <p>Error loading data. ${error}</p>
  `;
  console.assert(false, error);
});

loadSCEarthquakes().then( quakeList => {
  scMap.addQuake(quakeList);
  scMap.draw();
  return scMap;

}).catch( function(error) {
  const div = document.querySelector('div#debug');
  div.innerHTML = `
    <p>Error loading data. ${error}</p>
  `;
  console.assert(false, error);
});
