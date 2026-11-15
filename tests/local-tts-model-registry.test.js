import test from "node:test";
import assert from "node:assert/strict";
import { getLocalTtsModel, listLocalTtsModels } from "../src/local-tts-model-registry.js";

test("selects the permissively licensed English model by locale",()=>{
 const model=getLocalTtsModel("en-US");
 assert.equal(model.available,true);
 assert.equal(model.modelId,"onnx-community/Kokoro-82M-v1.0-ONNX");
 assert.equal(model.runtime,"kokoro-js");
 assert.equal(model.license,"Apache-2.0");
 assert.equal(model.commercialUse,true);
 assert.equal(model.consentRequired,false);
});
test("blocks non-commercial models unless explicitly opted in",()=>{
 for(const locale of ["ru","es"]){
  const blocked=getLocalTtsModel(locale);
  assert.equal(blocked.available,false);
  assert.equal(blocked.reason,"non-commercial-license-requires-opt-in");
  const allowed=getLocalTtsModel(locale,{allowNonCommercial:true});
  assert.equal(allowed.available,true);
  assert.equal(allowed.commercialUse,false);
  assert.equal(allowed.runtime,"transformers-js");
  assert.equal(allowed.consentRequired,true);
  assert.equal(allowed.license,"CC-BY-NC-4.0");
 }
});
test("normalizes locale tags and rejects unsupported languages",()=>{
 assert.equal(getLocalTtsModel("uk-UA",{allowNonCommercial:true}).locale,"uk");
 assert.equal(getLocalTtsModel("de").reason,"unsupported-locale");
 assert.equal(getLocalTtsModel("").available,false);
});
test("returns safe catalog metadata without exposing mutable registry arrays",()=>{
 const first=listLocalTtsModels();
 assert.equal(first.length,4);
 first[0].languages?.push?.("xx");
 assert.deepEqual(listLocalTtsModels()[0].languages,["en"]);
});

test("selects the permissively licensed Ukrainian three-speaker Piper model", () => {
 const model = getLocalTtsModel("uk-UA");
 assert.equal(model.available, true);
 assert.equal(model.runtime, "piper-onnx");
 assert.equal(model.license, "MIT");
 assert.equal(model.commercialUse, true);
 assert.equal(model.voiceMode, "multi-speaker");
 assert.equal(model.modelBytes, 76_735_663);
 assert.equal(model.approximateQuantizedWeightBytes, null);
 assert.deepEqual(model.voices, ["lada", "mykyta", "tetiana"]);
 assert.match(model.modelUrl, /uk_UA-ukrainian_tts-medium\.onnx$/);
 assert.match(model.configUrl, /uk_UA-ukrainian_tts-medium\.onnx\.json$/);
});
