import test from "node:test";
import assert from "node:assert/strict";
import { readWavPcmMetadata } from "../src/wav-pcm-metadata.js";

function makeWav({ sampleRate=22050, channels=1, bits=16, frames=2205, oddChunk=false }={}) {
  const align=channels*bits/8, dataSize=frames*align, extra=oddChunk?12:0;
  const riffSize=4+extra+8+16+8+dataSize;
  const buffer=new ArrayBuffer(riffSize+8), view=new DataView(buffer), bytes=new Uint8Array(buffer);
  const put=(o,s)=>[...s].forEach((c,i)=>view.setUint8(o+i,c.charCodeAt(0)));
  put(0,"RIFF"); view.setUint32(4,riffSize,true); put(8,"WAVE");
  let o=12;
  if(oddChunk){put(o,"JUNK");view.setUint32(o+4,3,true);bytes.set([1,2,3,0],o+8);o+=12;}
  put(o,"fmt ");view.setUint32(o+4,16,true);view.setUint16(o+8,1,true);
  view.setUint16(o+10,channels,true);view.setUint32(o+12,sampleRate,true);
  view.setUint32(o+16,sampleRate*align,true);view.setUint16(o+20,align,true);view.setUint16(o+22,bits,true);o+=24;
  put(o,"data");view.setUint32(o+4,dataSize,true);
  return buffer;
}

test("reads duration and PCM metadata",async()=>{
 const m=await readWavPcmMetadata(makeWav());
 assert.equal(m.sampleRate,22050);assert.equal(m.channels,1);assert.equal(m.bitsPerSample,16);
 assert.equal(m.durationMs,100);assert.equal(m.durationFrames,2205);
});
test("handles odd-sized RIFF chunks and typed-array views",async()=>{
 const wav=makeWav({oddChunk:true});const wrapped=new Uint8Array(wav.byteLength+4);
 wrapped.set(new Uint8Array(wav),2);
 assert.equal((await readWavPcmMetadata(wrapped.subarray(2,2+wav.byteLength))).durationMs,100);
});
test("accepts Blob input",async()=>{
 assert.equal((await readWavPcmMetadata(new Blob([makeWav()],{type:"audio/wav"}))).durationMs,100);
});
test("rejects malformed signature, truncation, unsupported PCM and inconsistent rates",async()=>{
 const bad=makeWav();new DataView(bad).setUint8(0,88);
 await assert.rejects(readWavPcmMetadata(bad),/signature/);
 await assert.rejects(readWavPcmMetadata(makeWav().slice(0,30)),/truncated/);
 const unsupported=makeWav();new DataView(unsupported).setUint16(20,3,true);
 await assert.rejects(readWavPcmMetadata(unsupported),/Unsupported WAV format/);
 const inconsistent=makeWav();new DataView(inconsistent).setUint32(28,1,true);
 await assert.rejects(readWavPcmMetadata(inconsistent),/byte rate or block alignment/);
});
test("rejects empty and frame-misaligned audio data",async()=>{
 await assert.rejects(readWavPcmMetadata(makeWav({frames:0})),/empty/);
 const malformed=makeWav();const v=new DataView(malformed);v.setUint32(40,1,true);v.setUint32(4,v.getUint32(4,true)-4408,true);
 await assert.rejects(readWavPcmMetadata(malformed),/aligned/);
});
test("rejects unsupported input types",async()=>{
 await assert.rejects(readWavPcmMetadata("not audio"),/must be a Blob/);
});
