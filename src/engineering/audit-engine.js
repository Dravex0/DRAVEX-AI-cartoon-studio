const DEFAULT_REQUIRED_FILES = ["package.json","README.md","index.html",".github/workflows/quality.yml"];
const SHARED_TESTS = {
  "src/scene-model.js":["tests/story-qa.test.js"],
  "src/engineering/agent-registry.js":["tests/engineering-system.test.js"],
  "src/engineering/audit-engine.js":["tests/engineering-system.test.js"],
  "src/engineering/index.js":["tests/engineering-system.test.js"],
  "src/engineering/task-planner.js":["tests/engineering-system.test.js"]
};
const SECRET_PATTERNS = [
  {id:"github-token",pattern:/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b/g},
  {id:"openai-style-key",pattern:/\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g},
  {id:"google-api-key",pattern:/\bAIza[0-9A-Za-z_-]{30,}\b/g},
  {id:"private-key",pattern:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g}
];
function normalizeFiles(input) {
  if (!Array.isArray(input)) throw new TypeError("files must be an array.");
  return input.map((entry)=>typeof entry==="string"?{path:entry,content:""}:{path:String(entry?.path??""),content:String(entry?.content??"")}).filter((entry)=>entry.path);
}
/** Audits only the supplied snapshot. Secret matches are never copied into reports. */
export function auditRepository(snapshot,options={}) {
  const files=normalizeFiles(snapshot?.files??[]), byPath=new Map(files.map((file)=>[file.path,file]));
  const findings=[];
  for(const path of options.requiredFiles??DEFAULT_REQUIRED_FILES) if(!byPath.has(path)) findings.push({
    id:"missing-"+path.replace(/[^a-z0-9]+/gi,"-"),severity:"high",category:"repository-integrity",path,
    message:"Required project file is missing: "+path,evidence:"Path was not present in the supplied repository snapshot.",
    recommendation:"Confirm the repository tree and restore the file only if genuinely required."
  });
  const packageFile=byPath.get("package.json");
  if(packageFile?.content) try {
    const pkg=JSON.parse(packageFile.content);
    for(const script of ["test","check","build"]) if(!pkg.scripts?.[script]) findings.push({
      id:"missing-script-"+script,severity:"medium",category:"quality-gate",path:"package.json",
      message:"No npm script is configured for "+script+".",evidence:'package.json scripts does not define "'+script+'".',
      recommendation:'Add a reliable "'+script+'" script or document the equivalent command.'
    });
  } catch { findings.push({
    id:"invalid-package-json",severity:"high",category:"repository-integrity",path:"package.json",
    message:"package.json is not valid JSON.",evidence:"The supplied package.json content could not be parsed.",
    recommendation:"Validate and repair package.json before running project checks."
  }); }
  for(const file of files) {
    if(!file.content) continue;
    for(const rule of SECRET_PATTERNS) {
      rule.pattern.lastIndex=0;
      const match=rule.pattern.exec(file.content);
      if(match) {
        const line=file.content.slice(0,match.index).split("\n").length;
        findings.push({
          id:"possible-secret-"+rule.id+"-"+file.path.replace(/[^a-z0-9]+/gi,"-")+"-"+line,
          severity:"high",category:"secret-exposure",path:file.path,
          message:"A high-confidence credential or private-key pattern was detected.",
          evidence:"Secret-like pattern "+rule.id+" at line "+line+"; matched value is intentionally redacted.",
          recommendation:"Verify the finding, revoke exposed credentials, and move secrets to protected runtime configuration."
        });
      }
    }
    if(/^\.github\/workflows\/.*\.ya?ml$/i.test(file.path)&&/\bpermissions\s*:\s*write-all\b/i.test(file.content)) findings.push({
      id:"workflow-write-all-"+file.path.replace(/[^a-z0-9]+/gi,"-"),severity:"medium",category:"workflow-permissions",path:file.path,
      message:"Workflow grants write-all permissions.",evidence:"The workflow contains a permissions: write-all declaration.",
      recommendation:"Use least-privilege permissions and grant write access only to required scopes."
    });
  }
  for(const source of files.filter(({path})=>/^src\/.*\.js$/.test(path))) {
    const name=source.path.split("/").pop().replace(/\.js$/,"");
    const expectedTest="tests/"+name+".test.js";
    const sharedTests=SHARED_TESTS[source.path]??[];
    if(!byPath.has(expectedTest)&&!sharedTests.some((testPath)=>byPath.has(testPath))) findings.push({
      id:"test-gap-"+name,severity:"low",category:"test-coverage",path:source.path,
      message:"No recognized direct or shared test file was found for "+source.path+".",
      evidence:"Neither "+expectedTest+" nor a configured shared test was present; other indirect coverage may still exist.",
      recommendation:"Review coverage and add a focused test if this module contains behavior that can regress."
    });
  }
  const severityRank={high:0,medium:1,low:2};
  findings.sort((a,b)=>severityRank[a.severity]-severityRank[b.severity]||a.id.localeCompare(b.id));
  return {
    schemaVersion:1,mode:"static-snapshot-audit",filesInspected:files.length,findingCount:findings.length,
    summary:findings.length?"Review findings before changing code.":"No findings in the checks performed.",
    limitations:["Only supplied file paths and contents were inspected.","Credential scanning uses high-confidence token formats and cannot detect every secret.","This audit does not execute code, run tests, inspect runtime behavior, or prove security.","A shared test-file mapping is a heuristic and does not prove that every exported function is covered."],
    findings
  };
}
