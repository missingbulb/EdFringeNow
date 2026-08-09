// Minimal PNG codec for the requirements comparator — decode a Chromium
// screenshot into raw RGBA and encode a diff image back out, on node's built-in
// zlib alone. The repo ships no runtime dependencies, and the comparator needs
// exactly two operations: read pixels, write pixels. Supports what Chromium
// actually emits (8-bit RGB/RGBA, non-interlaced); anything else is an error,
// not a silent misread.
"use strict";

const zlib = require("node:zlib");

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decode(buffer) {
  if (!SIGNATURE.equals(buffer.subarray(0, 8))) throw new Error("not a PNG");
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  let pos = 8;
  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
  if (colorType !== 2 && colorType !== 6) throw new Error(`unsupported PNG color type ${colorType}`);
  if (interlace !== 0) throw new Error("interlaced PNG unsupported");

  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  const prior = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prior[x];
      const c = x >= channels ? prior[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      } else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
      line[x] = v;
    }
    line.copy(prior);
    for (let px = 0; px < width; px++) {
      const s = px * channels, d = (y * width + px) * 4;
      rgba[d] = line[s];
      rgba[d + 1] = line[s + 1];
      rgba[d + 2] = line[s + 2];
      rgba[d + 3] = channels === 4 ? line[s + 3] : 255;
    }
  }
  return { width, height, rgba };
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encode({ width, height, rgba }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Is this buffer an animated PNG (does it carry an `acTL` control chunk)?
// The pixel differ decodes only a still image, so the comparator asks first.
function isAnimated(buffer) {
  if (buffer.length < 8 || !SIGNATURE.equals(buffer.subarray(0, 8))) return false;
  let pos = 8;
  while (pos + 8 <= buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    if (type === "acTL") return true;
    if (type === "IDAT" || type === "IEND") return false; // acTL precedes IDAT
    pos += 12 + len;
  }
  return false;
}

/**
 * Encode frames as one APNG — a flow shown as a flow.
 *
 * APNG rather than GIF (the same choice ShoutsAndWhispers made for its sagas):
 * it is lossless, so the golden stays a faithful pixel record of the UI rather
 * than a 256-colour approximation of it, and every byte is ours, so the
 * comparison stays exact byte-identity. Frames must share one size; each
 * carries its own hold in milliseconds.
 *
 * @param {{rgba: Buffer, holdMs: number}[]} frames
 * @param {{width: number, height: number, loops?: number}} opts
 */
function encodeAnimated(frames, { width, height, loops = 0 }) {
  if (!frames.length) throw new Error("an animation needs at least one frame");

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  const actl = Buffer.alloc(8);
  actl.writeUInt32BE(frames.length, 0);
  actl.writeUInt32BE(loops, 4); // 0 = forever

  const stride = width * 4;
  const deflate = (rgba) => {
    const raw = Buffer.alloc(height * (stride + 1));
    for (let y = 0; y < height; y++) {
      rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    return zlib.deflateSync(raw, { level: 9 });
  };

  // A hold is sent as an exact fraction (ms / 1000) so no rounding creeps in.
  const fctl = (seq, holdMs) => {
    const b = Buffer.alloc(26);
    b.writeUInt32BE(seq, 0);
    b.writeUInt32BE(width, 4);
    b.writeUInt32BE(height, 8);
    b.writeUInt32BE(0, 12); // x offset
    b.writeUInt32BE(0, 16); // y offset
    b.writeUInt16BE(holdMs, 20); // delay numerator
    b.writeUInt16BE(1000, 22); // delay denominator
    b[24] = 0; // dispose: none — frames are full-size and opaque
    b[25] = 0; // blend: source — replace, never composite
    return b;
  };

  const out = [SIGNATURE, chunk("IHDR", ihdr), chunk("acTL", actl)];
  let seq = 0;
  frames.forEach((frame, i) => {
    out.push(chunk("fcTL", fctl(seq++, frame.holdMs)));
    const data = deflate(frame.rgba);
    if (i === 0) {
      // The first frame is the still image too, so a viewer that ignores
      // animation still shows the story's opening state.
      out.push(chunk("IDAT", data));
    } else {
      const fdat = Buffer.alloc(4 + data.length);
      fdat.writeUInt32BE(seq++, 0);
      data.copy(fdat, 4);
      out.push(chunk("fdAT", fdat));
    }
  });
  out.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(out);
}

module.exports = { decode, encode, encodeAnimated, isAnimated };
