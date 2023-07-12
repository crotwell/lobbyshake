import * as sp from 'seisplotjs';

export function segmentToMinMax(seg: sp.seismogramsegment.SeismogramSegment, decFac): SeismogramSegment {
  const data: Array<number> = [];
  let idx = 0;
  while (idx < seg.y.length) {
    let min = seg.y[idx];
    let max = min;
    for (let i=idx; i< seg.y.length && i < idx+decFac; i++) {
      const v = seg.y[i]
      if (v < min) { min = v; }
      if (v > max) { max = v; }
    }
    data.push(min);
    data.push(max);
    idx = idx+decFac;
  }
  return new sp.seismogramsegment.SeismogramSegment(data,
    seg.sampleRate/decFac*2,
    seg.startTime,
    seg.sourceId
  );
}
