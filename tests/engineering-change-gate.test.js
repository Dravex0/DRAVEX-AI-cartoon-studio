import test from "node:test";
import assert from "node:assert/strict";
import { prepareChangeSet } from "../src/engineering/change-gate.js";

test("validates a simple proposed change without executing it", () => {
  const result = prepareChangeSet({ branch:"feat/add-helper", changes:[
    { path:"src/example.js", operation:"create", content:"export const answer = 42;\n" }
  ]});
  assert.equal(result.status,"validated-for-human-review");
  assert.equal(result.execution,"not-executed");
  assert.equal(result.changeCount,1);
});
test("rejects traversal, absolute, Windows-drive and encoded paths", () => {
  for (const path of ["../secret.txt","/tmp/file.js","src/../secret.js","src\\secret.js","C:/temp/file.js","c:relative.js","src/%2e%2e/secret.js","src/%2Fsecret.js","src/file.js?x=1"," src/file.js"]) {
    assert.throws(() => prepareChangeSet({branch:"feat/safe",changes:[{path,operation:"create",content:"x"}]}),/Unsafe or invalid file path/);
  }
});
test("rejects duplicate paths and invalid branch names", () => {
  assert.throws(() => prepareChangeSet({branch:"main",changes:[{path:"src/a.js",operation:"create",content:"x"}]}),/isolated branch/);
  assert.throws(() => prepareChangeSet({branch:"feat/safe",changes:[
    {path:"src/a.js",operation:"create",content:"x"},{path:"src/a.js",operation:"update",content:"y"}
  ]}),/Duplicate file path/);
});
test("requires approval for protected paths and never executes changes", () => {
  const result = prepareChangeSet({branch:"fix/workflow",changes:[
    {path:".github/workflows/deploy.yml",operation:"update",content:"name: deploy",expectedSha:"a".repeat(40)}
  ]});
  assert.equal(result.approvalRequired,true);
  assert.equal(result.status,"awaiting-explicit-approval");
  assert.equal(result.execution,"not-executed");
});
test("redacts secret values and flags credential-like proposed content", () => {
  const secret="ghp_"+"A".repeat(36);
  const result=prepareChangeSet({branch:"feat/config",changes:[
    {path:"src/config.js",operation:"create",content:'const token="'+secret+'";'}
  ]});
  assert.ok(result.findings.some((finding)=>finding.code==="possible-secret"));
  assert.ok(!JSON.stringify(result.findings).includes(secret));
});
test("requires a valid blob SHA for updates and deletions", () => {
  const result=prepareChangeSet({branch:"fix/update",changes:[
    {path:"src/a.js",operation:"update",content:"new content",expectedSha:"abc123"}
  ]});
  assert.ok(result.findings.some((finding)=>finding.code==="missing-or-invalid-expected-sha"));
  assert.throws(()=>prepareChangeSet({branch:"fix/create",changes:[
    {path:"src/new.js",operation:"create",content:"new",expectedSha:"a".repeat(40)}
  ]}),/must not include an expected SHA/);
});
test("requires explicit approval for deletion and rejects delete content", () => {
  const result=prepareChangeSet({branch:"chore/remove-file",changes:[
    {path:"src/old.js",operation:"delete"}
  ]});
  assert.equal(result.approvalRequired,true);
  assert.equal(result.status,"awaiting-explicit-approval");
  assert.throws(()=>prepareChangeSet({branch:"fix/delete",changes:[
    {path:"src/a.js",operation:"delete",content:"unexpected"}
  ]}),/cannot include file content/);
});
test("rejects excessive file count and oversized content", () => {
  assert.throws(()=>prepareChangeSet({branch:"feat/many",changes:Array.from({length:41},(_,i)=>({path:"src/f"+i+".js",operation:"create",content:"x"}))}),/at most 40/);
  assert.throws(()=>prepareChangeSet({branch:"feat/large",changes:[{path:"src/large.js",operation:"create",content:"x".repeat(200001)}]}),/200 KB/);
});
