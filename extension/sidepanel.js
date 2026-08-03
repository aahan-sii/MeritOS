const state = {
  claims: [],
  coverage: [],
  identity: { displayName: "", email: "", headline: "" },
  activeOpportunity: null,
  proactive: true,
  autoAnalysisKey: "",
  fields: [],
  suggestions: new Map(),
  aiSuggestions: new Map(),
  approved: new Set(),
  baseUrl: "",
  token: "",
  applicationRun: null,
  runBusy: false,
  lastRunReport: null,
};
const $ = (id) => document.getElementById(id);

async function activeTab() {
  return (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
}

async function sendToPage(message) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active application page found.");
  return chrome.tabs.sendMessage(tab.id, message);
}

function deterministic(field) {
  return globalThis.MeritOSIntelligence.suggest(field, state.claims, state.identity);
}

function suggestionFor(field) {
  return state.aiSuggestions.get(field.id) || deterministic(field);
}

function canUseAi(field) {
  return globalThis.MeritOSIntelligence.canDraftField(field, state.proactive);
}

function safeForBatch(suggestion) {
  return suggestion?.text && ["identity", "evidence", "inference", "ai", "ai_inference"].includes(suggestion.kind);
}

function needsAiCompletion(field) {
  const suggestion = state.suggestions.get(field.id);
  return canUseAi(field) && (!suggestion?.text || suggestion.kind === "evidence_preview");
}

function showAssistant() {
  $("connection").hidden = true;
  $("assistant").hidden = false;
}

function showConnection(message = "") {
  $("connection").hidden = false;
  $("assistant").hidden = true;
  $("connectStatus").textContent = message;
}

function hydrateProfile(profile) {
  state.claims = profile?.claims || [];
  state.coverage = profile?.coverage || [];
  state.identity = profile?.identity || state.identity;
  state.activeOpportunity = profile?.activeOpportunity || null;
  window.setTimeout(hydrateRunUrl, 0);
  $("opportunityContext").hidden = !state.activeOpportunity;
  $("opportunityTitle").textContent = state.activeOpportunity?.title || "";
  $("opportunityOrganization").textContent = state.activeOpportunity ? `${state.activeOpportunity.organization}${state.activeOpportunity.deadline ? ` · ${new Date(state.activeOpportunity.deadline).toLocaleDateString()}` : ""}` : "";
}

function hydrateRunUrl() {
  if (!$("runUrl").value && state.activeOpportunity?.url) $("runUrl").value = state.activeOpportunity.url;
}

function updateCounts() {
  const supported = state.fields.filter((field) => state.suggestions.get(field.id)?.text).length;
  $("supportedCount").textContent = supported;
  $("missingCount").textContent = Math.max(0, state.fields.length - supported);
  $("approvedCount").textContent = state.approved.size;
  $("fillApproved").disabled = state.approved.size === 0;
  $("analyzeMissing").disabled = !state.fields.some(needsAiCompletion);
}

function renderFields() {
  const missingAreas = state.coverage.filter((area) => !area.ready).length;
  $("fieldCount").textContent = state.fields.length;
  $("profileCount").textContent = `${state.claims.length} verified facts${missingAreas ? ` · ${missingAreas} context areas missing` : " · core context ready"}`;
  $("fields").innerHTML = "";
  state.suggestions.clear();
  state.fields.forEach((field) => {
    const suggestion = suggestionFor(field);
    state.suggestions.set(field.id, suggestion);
    const card = document.createElement("article");
    card.className = `field ${suggestion.text ? "supported" : "unsupported"} ${suggestion.kind || "missing"}`;
    card.innerHTML = '<div class="field-top"><input type="checkbox" aria-label="Approve answer"><div><h2></h2><div class="meta"></div></div><span class="intent"></span></div><div class="suggestion"></div><div class="evidence"></div><div class="field-actions"></div>';
    card.querySelector("h2").textContent = field.label;
    const control = field.control || field.kind;
    const optionNote = field.options?.length ? ` · ${field.options.length} choices` : "";
    card.querySelector(".meta").textContent = `${field.required ? "Required" : "Optional"} · ${control}${optionNote}`;
    card.querySelector(".intent").textContent = suggestion.intent?.replaceAll("_", " ") || "Needs review";
    card.querySelector(".suggestion").textContent = suggestion.text || "Not enough verified context yet.";
    card.querySelector(".evidence").textContent = suggestion.source;
    const checkbox = card.querySelector("input");
    checkbox.disabled = !suggestion.text;
    checkbox.checked = state.approved.has(field.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.approved.add(field.id);
      else state.approved.delete(field.id);
      updateCounts();
    });
    if (canUseAi(field)) {
      const button = document.createElement("button");
      button.className = "draft-button";
      button.textContent = suggestion.kind === "ai" ? "Redraft with AI" : "Analyze with AI";
      button.addEventListener("click", () => generateDrafts([field], button));
      card.querySelector(".field-actions").append(button);
    }
    $("fields").append(card);
  });
  if (!state.fields.length) $("fields").innerHTML = '<p class="empty">No supported application questions were found on this page.</p>';
  updateCounts();
}

function normalizedRunUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderApplicationRun() {
  const run = state.applicationRun;
  const report = state.lastRunReport;
  const active = Boolean(run?.active);
  const phase = run?.phase || "ready";
  $("runProgress").hidden = !run;
  $("resumeRun").hidden = !run || (active && !["paused", "review"].includes(phase));
  $("startRun").disabled = state.runBusy;
  $("runBadge").textContent = state.runBusy ? "Working" : phase === "paused" ? "Needs you" : phase === "review" ? "Review" : active ? "Running" : "Ready";
  $("runBadge").className = `run-badge ${state.runBusy || active ? "working" : ""} ${phase === "paused" ? "blocked" : ""}`.trim();
  $("runStatus").textContent = run?.message || "Ready to prepare an application.";
  $("runSummary").textContent = report ? `${report.filled} filled · ${report.missing.length} missing · ${report.review.length} verify` : "MeritOS stops before Submit.";
  $("runReport").hidden = !report || (!report.missing.length && !report.review.length);
  $("runMissing").innerHTML = "";
  for (const item of [...(report?.missing || []), ...(report?.review || [])]) {
    const row = document.createElement("li");
    row.textContent = `${item.required ? "Required: " : item.kind === "review" ? "Verify: " : ""}${item.label}${item.reason ? ` — ${item.reason}` : ""}`;
    $("runMissing").append(row);
  }
}

async function persistApplicationRun() {
  await chrome.storage.local.set({ meritosApplicationRun: state.applicationRun, meritosApplicationRunReport: state.lastRunReport });
  renderApplicationRun();
}

function fieldHasUserValue(field) {
  if (["radio", "checkbox", "select"].includes(field.control)) return false;
  const value = String(field.currentValue || "").trim();
  return value.length > 0 && value !== field.label && value !== "Unlabelled field";
}

async function startApplicationRun() {
  const url = normalizedRunUrl($("runUrl").value || state.activeOpportunity?.url);
  if (!url) {
    state.applicationRun = { active: false, phase: "paused", message: "Enter a valid application URL first.", steps: 0, autoContinue: $("autoContinueRun").checked };
    await persistApplicationRun();
    return;
  }
  const tab = await activeTab();
  if (!tab?.id) return;
  state.lastRunReport = null;
  state.applicationRun = {
    active: true,
    phase: "opening",
    message: "Opening the application…",
    url,
    tabId: tab.id,
    steps: 0,
    autoContinue: $("autoContinueRun").checked,
    startedAt: new Date().toISOString(),
  };
  await persistApplicationRun();
  await chrome.tabs.update(tab.id, { url, active: true });
}

async function stopApplicationRun(message = "Application Run ended. The prepared form remains open for review.") {
  if (!state.applicationRun) return;
  state.applicationRun = { ...state.applicationRun, active: false, phase: "review", message };
  await persistApplicationRun();
}

async function resumeApplicationRun() {
  const tab = await activeTab();
  if (!tab?.id) return;
  state.applicationRun = {
    ...(state.applicationRun || {}),
    active: true,
    phase: "running",
    message: "Checking your updates and preparing this page…",
    tabId: tab.id,
    autoContinue: $("autoContinueRun").checked,
  };
  await persistApplicationRun();
  await executeApplicationRun();
}

