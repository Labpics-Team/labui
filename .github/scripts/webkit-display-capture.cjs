const WIDTH = 640;
const HEIGHT = 480;
const SIZE = 16;
const MARKERS = [
  { x: 12, y: 12, rgb: [255, 0, 0] },
  { x: 612, y: 12, rgb: [0, 255, 0] },
  { x: 12, y: 452, rgb: [0, 0, 255] },
  { x: 612, y: 452, rgb: [255, 255, 0] },
];
const STATE = { x: 12, y: 232, on: [255, 0, 255], off: [0, 255, 255] };
const ROI = { x: 224, y: 184, width: 128, height: 64 };
const COLORS = [
  [224, 83, 131],
  [70, 195, 221],
];
const near = (data, offset, color, tolerance = 20) =>
  color.every((value, channel) => Math.abs(data[offset + channel] - value) <= tolerance);

function components(image, color) {
  const { width, height, data } = image;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const found = [];
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || !near(data, start * 4, color)) continue;
    let count = 0;
    let read = 0;
    let write = 1;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    queue[0] = start;
    visited[start] = 1;
    while (read < write) {
      const index = queue[read++];
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      count++;
      for (const next of [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
      ]) {
        if (next < 0 || visited[next] || !near(data, next * 4, color)) continue;
        visited[next] = 1;
        queue[write++] = next;
      }
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w >= 15 && h >= 15 && w <= 80 && h <= 80 && count / (w * h) > 0.9)
      found.push({ x: minX, y: minY, width: w, height: h });
  }
  return found;
}

function analyze(image, filter) {
  try {
    const matches = MARKERS.map((marker) => components(image, marker.rgb));
    if (matches.some((list) => list.length !== 1))
      return {
        valid: false,
        reason: 'Missing or ambiguous viewport markers',
        markerCounts: matches.map((list) => list.length),
      };
    const boxes = matches.map((list) => list[0]);
    const sx = (boxes[1].x - boxes[0].x) / 600;
    const sy = (boxes[2].y - boxes[0].y) / 440;
    if (sx < 0.9 || sx > 4 || Math.abs(sx - sy) > 0.02 * sx)
      return { valid: false, reason: 'Nonuniform viewport scale', sx, sy };
    const origin = { x: boxes[0].x - 12 * sx, y: boxes[0].y - 12 * sy };
    if (
      boxes.some(
        (box, i) =>
          Math.abs(box.x - origin.x - MARKERS[i].x * sx) > 2 ||
          Math.abs(box.y - origin.y - MARKERS[i].y * sy) > 2 ||
          Math.abs(box.width - SIZE * sx) > 2 ||
          Math.abs(box.height - SIZE * sy) > 2,
      )
    )
      return { valid: false, reason: 'Viewport corner geometry is inconsistent', boxes, sx, sy };
    const rect = {
      x: Math.round(origin.x + ROI.x * sx),
      y: Math.round(origin.y + ROI.y * sy),
      width: Math.round(ROI.width * sx),
      height: Math.round(ROI.height * sy),
    };
    if (
      rect.x < 0 ||
      rect.y < 0 ||
      rect.x + rect.width > image.width ||
      rect.y + rect.height > image.height
    )
      return { valid: false, reason: 'Viewport ROI extends outside the captured display', rect };
    const stateX = Math.round(origin.x + (STATE.x + SIZE / 2) * sx);
    const stateY = Math.round(origin.y + (STATE.y + SIZE / 2) * sy);
    if (
      !near(
        image.data,
        (stateY * image.width + stateX) * 4,
        filter === 'none' ? STATE.off : STATE.on,
      )
    )
      return {
        valid: false,
        reason: 'Display has a stale or occluded state marker',
        origin,
        sx,
        sy,
      };
    const mean = [0, 0, 0];
    const palette = [0, 0];
    const step = Math.round(8 * sx);
    let sum = 0;
    for (let y = 0; y < rect.height; y++)
      for (let x = 0; x < rect.width; x++) {
        const offset = ((rect.y + y) * image.width + rect.x + x) * 4;
        for (let c = 0; c < 3; c++) {
          mean[c] += image.data[offset + c];
          if (x + step < rect.width)
            sum += Math.abs(image.data[offset + c] - image.data[offset + step * 4 + c]);
        }
        for (let c = 0; c < 2; c++) if (near(image.data, offset, COLORS[c], 24)) palette[c]++;
      }
    const pixels = rect.width * rect.height;
    const meanRgb = mean.map((value) => value / pixels);
    const paletteFractions = palette.map((value) => value / pixels);
    const signal = sum / ((rect.width - step) * rect.height * 3);
    const meanMatches = meanRgb.every(
      (value, i) => Math.abs(value - (COLORS[0][i] + COLORS[1][i]) / 2) < 24,
    );
    const offValid =
      filter !== 'none' ||
      (signal > 8 && paletteFractions.every((value) => value > 0.35 && value < 0.65));
    return {
      valid: meanMatches && offValid,
      reason: !meanMatches
        ? 'ROI colors do not match the known surface'
        : !offValid
          ? 'Off frame does not expose both known pattern colors'
          : null,
      signal,
      meanRgb,
      paletteFractions,
      origin,
      sx,
      sy,
      rect,
      image: { width: image.width, height: image.height },
    };
  } catch (error) {
    return { valid: false, reason: String(error) };
  }
}

module.exports = { WIDTH, HEIGHT, SIZE, MARKERS, STATE, ROI, COLORS, analyze };
