import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSceneVideoMotion, captureSceneVideoFrameSamples } from "../src/scene-motion-analysis.js";
class FakeVideo extends EventTarget {
  constructor() { super(); this.duration=4; this.videoWidth=640; this.readyState=2; this.currentTime=0; this.paused=true; this.seeking=false; this.error=null; }
  pause() { this.paused=true; }
  play() { this.paused=false; return Promise.resolve(); }
  set currentTime(value) { this._currentTime=value; this.seeking=false; queueMicrotask(()=>this.dispatchEvent(new Event("seeked"))); }
  get currentTime() { return this._currentTime || 0; }
}
function makeCanvasFactory(video, moving) {
  return () => {
    const context = {
      drawImage() {},
      getImageData(_x,_y,width,height) {
        const data=new Uint8ClampedArray(width*height*4);
        const level=moving ? Math.round(video.currentTime*45)%220 : 80;
        for(let i=0;i<width*height;i++){data[i*4]=level;data[i*4+1]=level;data[i*4+2]=level;data[i*4+3]=255;}
        return {data,width,height};
      }
    };
    return {width:0,height:0,getContext:()=>context};
  };
}
test("flags a decoded clip with no sampled pixel changes as likely static",async()=>{
  const video=new FakeVideo();
  const report=await analyzeSceneVideoMotion(video,{canvasFactory:makeCanvasFactory(video,false)});
  assert.equal(report.status,"likely-static");assert.equal(report.sampleCount,5);assert.equal(report.meanPixelChange,0);
});
test("detects pixel changes in a moving test clip",async()=>{
  const video=new FakeVideo();
  const report=await analyzeSceneVideoMotion(video,{canvasFactory:makeCanvasFactory(video,true)});
  assert.equal(report.status,"visible-change");assert.ok(report.meanPixelChange>0);
});
test("restores the original playback position and paused state",async()=>{
  const video=new FakeVideo();video.currentTime=1.25;video.paused=false;
  await analyzeSceneVideoMotion(video,{canvasFactory:makeCanvasFactory(video,true)});
  assert.ok(Math.abs(video.currentTime-1.25)<0.015);assert.equal(video.paused,false);
});
test("rejects videos without decoded frames",async()=>{
  const video=new FakeVideo();video.readyState=1;
  await assert.rejects(analyzeSceneVideoMotion(video,{canvasFactory:makeCanvasFactory(video,false)}),/decoded frame/);
});
test("validates sampling limits",async()=>{
  const video=new FakeVideo();
  await assert.rejects(analyzeSceneVideoMotion(video,{sampleCount:1,canvasFactory:makeCanvasFactory(video,false)}),/sampleCount/);
});

test("captures a few local frame samples and restores playback state", async () => {
  const video = new FakeVideo();
  video.currentTime = 1.25;
  video.paused = false;
  let captured = 0;
  const canvasFactory = () => ({
    width: 0, height: 0,
    getContext: () => ({ drawImage: () => { captured += 1; } }),
    toDataURL: () => "data:image/jpeg;base64,ZmFrZQ=="
  });
  const samples = await captureSceneVideoFrameSamples(video, { canvasFactory });
  assert.equal(samples.length, 3);
  assert.equal(captured, 3);
  assert.ok(samples.every(sample => sample.dataUrl.startsWith("data:image/jpeg")));
  assert.ok(samples[0].time < samples[1].time && samples[1].time < samples[2].time);
  assert.ok(Math.abs(video.currentTime - 1.25) < 0.015);
  assert.equal(video.paused, false);
});

test("rejects unsafe frame sample counts", async () => {
  const video = new FakeVideo();
  await assert.rejects(captureSceneVideoFrameSamples(video, { sampleCount: 6 }), /sampleCount/);
});