async function executeApplicationRun() {
  const run = state.applicationRun;
  if (!run?.active || state.runBusy) return;
  const tab = await activeTab();
  if (!tab?.id || (run.tabId && tab.id !== run.tabId)) return;
  state.runBusy = true;
  state.applicationRun = { ...run, phase: "running", message: `Preparing page ${(run.steps || 0) + 1}…` };
  renderApplicationRun();
  try {
    await scan();
    if (!state.fields.length) {
      state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", message: "No application fields were detected. Sign in or open the actual form, then press Resume." };
      return;
    }

    const existing = new Set(state.fields.filter(fieldHasUserValue).map((field) => field.id));
    const fillable = state.fields.filter((field) => !existing.has(field.id) && safeForBatch(state.suggestions.get(field.id)));
    const items = fillable.map((field) => ({ fieldId: field.id, value: state.suggestions.get(field.id).text }));
    const fillResult = items.length ? await sendToPage({ type: "MERITOS_FILL_MANY", items }) : { results: [] };
    const filledIds = new Set((fillResult.results || []).filter((item) => item.filled).map((item) => item.fieldId));
    const failedIds = new Set((fillResult.results || []).filter((item) => !item.filled).map((item) => item.fieldId));
    const missing = state.fields
      .filter((field) => !existing.has(field.id) && (!state.suggestions.get(field.id)?.text || failedIds.has(field.id)))
      .map((field) => ({ fieldId: field.id, label: field.label, required: Boolean(field.required), kind: "missing", reason: failedIds.has(field.id) ? "This control could not be filled automatically" : state.suggestions.get(field.id)?.source || "More profile context is needed" }));
    const review = state.fields
      .filter((field) => ["inference", "ai_inference"].includes(state.suggestions.get(field.id)?.kind) && (filledIds.has(field.id) || existing.has(field.id)))
      .map((field) => ({ fieldId: field.id, label: field.label, required: Boolean(field.required), kind: "review", reason: "MeritOS made a disclosed inference" }));
    const report = {
      pageTitle: $("pageTitle").textContent || tab.title || "Application",
      url: tab.url || run.url,
      step: (run.steps || 0) + 1,
      total: state.fields.length,
      filled: filledIds.size,
      preserved: existing.size,
      missing,
      review,
      createdAt: new Date().toISOString(),
    };
    state.lastRunReport = report;
    await sendToPage({
      type: "MERITOS_HIGHLIGHT_REVIEW",
      items: [...missing.map((item) => ({ ...item, status: "missing", message: item.reason })), ...review.map((item) => ({ ...item, status: "review", message: item.reason }))],
      summary: { filled: report.filled + report.preserved, missing: missing.length },
    });

    const requiredMissing = missing.filter((item) => item.required);
    const actions = await sendToPage({ type: "MERITOS_PROGRESS_ACTIONS" });
    if (!requiredMissing.length && actions?.next?.found && state.applicationRun.autoContinue && (run.steps || 0) < 8) {
      state.applicationRun = { ...state.applicationRun, steps: (run.steps || 0) + 1, phase: "running", message: `${report.filled} answers filled. Continuing through “${actions.next.label}”…` };
      await persistApplicationRun();
      const progressed = await sendToPage({ type: "MERITOS_CLICK_SAFE_NEXT" });
      if (progressed?.clicked) {
        window.setTimeout(() => executeApplicationRun(), 1500);
        return;
      }
    }

    if (requiredMissing.length) {
      state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", message: `${requiredMissing.length} required answer${requiredMissing.length === 1 ? " needs" : "s need"} you. Complete the highlighted fields, then press Resume.` };
    } else if (actions?.final?.found) {
      state.applicationRun = { ...state.applicationRun, active: false, phase: "review", message: `Prepared for final review. MeritOS stopped before “${actions.final.label}”.` };
    } else {
      state.applicationRun = { ...state.applicationRun, active: false, phase: "review", message: "This page is prepared. Review highlighted answers and submit only when you are satisfied." };
    }
  } catch (error) {
    state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", message: error.message || "The application changed during the run. Press Resume to try this page again." };
  } finally {
    state.runBusy = false;
    await persistApplicationRun();
  }
}

