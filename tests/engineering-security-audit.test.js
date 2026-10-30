import test from "node:test";
import assert from "node:assert/strict";
import { auditRepository } from "../src/engineering/audit-engine.js";

test("detects high-confidence exposed credentials without copying values",()=>{
 const credential="ghp_"+"A".repeat(36);
 const report=auditRepository({files:[{path:"src/config.js",content:'const token = "'+credential+'";'}]});
 const finding=report.findings.find((item)=>item.category==="secret-exposure");
 assert.ok(finding);
 assert.equal(finding.severity,"high");
 assert.ok(!JSON.stringify(report).includes(credential));
 assert.match(finding.evidence,/redacted/);
});
test("warns on workflow write-all permissions",()=>{
 const report=auditRepository({files:[{path:".github/workflows/unsafe.yml",content:"permissions: write-all\njobs:\n  build:\n    runs-on: ubuntu-latest"}]});
 assert.ok(report.findings.some((item)=>item.category==="workflow-permissions"&&item.severity==="medium"));
});
test("does not flag ordinary placeholders as credentials",()=>{
 const report=auditRepository({files:[{path:"src/config.js",content:'const token = "YOUR_API_KEY_HERE"; // example placeholder'}]});
 assert.ok(!report.findings.some((item)=>item.category==="secret-exposure"));
});
