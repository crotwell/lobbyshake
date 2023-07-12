import * as sp from 'seisplotjs';
import {segmentToMinMax} from './minmax';

export let max_packets = 0; //10;

export let animationInterval = 1000; // default to once a second

export function showRealtime(networkList: Array<sp.stationxml.Network>) {
  // snip start vars
  //const sta = "BIRD";
  const sta = "R71D7"
  let net;
  let band;
  if (sta === "R71D7") {
          net = "AM";
          band = "E"
  } else {
          net = "CO";
          band = "H"
  }

  const matchPattern = `${net}_${sta}_00_${band}HN/MSEED`;
  const duration = sp.luxon.Duration.fromISO('PT1M');
  const timeWindow = new sp.util.durationEnd(duration, sp.luxon.DateTime.utc());
  const seisPlotConfig = new sp.seismographconfig.SeismographConfig();
  seisPlotConfig.title = "Measuring our foot-quakes"
  seisPlotConfig.wheelZoom = false;
  seisPlotConfig.isYAxisNice = false;
  seisPlotConfig.linkedTimeScale.offset = sp.luxon.Duration.fromMillis(-1*duration.toMillis());
  seisPlotConfig.linkedTimeScale.duration = duration;
  seisPlotConfig.linkedAmplitudeScale = new sp.scale.FixedHalfWidthAmplitudeScale(1e-4);
  seisPlotConfig.yLabel = null;
  seisPlotConfig.ySublabelIsUnits = true;
  seisPlotConfig.doGain = true;
  seisPlotConfig.margin.left = 80;
  seisPlotConfig.margin.bottom = 40;
  let graphList = new Map();
  let anGraphList = new Map();
  let numPackets = 0;
  let paused = false;
  let stopped = true;
  let lastPacketTime = null;
  let redrawInProgress = false;
  let realtimeDiv = document.querySelector("div#realtime");
  let rect = realtimeDiv.getBoundingClientRect();
  let timerInterval = duration.toMillis()/
                      ((rect.width-seisPlotConfig.margin.left-seisPlotConfig.margin.right));
  while (timerInterval < 50) { timerInterval *= 2;}
  animationInterval = timerInterval;

  const errorFn = function(error) {
    console.assert(false, error);
    addToDebug("Error: "+error);
    forceReconnect();
  };

  const forceReconnect = function() {
      stopped = true;
      try {
        if (datalink) {
          datalink.close();
        }
      } catch (error) {
        console.error(`error close datalink: ${error}`);
      }
      setTimeout(() => {if (stopped) {toggleConnect();}});
  };

  // snip start handle
  const packetHandler = function(packet) {
    if (packet.isMiniseed()) {
      numPackets++;
      lastPacketTime = sp.luxon.DateTime.utc();
      let seisSegment = sp.miniseed.createSeismogramSegment(packet.asMiniseed());
      //seisSegment = segmentToMinMax(seisSegment, 10);
      const codes = seisSegment.codes();
      let seisPlot = graphList.get(codes);
      if ( ! seisPlot) {
          let seismogram = new sp.seismogram.Seismogram( [ seisSegment ]);
          //seismogram = sp.filter.rMean(seismogram);
          let seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
          seisData.alignmentTime = sp.luxon.DateTime.utc();
          seisData.associateChannel(networkList);
          seisPlot = new sp.seismograph.Seismograph([seisData], seisPlotConfig);
          realtimeDiv.appendChild(seisPlot);
          graphList.set(codes, seisPlot);
          const anSeis = new sp.animatedseismograph.AnimatedSeismograph(seisPlot);
          anSeis.animate();
          anGraphList.set(codes, anSeis);
        } else {
          let sdd = seisPlot.seisData[0];
          sdd.append(seisSegment);
          anGraphList.get(codes).clearImageCache();
          let seis = sdd.seismogram;
          const doubleDuration = duration.plus(duration);
          const timeWindow = new sp.util.durationEnd(doubleDuration, sp.luxon.DateTime.utc());
          seis = seis.trim(timeWindow); // trim old data
          //seis = sp.filter.rMean(seis);
          sdd.seismogram = seis;
          seisPlot.recheckAmpScaleDomain();
        }
        seisPlot.draw();
        if (max_packets > 0 && numPackets > max_packets) {
          toggleConnect();
          togglePause();
        }
    }
  };
  const logPacketHandler = function(packet) {
    try {
      packetHandler(packet);
    } catch (error) {
      console.error(`error datalink packet handler: ${error}`);
      forceReconnect();
    }
  };

  // snip start datalink
  // wss://thecloud.seis.sc.edu/ringserver/datalink
  // wss://rtserve.iris.washington.edu/datalink
  const eeyoreWSS =
      "wss://eeyore.seis.sc.edu/intringserver/datalink";
  const eeyoreRing = "intringserver";
  let ring = "ringserver";
  if (window.location.host.startsWith("eeyore")) {
    ring = eeyoreRing;
  }
  let localDatalink = `ws://${window.location.host}/${ring}/datalink`
  let datalinkURL = localDatalink;
  if (false) {
    console.log("##### EEYORE ####");
    datalinkURL = eeyoreWSS;
  }
  const datalink = new sp.datalink.DataLinkConnection(
      datalinkURL,
      packetHandler,
      errorFn);

  // snip start timer
  let timer = window.setInterval(function(elapsed) {
    if ( paused || stopped) {
      return;
    }
    if (lastPacketTime) {
      if (lastPacketTime.diffNow().toMillis() > 30*1000) {
        forceReconnect();
      }
    }

  }, 10*1000);

  // snip start pause
  const bPause = document.querySelector("button#pause");
  if (bPause) {
    bPause.addEventListener("click", function(evt) {
      togglePause( );
    });
  }
  let togglePause = function() {
    paused = ! paused;
    if (paused) {
      anGraphList.forEach(function(anSeis, key) {
        anSeis.pause();
      });
      const bPause = document.querySelector("button#pause");
      if (bPause) bPause.textContent = "Play";
    } else {
      anGraphList.forEach(function(anSeis, key) {
        anSeis.animate();
      });
      const bPause = document.querySelector("button#pause");
      if (bPause) bPause.textContent = "Pause";
    }
  }

  // snip start disconnet
  const bDisconnect = document.querySelector("button#disconnect");
  if (bDisconnect) bDisconnect.addEventListener("click", function(evt) {
    toggleConnect();
  });

  function addToDebug(message) {
    const debugDiv = document.querySelector("div#debug");
    if (!debugDiv) { return; }
    const pre = debugDiv.appendChild(document.createElement("pre"));
    const code = pre.appendChild(document.createElement("code"));
    code.textContent = message;
  }

  let toggleConnect = function() {
    stopped = ! stopped;
    if (stopped) {
      if (datalink) {
        datalink.close();
      }
      const bDisconnect = document.querySelector("button#disconnect");
      if (bDisconnect) bDisconnect.textContent = "Reconnect";
    } else {
      if (datalink) {
        datalink.connect()
        .then(serverId => {
          addToDebug(`id response: ${serverId}`);
          addToDebug(`send match: ${matchPattern}`)
          return datalink.match(matchPattern);
        }).then(response => {
          addToDebug(`match response: ${response}`)
          if (response.isError()) {
            addToDebug(`response is not OK, ignore... ${response}`);
          }
          return datalink.infoStatus();
        }).then(response => {
          addToDebug(`info status response: ${response}`);
          return datalink.infoStreams();
        }).then(response => {
          addToDebug(`info streams response: ${response}`)
          return datalink.positionAfter(timeWindow.start);
        }).then(response => {
          if (response.isError()) {
            addToDebug(`Oops, positionAfter response is not OK, ignore... ${response}`);
            // bail, ignore, or do something about it...
          }
          return datalink.stream();
        }).catch( function(error) {
          let errMsg = `${error}`;
          if (error.cause && error.cause instanceof sp.datalink.DataLinkResponse) {
            errMsg = `${error}, ${errMsg.cause}`;
          }
          addToDebug("Error: " +errMsg);
          console.assert(false, error);
        });
      }
      const bDisconnect = document.querySelector("button#disconnect");
      if (bDisconnect) bDisconnect.textContent = "Disconnect";
    }
  }
  // snip start go
  toggleConnect();

}