async function scan() {
  $("scanStatus").textContent = "Scanning page…";
  $("rescanButton").disabled = true;
  try {
    const result = await sendToPage({ type: "MERITOS_SCAN" });
    state.fields = result.fields || [];
    state.approved.clear();
    state.aiSuggestions.clear();
    $("pageTitle").textContent = result.title || "Application form";
    $("fillApproved").textContent = "Fill selected";
    renderFields();
    $("scanStatus").textContent = `${state.fields.length} question${state.fields.length === 1 ? "" : "s"} mapped · profile connected across tabs`;
    const tab = await activeTab();
    const autoFields = state.fields.filter(needsAiCompletion).slice(0, 20);
    const analysisKey = `${tab?.url || result.title || ""}|${state.fields.map((field) => field.id).join("|")}|${state.claims.length}`;
    if (state.proactive && autoFields.length && state.autoAnalysisKey !== analysisKey) {
      state.autoAnalysisKey = analysisKey;
      await generateDrafts(autoFields, $("analyzeMissing"), { automatic: true });
    }
  } catch {
    state.fields = [];
    renderFields();
    $("pageTitle").textContent = "Open an application form";
    $("scanStatus").textContent = "This page could not be scanned. The profile connection is still saved.";
  } finally {
    $("rescanButton").disabled = false;
  }
}

