import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { showRealtime } from './realtime.ts'
import {loadQuakes, loadStations, loadSCEarthquakes} from './quake_station.ts';

import * as sp from 'seisplotjs';
const qsmap = new sp.leafletutil.QuakeStationMap();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="header">
    <h1>SEOE Lobby Shakes...</h1>
  </div>
  <div class="content">
    <div id="thegrid">
      <div id="realtime" class="realtime">
      </div>
      <div>
        <sp-station-quake-map id="scmap" centerLat="34.1" centerLon="-80.25" zoomLevel="7"></sp-station-quake-map>
      </div>
      <div>
        <sp-station-quake-map id="globalmap" maxZoom="2" zoomLevel="1" fitBounds="false"></sp-station-quake-map>
      </div>
      <div id="explain">
        <p>Hear ye, hear ye. Stuff shalt be told unto ye...
        </p>
      </div>

    </div>
    <div id="debug">
    </div>
  </div>
  <div class="footer">
    <h3><a href="http://eeyore.seis.sc.edu/scsn/lobbyshake">http://eeyore.seis.sc.edu/scsn/lobbyshake</a></h3>
  </div>
`

const mapList = document.querySelectorAll('sp-station-quake-map');
mapList.forEach( map => {
  map.fitBounds = false;
  console.log(map.quakeList.length)
  map.draw();
});

const scMap = document.querySelector('sp-station-quake-map#scmap');
const globalMap = document.querySelector('sp-station-quake-map#globalmap');
globalMap.fitBounds = false;

loadStations().then( networkList => {
  for (const s of sp.stationxml.allStations(networkList)) {
    console.log(s);
  }
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

}).catch( function(error) {
  const div = document.querySelector('div#debug');
  div.innerHTML = `
    <p>Error loading data. ${error}</p>
  `;
  console.assert(false, error);
});
