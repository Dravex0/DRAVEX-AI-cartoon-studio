import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createVerifiedVoiceArtifactStore } from "../src/verified-voice-artifact.js";

function makeWav({ rate=22050, frames=2205 }={}) {
  const align=2, dataSize=frames*align, riffSize=4+8+16+8+dataSize;
  const buffer=new ArrayBuffer(riffSize+8), v=new DataView(buffer);
  const put=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  put(0,"RIFF");v.setUint32(4,riffSize,true);put(8,"WAVE");put(12,"fmt ");
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,rate,true);v.setUint32(28,rate*align,true);v.setUint16(32,align,true);v.setUint16(34,16,true);
  put(36,"data");v.setUint32(40,dataSize,true);
  // Non-zero PCM samples: this fixture represents actual sample data, not a zero-byte placeholder.
  new Uint8Array(buffer,44,dataSize).fill(7);
  return new Blob([buffer],{type:"audio/wav"});
}
function fixtureStore(){
 const records=new Map();
 return {
  records,
  put:async(hash,blob,metadata)=>{const record={audioHash:hash,blob,...metadata};records.set(hash,record);return record;},
  get:async hash=>records.get(hash)||null
 };
}

test("validates WAV bytes, computes SHA-256 and persists actual metadata",async()=>{
 const storage=fixtureStore(), blob=makeWav();
 const service=createVerifiedVoiceArtifactStore({storage,cryptoRef:webcrypto});
 const saved=await service.save({blob,filename:"hero.wav",engineUsed:"test-tts",expectedDurationMs:100,expectedSampleRate:22050});
 assert.match(saved.audioHash,/^[a-f0-9]{64}$/);
 assert.equal(saved.durationMs,100);assert.equal(saved.sampleRate,22050);
 assert.equal(saved.byteSize,blob.size);assert.equal(saved.record.filename,"hero.wav");
 assert.equal((await service.get(saved.audioHash)).blob.size,blob.size);
});
test("same bytes produce the same content hash",async()=>{
 const service=createVerifiedVoiceArtifactStore({storage:fixtureStore(),cryptoRef:webcrypto});
 const a=await service.save({blob:makeWav()});
 const b=await service.save({blob:makeWav()});
 assert.equal(a.audioHash,b.audioHash);
});
test("rejects provider metadata that disagrees with actual WAV",async()=>{
 const service=createVerifiedVoiceArtifactStore({storage:fixtureStore(),cryptoRef:webcrypto});
 await assert.rejects(service.save({blob:makeWav(),expectedDurationMs:900}),/duration does not match/);
 await assert.rejects(service.save({blob:makeWav(),expectedSampleRate:44100}),/sample rate does not match/);
});
test("rejects empty, non-WAV and malformed artifacts",async()=>{
 const service=createVerifiedVoiceArtifactStore({storage:fixtureStore(),cryptoRef:webcrypto});
 await assert.rejects(service.save({blob:new Blob([],{type:"audio/wav"})}),/empty/);
 await assert.rejects(service.save({blob:new Blob(["mp3"],{type:"audio/mpeg"})}),/Only PCM WAV/);
 await assert.rejects(service.save({blob:new Blob(["bad"],{type:"audio/wav"})}),/too small/);
});
test("requires storage and Web Crypto",()=>{
 assert.throws(()=>createVerifiedVoiceArtifactStore({storage:{}}),/storage adapter/);
 assert.throws(()=>createVerifiedVoiceArtifactStore({storage:fixtureStore(),cryptoRef:{}}),/Web Crypto/);
});