async function generateDrafts(fields, button, { automatic = false } = {}) {
  if (!fields.length) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = fields.length > 1 ? "Analyzing…" : "Drafting…";
  try {
    const tab = await activeTab();
    const response = await fetch(`${state.baseUrl}/api/extension/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ fields, mode: state.proactive ? "proactive" : "standard", page: { title: tab?.title || "", url: tab?.url || "" } }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not analyze this form.");
    (data.results || []).forEach((result, index) => {
      const field = fields[index];
      if (!field) return;
      const intent = deterministic(field).intent;
      const assumptions = Array.isArray(result.assumptions) ? result.assumptions.filter(Boolean) : [];
      const inferred = assumptions.length > 0 || result.confidence === "low";
      const confidence = result.confidence || "medium";
      state.aiSuggestions.set(field.id, result.status === "draft" && result.draft
        ? { text: result.draft, source: `${inferred ? "Proactive inference" : "AI answer"} · ${confidence} confidence · ${result.usedEvidenceIds.length} verified fact${result.usedEvidenceIds.length === 1 ? "" : "s"}${assumptions.length ? ` · Assumption: ${assumptions.join("; ")}` : ""} · review before filling`, intent, kind: inferred ? "ai_inference" : "ai" }
        : { text: "", source: result.questions?.[0] || "More verified context is required.", intent, kind: "missing" });
    });
    renderFields();
    $("scanStatus").textContent = automatic ? "Proactive analysis complete · review inferred answers before filling" : "AI analysis complete · review suggestions before filling";
  } catch (error) {
    $("scanStatus").textContent = error.message || "AI analysis failed safely; no fields changed.";
  } finally {
    button.disabled = false;
    button.textContent = original;
    updateCounts();
  }
}

async function refreshProfile({ allowCache = true } = {}) {
  let response;
  try {
    response = await fetch(`${state.baseUrl}/api/extension/profile`, { headers: { Authorization: `Bearer ${state.token}` } });
  } catch (error) {
    if (allowCache && state.claims.length) return false;
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.local.remove(["meritosToken", "meritosProfile"]);
      throw new Error("Your connection key was revoked. Create one new key in MeritOS.");
    }
    if (allowCache && state.claims.length) return false;
    throw new Error(data.error || "Could not connect.");
  }
  hydrateProfile(data.profile);
  await chrome.storage.local.set({ meritosBaseUrl: state.baseUrl, meritosToken: state.token, meritosProfile: data.profile });
  return true;
}

async function connect() {
  state.baseUrl = $("baseUrl").value.replace(/\/$/, "");
  state.token = $("token").value.trim();
  $("connectStatus").textContent = "Connecting…";
  try {
    await refreshProfile({ allowCache: false });
    showAssistant();
    await scan();
  } catch (error) {
    showConnection(error.message);
  }
}

$("connectButton").addEventListener("click", connect);
$("startRun").addEventListener("click", () => void startApplicationRun());
$("resumeRun").addEventListener("click", () => void resumeApplicationRun());
$("stopRun").addEventListener("click", () => void stopApplicationRun());
$("autoContinueRun").addEventListener("change", async (event) => {
  if (!state.applicationRun) return;
  state.applicationRun = { ...state.applicationRun, autoContinue: event.target.checked };
  await persistApplicationRun();
});
$("copyRunReport").addEventListener("click", async () => {
  const report = state.lastRunReport;
  if (!report) return;
  const lines = [
    `${report.pageTitle} — MeritOS review checklist`,
    `${report.filled} filled, ${report.preserved || 0} preserved, ${report.missing.length} missing, ${report.review.length} to verify`,
    ...report.missing.map((item) => `- ${item.required ? "REQUIRED: " : ""}${item.label}: ${item.reason}`),
    ...report.review.map((item) => `- VERIFY: ${item.label}: ${item.reason}`),
  ];
  await navigator.clipboard.writeText(lines.join("\n"));
  $("copyRunReport").textContent = "Copied";
  window.setTimeout(() => { $("copyRunReport").textContent = "Copy checklist"; }, 1200);
});
$("rescanButton").addEventListener("click", () => { state.autoAnalysisKey = ""; void scan(); });
$("settingsButton").addEventListener("click", () => {
  $("connection").hidden = !$("connection").hidden;
  $("assistant").hidden = !$("assistant").hidden;
});
$("analyzeMissing").addEventListener("click", () => generateDrafts(state.fields.filter(needsAiCompletion).slice(0, 20), $("analyzeMissing")));
$("proactiveMode").addEventListener("change", async (event) => {
  state.proactive = event.target.checked;
  state.autoAnalysisKey = "";
  state.aiSuggestions.clear();
  await chrome.storage.local.set({ meritosProactive: state.proactive });
  await scan();
});
$("selectAll").addEventListener("click", () => {
  state.approved = new Set(state.fields.filter((field) => safeForBatch(state.suggestions.get(field.id))).map((field) => field.id));
  renderFields();
});
$("clearSelections").addEventListener("click", () => {
  state.approved.clear();
  renderFields();
});
$("fillApproved").addEventListener("click", async () => {
  $("fillApproved").disabled = true;
  $("fillApproved").textContent = "Filling…";
  const items = state.fields.filter((field) => state.approved.has(field.id) && state.suggestions.get(field.id)?.text).map((field) => ({ fieldId: field.id, value: state.suggestions.get(field.id).text }));
  try {
    const result = await sendToPage({ type: "MERITOS_FILL_MANY", items });
    const filled = (result.results || []).filter((item) => item.filled).length;
    $("fillApproved").textContent = `${filled} filled · review`;
    $("scanStatus").textContent = filled === items.length ? "Answers filled. Review the original form." : `${filled} of ${items.length} answers filled; unsupported controls were left unchanged.`;
  } catch {
    $("fillApproved").textContent = "Fill selected";
    $("scanStatus").textContent = "The page changed before filling. Rescan and try again.";
  } finally {
    $("fillApproved").disabled = false;
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => window.setTimeout(() => {
  if (state.applicationRun?.active && (!state.applicationRun.tabId || state.applicationRun.tabId === tabId)) void executeApplicationRun();
  else void scan();
}, 180));
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  const tab = await activeTab();
  if (tab?.id !== tabId) return;
  if (state.applicationRun?.active && (!state.applicationRun.tabId || state.applicationRun.tabId === tabId)) void executeApplicationRun();
  else void scan();
});

(async () => {
  const stored = await chrome.storage.local.get(["meritosBaseUrl", "meritosToken", "meritosProfile", "meritosProactive", "meritosApplicationRun", "meritosApplicationRunReport"]);
  state.proactive = stored.meritosProactive !== false;
  state.applicationRun = stored.meritosApplicationRun || null;
  state.lastRunReport = stored.meritosApplicationRunReport || null;
  $("proactiveMode").checked = state.proactive;
  $("autoContinueRun").checked = state.applicationRun?.autoContinue !== false;
  if (state.applicationRun?.url) $("runUrl").value = state.applicationRun.url;
  renderApplicationRun();
  if (stored.meritosBaseUrl) $("baseUrl").value = stored.meritosBaseUrl;
  if (!stored.meritosToken) return;
  state.baseUrl = stored.meritosBaseUrl || $("baseUrl").value;
  state.token = stored.meritosToken;
  $("token").value = stored.meritosToken;
  if (stored.meritosProfile) {
    hydrateProfile(stored.meritosProfile);
    showAssistant();
    await scan();
  }
  try {
    await refreshProfile({ allowCache: true });
    showAssistant();
    if (!stored.meritosProfile) await scan();
  } catch (error) {
    showConnection(error.message);
  }
})();
