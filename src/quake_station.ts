// snip start map
import * as sp from 'seisplotjs';

export function loadStations() {
  const duration = sp.luxon.Duration.fromISO('P30D');
  const stationTimeWindow = new sp.util.durationEnd(duration, sp.luxon.DateTime.utc());
  let stationQuery = new sp.fdsnstation.StationQuery()
    .networkCode('CO')
    .locationCode('00')
    .channelCode('LH?')
    .timeRange(stationTimeWindow);

  let raspShakeQuery = new sp.fdsnstation.StationQuery()
    .host('data.raspberryshake.org')
    .networkCode('AM')
    .stationCode('R71D7')
    .locationCode('00')
    .channelCode('EH?')
    .timeRange(stationTimeWindow);
  // snip start promise
  let stationsPromise = stationQuery.queryChannels();
  //let raspShakePromise = raspShakeQuery.queryResponses();
  let raspShakePromise = sp.util.doFetchWithTimeout('AM.R71D7.staxml')
  .then(response => {
    if (response.status === 200) {
      return response.text();
    } else if (
      response.status === 204 || response.status === 404
    ) {
      return sp.fdsnstation.FAKE_EMPTY_XML;
    } else {
      throw new Error(`Status not successful: ${response.status}`);
    }
  }).then( rawXmlText => {
    const rawXml = new DOMParser().parseFromString(rawXmlText, "text/xml");
    return sp.stationxml.parseStationXml(rawXml);
  });
  return Promise.all( [stationsPromise, raspShakePromise])
  .then( ( [ networkList, raspShakeNetworkList ] ) => {
    const combineNetworkList = networkList.concat(raspShakeNetworkList);
    return combineNetworkList;
  });
}

export function loadQuakes(dur?: sp.luxon.Duration) {
  const duration = dur ? dur : sp.luxon.Duration.fromISO('P30D');
  let globalTimeWindow = new sp.util.durationEnd(duration, sp.luxon.DateTime.utc());
  let eventQuery = new sp.fdsnevent.EventQuery()
    .timeRange(globalTimeWindow)
    .minMag(6);
  return eventQuery.query();
}



export function loadSCEarthquakes(dur?: sp.luxon.Duration): Promise<Array<Quake>> {
  const EQ_URL = "https://eeyore.seis.sc.edu/scsn/sc_quakes/sc_quakes.xml"
  const duration = dur ? dur : sp.luxon.Duration.fromISO('P90D');
  let timeWindow = new sp.util.durationEnd(duration, sp.luxon.DateTime.utc());
  let fetchInit = sp.util.defaultFetchInitObj(sp.util.XML_MIME);
  return sp.util.doFetchWithTimeout(EQ_URL, fetchInit)
    .then(response => {
      if (response.status === 200) {
        return response.text();
      } else if (
        response.status === 204 ||
        (isDef(mythis._nodata) && response.status === mythis._nodata)
      ) {
        // 204 is nodata, so successful but empty
        return sp.fdsnevent.FAKE_EMPTY_XML;
      } else {
        throw new Error(`Status not successful: ${response.status}`);
      }
    })
    .then(function (rawXmlText) {
      return new DOMParser().parseFromString(rawXmlText, sp.util.XML_MIME);
    })
    .then(rawXml => {
          return sp.quakeml.parseQuakeML(rawXml).eventList;
    })
    .then(quakeList => {
      return quakeList.filter(q => timeWindow.contains(q.time));
    });
}
