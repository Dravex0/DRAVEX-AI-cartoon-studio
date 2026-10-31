const MAX_WAV_CHUNKS = 256;

/** Read integer PCM WAV metadata without decoding or uploading audio. */
export async function readWavPcmMetadata(input) {
  let buffer;
  if (typeof Blob !== "undefined" && input instanceof Blob) buffer = await input.arrayBuffer();
  else if (input instanceof ArrayBuffer) buffer = input;
  else if (ArrayBuffer.isView(input)) buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  else throw new TypeError("WAV input must be a Blob, ArrayBuffer, or typed-array view.");

  if (buffer.byteLength < 12) throw new Error("WAV file is too small.");
  const view = new DataView(buffer);
  const fourCC = offset => String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
  if (fourCC(0) !== "RIFF" || fourCC(8) !== "WAVE") throw new Error("Invalid RIFF/WAVE signature.");

  const riffSize = view.getUint32(4, true);
  const riffEnd = riffSize + 8;
  if (riffSize < 4 || riffEnd > buffer.byteLength) throw new Error("WAV RIFF size is invalid or truncated.");

  let offset = 12, chunks = 0, format = null, dataSize = null;
  while (offset + 8 <= riffEnd) {
    if (++chunks > MAX_WAV_CHUNKS) throw new Error("WAV contains too many chunks.");
    const id = fourCC(offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8, end = start + size, paddedEnd = end + (size % 2);
    if (end > riffEnd || paddedEnd > riffEnd) throw new Error(`WAV chunk '${id}' exceeds RIFF boundaries.`);

    if (id === "fmt ") {
      if (format) throw new Error("WAV contains duplicate 'fmt ' chunks.");
      if (size < 16) throw new Error("WAV 'fmt ' chunk is shorter than 16 bytes.");
      const audioFormat = view.getUint16(start, true);
      const channels = view.getUint16(start + 2, true);
      const sampleRate = view.getUint32(start + 4, true);
      const byteRate = view.getUint32(start + 8, true);
      const blockAlign = view.getUint16(start + 12, true);
      const bitsPerSample = view.getUint16(start + 14, true);
      if (audioFormat !== 1) throw new Error(`Unsupported WAV format ${audioFormat}; only integer PCM is supported.`);
      if (channels < 1 || channels > 8) throw new Error("WAV channel count must be between 1 and 8.");
      if (sampleRate < 8000 || sampleRate > 384000) throw new Error("WAV sample rate is outside the supported range.");
      if (![8,16,24,32].includes(bitsPerSample)) throw new Error("Unsupported PCM bit depth.");
      const expectedAlign = channels * bitsPerSample / 8;
      if (blockAlign !== expectedAlign || byteRate !== sampleRate * blockAlign) throw new Error("WAV PCM byte rate or block alignment is inconsistent.");
      format = { audioFormat, channels, sampleRate, byteRate, blockAlign, bitsPerSample };
    } else if (id === "data") {
      if (dataSize !== null) throw new Error("WAV contains multiple 'data' chunks; segmented PCM is unsupported.");
      dataSize = size;
    }
    offset = paddedEnd;
  }

  if (offset !== riffEnd) throw new Error("WAV contains an incomplete trailing chunk header.");
  if (!format || dataSize === null) throw new Error("WAV must contain both 'fmt ' and 'data' chunks.");
  if (dataSize === 0) throw new Error("WAV audio data is empty.");
  if (dataSize % format.blockAlign !== 0) throw new Error("WAV data size is not aligned to complete PCM frames.");
  const durationMs = dataSize / format.byteRate * 1000;
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error("WAV duration could not be calculated.");
  return { ...format, dataSize, durationMs, durationFrames: dataSize / format.blockAlign, totalBytes: riffEnd };
}
