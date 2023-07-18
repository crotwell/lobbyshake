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
        <h5>Earthquakes across the world in the past 30 days</h5>
        <sp-station-quake-map id="globalmap" magScale="2"
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
        <img src="USCbox_color.png" id="explainbox"></img>
        <img src="USCbox_legend.svg" id="legendbox"></img>
      </div>
      </div>
    </div>
    <div id="debug">
    </div>
  </div>
  <div class="footer">
  <!--
    <button id="pause">Pause</button>
    <button id="disconnect">Disconnect</button>
    -->
    <span id="eeyoreurl"><a href="http://eeyore.seis.sc.edu/scsn/lobbyshake">http://eeyore.seis.sc.edu/scsn/lobbyshake</a></span>
    <span></span>
    <span id="spjs">Generated with <a href="https://github.com/crotwell/seisplotjs">Seisplotjs version <span id="sp_version">3</span></a>.</span>
    
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

  const allSta = Array.from(sp.stationxml.allStations(networkList));
  scMap.addStation(allSta);
  scMap.draw();
  globalMap.addStation(allSta);
  globalMap.draw();
  return networkList;
}).then(networkList => {
    showRealtime(networkList);
}).catch( function(error) {
  const div = document.querySelector('div#debug');
  div.innerHTML = `
    <p>Error loading data. ${error}</p>
  `;
  console.assert(false, error);
});

sp.usgsgeojson.loadMonthSummaryAll().then( quakeList => {
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

function isInSC(q) {
  return q.latitude > 32 && q.latitude < 35 && q.longitude > -84 && q.longitude < -78;
}

function reloadGlobal(elapsed) {
  console.log(`before reload global eq ${globalMap.quakeList.length}`);
  const quakeStart = sp.luxon.DateTime.utc().minus(sp.luxon.Duration.fromISO('P30D'));
  const scQuakeStart = sp.luxon.DateTime.utc().minus(sp.luxon.Duration.fromISO('P90D'));
  sp.usgsgeojson.loadHourSummarySignificant().then(hourQuakeList => {
    console.log(`load significant: ${hourQuakeList.length}`);
    let need_redraw = false;
    hourQuakeList.forEach(q => {
      let found = false;
      globalMap.quakeList.forEach( mapQuake => {
        if (q.publicId === mapQuake.publicId) {
          found = true;
        }
      });
      if ( ! found ) {
        globalMap.addQuake(q);
        need_redraw = true;
        console.log(`global adding quake: ${q.toString()}`)
      }
    });
    const beforeLength= globalMap.quakeList.length;
    globalMap.quakeList = globalMap.quakeList.filter(q => q.time > quakeStart);
    if (beforeLength !== globalMap.quakeList.length) {
      need_redraw = true;
    }
    if (need_redraw) {
      globalMap.draw();
    }
    console.log(`after reload global eq: ${hourQuakeList.length} ${globalMap.quakeList.length}`);
  });
  console.log(`before reload SC quakes:  ${scMap.quakeList.length}`);
  sp.usgsgeojson.loadHourSummaryAll().then(hourQuakeList => {
    console.log(`load SC hour ${hourQuakeList.length}`);
    let need_redraw = false;
    hourQuakeList
    .filter(isInSC)
    .forEach(q => {
      let found = false;
      scMap.quakeList.forEach( mapQuake => {
        if (q.publicId === mapQuake.publicId) {
          found = true;
        }
      });
      if ( ! found ) {
        scMap.addQuake(q);
        need_redraw = true;
        console.log(`sc adding quake: ${q.toString()}`)
      }
    });
    const beforeLength= scMap.quakeList.length;
    scMap.quakeList = scMap.quakeList.filter(q => q.time > scQuakeStart);
    if (beforeLength !== scMap.quakeList.length) {
      need_redraw = true;
    }
    if (need_redraw) {
      scMap.draw();
    }
    console.log(`after reload scMap eq: ${hourQuakeList.length} ${scMap.quakeList.length}`);
  });
};

reloadGlobal();
const eq_reload_interval = 10*60*1000; // 10 min?
let eq_reload_timer = window.setInterval(reloadGlobal, eq_reload_interval);
