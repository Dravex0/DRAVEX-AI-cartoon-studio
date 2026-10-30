import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCodeGenerationRequest, createCodeProviderRegistry, generateCodeProposal
} from "../src/engineering/code-provider-contract.js";

const request = { taskType:"bugfix", instructions:"Fix the reproducible parser issue", branch:"fix/parser-issue", contextFiles:[] };

test("validates bounded code-generation requests", () => {
  const result = validateCodeGenerationRequest(request);
  assert.equal(result.valid,true);
  assert.equal(result.value.branch,request.branch);
});
test("rejects invalid task, missing instructions and unsafe context paths", () => {
  assert.equal(validateCodeGenerationRequest({...request,taskType:"deploy"}).valid,false);
  assert.equal(validateCodeGenerationRequest({...request,instructions:""}).valid,false);
  assert.equal(validateCodeGenerationRequest({...request,contextFiles:[{path:"../secrets.txt",content:"x"}]}).valid,false);
});
test("enforces context count, file size and total size limits", () => {
  assert.ok(validateCodeGenerationRequest({...request,contextFiles:Array.from({length:21},(_,i)=>({path:"src/"+i+".js",content:"x"}))}).issues.some(x=>x.code==="too-many-context-files"));
  assert.ok(validateCodeGenerationRequest({...request,contextFiles:[{path:"src/large.js",content:"x".repeat(50001)}]}).issues.some(x=>x.code==="context-file-too-large"));
});
test("provider registry validates metadata and returns safe listings", () => {
  const registry=createCodeProviderRegistry();
  registry.register({id:"local-test",local:true,generate:async()=>({summary:"ok",changes:[]})});
  assert.equal(registry.list()[0].local,true);
  assert.equal(registry.list()[0].generate,undefined);
  assert.throws(()=>registry.register({id:"bad",local:true,remote:true,generate:async()=>({})}),/both local and remote/);
});
test("proposal output is validated by the change gate and never executed", async () => {
  const registry=createCodeProviderRegistry();
  registry.register({id:"mock",local:true,generate:async()=>({
    summary:"Add a tiny helper",
    changes:[{path:"src/helper.js",operation:"create",content:"export const helper = true;\n"}]
  })});
  const result=await generateCodeProposal(registry,"mock",request);
  assert.equal(result.status,"validated-for-human-review");
  assert.equal(result.execution,"not-executed");
  assert.equal(result.changeSet.changeCount,1);
});
test("blocks invalid provider patches and unknown providers", async () => {
  const registry=createCodeProviderRegistry();
  registry.register({id:"unsafe",remote:true,generate:async()=>({
    summary:"Bad patch",changes:[{path:"../outside.js",operation:"create",content:"x"}]
  })});
  await assert.rejects(()=>generateCodeProposal(registry,"unsafe",request),/Unsafe or invalid file path/);
  await assert.rejects(()=>generateCodeProposal(registry,"missing",request),/not registered/);
});
test("honors cancellation before provider invocation", async () => {
  const registry=createCodeProviderRegistry();
  let called=false;
  registry.register({id:"mock",local:true,generate:async()=>{called=true;return {summary:"ok",changes:[]};}});
  await assert.rejects(()=>generateCodeProposal(registry,"mock",request,{signal:{aborted:true}}),{name:"AbortError"});
  assert.equal(called,false);
});
