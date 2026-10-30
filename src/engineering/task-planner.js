const ROUTES = [
  { agents:["auditor","bug-hunter","qa"], terms:["bug","error","broken","crash","ошиб","баг","не работает","завис"] },
  { agents:["performance","qa"], terms:["performance","slow","memory","4k","lag","производ","медлен","памят"] },
  { agents:["security","auditor"], terms:["security","secret","privacy","token","key","безопас","ключ","приват"] },
  { agents:["research","quality"], terms:["model","provider","gpu","video generation","license","quota","модель","генерац","видеокарт"] },
  { agents:["visual-qa","qa"], terms:["ui","interface","layout","screenshot","mobile","android","интерфейс","кноп","экран"] },
  { agents:["developer","qa"], terms:["implement","build","add","create","refactor","добав","созда","разработ","улучш"] }
];
function normalize(value) { return String(value ?? "").trim().toLocaleLowerCase(); }
export function planEngineeringTask(request, options = {}) {
  const text = normalize(request);
  if (!text) throw new TypeError("A non-empty engineering task is required.");
  const selected = ROUTES.filter((route) => route.terms.some((term) => text.includes(term)));
  const agentIds = [...new Set(["core","planner", ...selected.flatMap((route) => route.agents), "quality"])];
  const tasks = agentIds.map((agentId, index) => ({
    id: "task-" + (index + 1), agentId, status: "planned", order: index + 1
  }));
  const destructive = /delete|remove|drop|overwrite|publish|release|merge|удалить|стереть|перезаписать|опубликовать|слить/i.test(text);
  const touchesMain = /\bmain\b|основн(ая|ую) ветк/i.test(text);
  const approvalRequired = destructive || touchesMain || options.externalService === true;
  return {
    request: String(request).trim(), mode: "deterministic-planning", tasks, approvalRequired,
    safeguards: [
      "No repository files are changed by the planner.",
      "Implementation must use an isolated branch and a pull request.",
      "Tests and build must pass before merge is considered.",
      ...(approvalRequired ? ["Explicit user approval is required before the requested high-impact action."] : [])
    ]
  };
}
