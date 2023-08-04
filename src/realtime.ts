import * as sp from 'seisplotjs';
import {segmentToMinMax} from './minmax';
import {Interval, DateTime, Duration} from 'luxon';

const FORCE_EEYORE_DATALINK=false;

export let max_packets = 0; //10;

export let animationInterval = 1000; // default to once a second

export function showRealtime(networkList: Array<sp.stationxml.Network>) {
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


  let numPackets = 0;
  let paused = false;
  let stopped = true;
  let lastPacketTime = null;
  let redrawInProgress = false;
  let realtimeDiv = document.querySelector("div#realtime");

  const rtConfig = {
    duration: Duration.fromISO("PT1M"),
    alignmentTime: DateTime.utc(),
    offset: Duration.fromMillis(0),
    minRedrawMillis: 100,
    networkList: networkList
  };

  const rtDisp = sp.animatedseismograph.createRealtimeDisplay(rtConfig);
  rtDisp.organizedDisplay.tools = false;

  const seisPlotConfig = rtDisp.organizedDisplay.seismographConfig;
  seisPlotConfig.title = "Measuring our foot-quakes"
  seisPlotConfig.linkedAmplitudeScale = new sp.scale.FixedHalfWidthAmplitudeScale(1e-4);
  seisPlotConfig.yLabel = null;
  seisPlotConfig.ySublabelIsUnits = true;
  seisPlotConfig.doGain = true;
  seisPlotConfig.margin.left = 80;
  seisPlotConfig.margin.bottom = 40;
  rtDisp.organizedDisplay.addStyle(`
    sp-organized-display-item {
      height: 100%;
    }
    `);
  realtimeDiv.appendChild(rtDisp.organizedDisplay);

  rtDisp.organizedDisplay.draw();
  rtDisp.animationScaler.animate();

  let datalink = null;

  // give time for display to draw, then use pixels to get optimal redraw time
  setTimeout(() => {
    rtDisp.animationScaler.minRedrawMillis = sp.animatedseismograph.calcOnePixelTimeInterval(rtDisp.organizedDisplay);
    console.log(`min redraw millis= ${rtDisp.animationScaler.minRedrawMillis}`);
  }, 1000);

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

  const eeyoreWSS =
      "wss://eeyore.seis.sc.edu/intringserver/datalink";
  const eeyoreRing = "intringserver";
  let ring = "ringserver";
  if (window.location.host.startsWith("eeyore")) {
    ring = eeyoreRing;
  }
  let localDatalink = `ws://${window.location.host}/${ring}/datalink`
  let datalinkURL = localDatalink;
  if (FORCE_EEYORE_DATALINK) {
    console.log("##### EEYORE ####");
    datalinkURL = eeyoreWSS;
  }
  console.log(`Datalink url: ${datalinkURL}`);

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
    // trim old data
    const doubleDuration = rtDisp.config.duration.plus(rtDisp.config.duration);
    const timeWindow = new sp.util.durationEnd(doubleDuration, sp.luxon.DateTime.utc());
    sp.animatedseismograph.trim(rtDisp.organizedDisplay, timeWindow); // trim old data

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
      rtDisp.animationScaler.pause();
      const bPause = document.querySelector("button#pause");
      if (bPause) bPause.textContent = "Play";
    } else {
      rtDisp.animationScaler.animate();
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
    console.log(`toggle connect: ${stopped}`)
    stopped = ! stopped;
    if (stopped) {
      if (datalink) {
        datalink.close();
      }
      const bDisconnect = document.querySelector("button#disconnect");
      if (bDisconnect) bDisconnect.textContent = "Reconnect";
    } else {
      if (! datalink) {
        datalink = new sp.datalink.DataLinkConnection(
          datalinkURL,
          packet => {
            lastPacketTime = packet.packetEnd;
            //console.log(`${lastPacketTime.toISO()}  ${(DateTime.utc().diff(lastPacketTime).toISO())}  ${DateTime.utc().toISO()}`)
            rtDisp.packetHandler(packet);
          },
          errorFn
        );
      }
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
          const timeWindow = new sp.util.durationEnd(rtDisp.config.duration, sp.luxon.DateTime.utc());
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
