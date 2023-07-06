import * as sp from 'seisplotjs';

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
  seisPlotConfig.wheelZoom = false;
  seisPlotConfig.isYAxisNice = false;
  seisPlotConfig.linkedTimeScale.offset = sp.luxon.Duration.fromMillis(-1*duration.toMillis());
  seisPlotConfig.linkedTimeScale.duration = duration;
  seisPlotConfig.linkedAmplitudeScale = new sp.scale.FixedHalfWidthAmplitudeScale(1e-4);
  seisPlotConfig.yLabel = null;
  seisPlotConfig.ySublabelIsUnits = true;
  seisPlotConfig.doGain = true;
  seisPlotConfig.margin.left = 80;
  let graphList = new Map();
  let numPackets = 0;
  let paused = false;
  let stopped = true;
  let redrawInProgress = false;
  let realtimeDiv = document.querySelector("div#realtime");
  let rect = realtimeDiv.getBoundingClientRect();
  let timerInterval = duration.toMillis()/
                      ((rect.width-seisPlotConfig.margin.left-seisPlotConfig.margin.right)*5);
  while (timerInterval < 50) { timerInterval *= 2;}


  const errorFn = function(error) {
    console.assert(false, error);
    if (datalink) {datalink.close();}
    addToDebug("Error: "+error);
  };

  // snip start handle
  const packetHandler = function(packet) {
    if (packet.isMiniseed()) {
      numPackets++;
      let seisSegment = sp.miniseed.createSeismogramSegment(packet.asMiniseed());
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
        } else {
          let sdd = seisPlot.seisData[0];
          sdd.append(seisSegment);

          let seis = sdd.seismogram;
          const timeWindow = new sp.util.durationEnd(duration, sp.luxon.DateTime.utc());
          seis.trim(timeWindow); // trim old data
          //seis = sp.filter.rMean(seis);
          sdd.seismogram = seis;
          seisPlot.recheckAmpScaleDomain();
        }
        seisPlot.draw();
    }
  };
  // snip start datalink
  // wss://thecloud.seis.sc.edu/ringserver/datalink
  // wss://rtserve.iris.washington.edu/datalink
  const datalink = new sp.datalink.DataLinkConnection(
      "wss://eeyore.seis.sc.edu/intringserver/datalink",
      packetHandler,
      errorFn);

  // snip start timer
  let timer = window.setInterval(function(elapsed) {
    if ( paused || redrawInProgress) {
      return;
    }
    redrawInProgress = true;
    window.requestAnimationFrame(timestamp => {
      try {
        const now = sp.luxon.DateTime.utc();
        graphList.forEach(function(graph, key) {
          graph.seisData.forEach(sdd => {
            sdd.alignmentTime = now;
          });
          graph.calcTimeScaleDomain();
          graph.calcAmpScaleDomain();
          graph.draw();
        });
      } catch(err) {
        console.assert(false, err);
      }
      redrawInProgress = false;
    });

    }, timerInterval);

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
      const bPause = document.querySelector("button#pause");
      if (bPause) bPause.textContent = "Play";
    } else {
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
        datalink.endStream();
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
