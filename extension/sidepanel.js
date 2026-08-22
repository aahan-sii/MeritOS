const state = {
  claims: [],
  coverage: [],
  identity: { displayName: "", email: "", headline: "" },
  activeOpportunity: null,
  proactive: true,
  organizationApplication: true,
  initiativeMode: "careful",
  autoAnalysisKey: "",
  fields: [],
  suggestions: new Map(),
  aiSuggestions: new Map(),
  manualSuggestions: new Map(),
  approved: new Set(),
  baseUrl: "",
  token: "",
  applicationRun: null,
  runBusy: false,
  lastRunReport: null,
  runResults: [],
  selectedRuns: new Set(),
  activeFrameId: null,
};
const $ = (id) => document.getElementById(id);
let automaticScanTimer;
let storageSyncTimer;

async function activeTab() {
  return (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
}

function scheduleAutomaticScan(delay = 220, { resetAnalysis = true } = {}) {
  window.clearTimeout(automaticScanTimer);
  automaticScanTimer = window.setTimeout(() => {
    if (resetAnalysis) state.autoAnalysisKey = "";
    if (state.applicationRun?.active) void executeApplicationRun();
    else if (state.token) void scan();
  }, delay);
}

async function sendToTopPage(message) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active application page found.");
  return chrome.tabs.sendMessage(tab.id, message);
}

async function sendToPage(message) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active application page found.");
  if (Number.isInteger(state.activeFrameId)) {
    const result = await chrome.runtime.sendMessage({ type: "MERITOS_SEND_TO_APPLICATION_FRAME", tabId: tab.id, frameId: state.activeFrameId, payload: message });
    if (result?.error) throw new Error(result.error);
    return result;
  }
  return chrome.tabs.sendMessage(tab.id, message);
}

async function scanBestFrame() {
  const tab = await activeTab();
  if (!tab?.id) return null;
  const result = await chrome.runtime.sendMessage({ type: "MERITOS_SEND_TO_APPLICATION_FRAME", tabId: tab.id, payload: { type: "MERITOS_SCAN_STABLE", passes: 3 } });
  if (result?.error || !result?.fields?.length) return null;
  state.activeFrameId = result.frameId;
  return result;
}

function deterministic(field) {
  return globalThis.MeritOSIntelligence.suggest(field, state.claims, state.identity);
}

function suggestionFor(field) {
  return state.manualSuggestions.get(field.id) || state.aiSuggestions.get(field.id) || deterministic(field);
}

function canUseAi(field) {
  return globalThis.MeritOSIntelligence.canDraftField(field, state.proactive);
}

function safeForBatch(suggestion) {
  return suggestion?.text && ["identity", "evidence", "inference", "ai", "ai_inference", "edited"].includes(suggestion.kind);
}

function safeForAutomaticApproval(suggestion) {
  return suggestion?.text && ["identity", "evidence", "ai", "edited"].includes(suggestion.kind) && suggestion.confidence !== "low";
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
  $("opportunityContext").hidden = !state.activeOpportunity;
  $("opportunityTitle").textContent = state.activeOpportunity?.title || "";
  $("opportunityOrganization").textContent = state.activeOpportunity ? `${state.activeOpportunity.organization}${state.activeOpportunity.deadline ? ` · ${new Date(state.activeOpportunity.deadline).toLocaleDateString()}` : ""}` : "";
}

function updateCounts() {
  const supported = state.fields.filter((field) => state.suggestions.get(field.id)?.text).length;
  $("supportedCount").textContent = supported;
  $("missingCount").textContent = Math.max(0, state.fields.length - supported);
  $("approvedCount").textContent = state.approved.size;
  $("fillApproved").disabled = state.approved.size === 0;
  $("fillApproved").textContent = state.approved.size ? `Fill ${state.approved.size} ready answer${state.approved.size === 1 ? "" : "s"}` : "No ready answers yet";
}

function renderFields({ autoSelect = false } = {}) {
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
    const suggestionBox = card.querySelector(".suggestion");
    const evidence = card.querySelector(".evidence");
    evidence.textContent = suggestion.source;
    const checkbox = card.querySelector("input");
    checkbox.disabled = !suggestion.text;
    if (autoSelect && safeForAutomaticApproval(suggestion)) state.approved.add(field.id);
    checkbox.checked = state.approved.has(field.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.approved.add(field.id);
      else state.approved.delete(field.id);
      updateCounts();
    });
    if (suggestion.text) {
      const options = Array.isArray(field.options) ? field.options.map((option) => typeof option === "string" ? option : option.label || option.value || "").filter(Boolean) : [];
      const editor = document.createElement(options.length ? "select" : "textarea");
      editor.className = "suggestion-editor";
      editor.setAttribute("aria-label", `Edit suggested answer for ${field.label}`);
      if (options.length) {
        for (const value of [...new Set([suggestion.text, ...options])]) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          editor.append(option);
        }
      } else {
        editor.rows = Math.max(2, Math.min(7, Math.ceil(String(suggestion.text).length / 65)));
      }
      editor.value = suggestion.text;
      const applyEdit = (value) => {
        const text = String(value || "").trim();
        const next = { ...suggestion, text, kind: "edited", source: `Edited by you · ${String(suggestion.source || "grounded MeritOS suggestion").replace(/^Edited by you · /, "")}` };
        state.manualSuggestions.set(field.id, next);
        state.suggestions.set(field.id, next);
        checkbox.disabled = !text;
        checkbox.checked = Boolean(text);
        if (text) state.approved.add(field.id);
        else state.approved.delete(field.id);
        evidence.textContent = next.source;
        card.classList.toggle("supported", Boolean(text));
        card.classList.toggle("unsupported", !text);
        updateCounts();
      };
      editor.addEventListener("input", () => applyEdit(editor.value));
      editor.addEventListener("change", () => applyEdit(editor.value));
      suggestionBox.append(editor);
      const alternatives = [...new Set((suggestion.alternatives || []).map((value) => String(value || "").trim()).filter((value) => value && value !== suggestion.text))].slice(0, 2);
      if (alternatives.length) {
        const chooser = document.createElement("div");
        chooser.className = "alternative-list";
        const label = document.createElement("strong");
        label.textContent = "MeritOS is less certain — choose one or edit the answer:";
        chooser.append(label);
        alternatives.forEach((value, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.innerHTML = `<b>Option ${index + 2}</b><span></span>`;
          button.querySelector("span").textContent = value;
          button.addEventListener("click", () => {
            editor.value = value;
            applyEdit(value);
          });
          chooser.append(button);
        });
        suggestionBox.append(chooser);
      }
    } else {
      suggestionBox.textContent = "Not enough verified context yet.";
    }
    if (canUseAi(field)) {
      const button = document.createElement("button");
      button.className = "draft-button";
      button.textContent = suggestion.kind === "ai" || suggestion.kind === "ai_inference" ? "Try another answer" : "Improve this answer";
      button.addEventListener("click", () => generateDrafts([field], button));
      card.querySelector(".field-actions").append(button);
    }
    $("fields").append(card);
  });
  if (!state.fields.length) $("fields").innerHTML = '<p class="empty">No supported application questions were found on this page.</p>';
  updateCounts();
}

function renderRunResults(message = "") {
  const root = $("runResults");
  root.hidden = false;
  root.innerHTML = "";
  if (!state.runResults.length) {
    root.innerHTML = `<div class="run-search-note">${message || "No live matches found. Try a broader field, location, or student level."}</div>`;
    $("startRun").hidden = true;
    return;
  }
  state.runResults.forEach((item, index) => {
    const row = document.createElement("label");
    row.className = "run-result";
    row.innerHTML = '<input type="checkbox"><div><strong></strong><small></small></div><span class="run-fit"></span>';
    row.querySelector("strong").textContent = `${item.title} · ${item.company}`;
    row.querySelector("small").textContent = `${item.location} · ${item.source}`;
    row.querySelector(".run-fit").textContent = `${item.fitScore}% fit`;
    const input = row.querySelector("input");
    input.checked = state.selectedRuns.has(index);
    input.addEventListener("change", () => { if (input.checked) state.selectedRuns.add(index); else state.selectedRuns.delete(index); $("startRun").hidden = state.selectedRuns.size === 0; $("startRun").textContent = `Prepare ${state.selectedRuns.size} selected`; });
    root.append(row);
  });
  $("startRun").hidden = state.selectedRuns.size === 0;
}

async function searchApplicationRuns() {
  const query = $("runQuery").value.trim();
  if (query.length < 5) return renderRunResults("Describe a field, program type, timing, or location first.");
  $("searchRuns").disabled = true; $("searchRuns").textContent = "Searching…";
  renderRunResults("Searching live public opportunity boards…");
  try {
    const response = await fetch(`${state.baseUrl}/api/extension/discover`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` }, body: JSON.stringify({ query }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Search failed.");
    state.runResults = data.items || []; state.selectedRuns = new Set(state.runResults.slice(0, 3).map((_, index) => index));
    renderRunResults(); $("startRun").textContent = `Prepare ${state.selectedRuns.size} selected`;
  } catch (error) { state.runResults = []; state.selectedRuns.clear(); renderRunResults(error.message || "Search failed."); }
  finally { $("searchRuns").disabled = false; $("searchRuns").textContent = "Find"; }
}

function renderApplicationRun() {
  const run = state.applicationRun;
  const report = state.lastRunReport;
  const active = Boolean(run?.active);
  const phase = run?.phase || "ready";
  $("runProgress").hidden = !run;
  $("resumeRun").hidden = !run || (active && !["paused", "review"].includes(phase));
  $("resumeRun").textContent = phase === "review" && run?.queue?.length ? `Next (${run.queue.length})` : "Resume";
  $("startRun").disabled = state.runBusy;
  $("runBadge").textContent = state.runBusy ? "Working" : phase === "paused" ? "Needs you" : phase === "review" ? "Review" : active ? "Running" : "Ready";
  $("runBadge").className = `run-badge ${state.runBusy || active ? "working" : ""} ${phase === "paused" ? "blocked" : ""}`.trim();
  $("runStatus").textContent = run?.message || "Ready to prepare an application.";
  $("runSummary").textContent = report ? `${report.filled} filled · ${report.missing.length} missing · ${report.review.length} verify${run?.queue?.length ? ` · ${run.queue.length} queued` : ""}` : "MeritOS stops before Submit.";
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
  const selected = [...state.selectedRuns].map((index) => state.runResults[index]).filter(Boolean);
  if (!selected.length) {
    state.applicationRun = { active: false, phase: "paused", message: "Find and select at least one opportunity first.", steps: 0, autoContinue: $("autoContinueRun").checked };
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
    url: selected[0].url,
    opportunity: selected[0],
    queue: selected.slice(1),
    tabId: tab.id,
    steps: 0,
    navigationHops: 0,
    visitedUrls: [selected[0].url],
    autoContinue: $("autoContinueRun").checked,
    startedAt: new Date().toISOString(),
  };
  await persistApplicationRun();
  await chrome.storage.local.set({ meritosApplicationQueue: selected });
  await chrome.tabs.update(tab.id, { url: selected[0].url, active: true });
}

async function stopApplicationRun(message = "Application Run ended. The prepared form remains open for review.") {
  if (!state.applicationRun) return;
  state.applicationRun = { ...state.applicationRun, active: false, phase: "review", message };
  await persistApplicationRun();
}

async function resumeApplicationRun() {
  const tab = await activeTab();
  if (!tab?.id) return;
  if (state.applicationRun?.phase === "review" && state.applicationRun?.queue?.length) {
    const [next, ...queue] = state.applicationRun.queue;
    state.lastRunReport = null;
    state.activeFrameId = null;
    state.applicationRun = { ...state.applicationRun, active: true, phase: "opening", message: `Opening ${next.title}…`, url: next.url, opportunity: next, queue, steps: 0, navigationHops: 0, visitedUrls: [next.url], tabId: tab.id };
    await persistApplicationRun();
    await chrome.tabs.update(tab.id, { url: next.url, active: true });
    return;
  }
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
  let rerunAfterStabilizing = false;
  state.applicationRun = { ...run, phase: "running", message: `Preparing page ${(run.steps || 0) + 1}…` };
  renderApplicationRun();
  try {
    const initialPage = await sendToTopPage({ type: "MERITOS_PAGE_STATE" }).catch(() => null);
    if (initialPage?.kind === "captcha") {
      state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", pauseReason: "captcha", message: "This site requires a human verification step. Complete it, then press Resume." };
      return;
    }
    if (initialPage?.kind === "login") {
      const accountAction = initialPage.actions?.signup || initialPage.actions?.login;
      if (accountAction?.id) await sendToTopPage({ type: "MERITOS_GUIDE_ACTION", actionId: accountAction.id, step: "Account required", title: `Click "${accountAction.label}"`, instruction: "Complete this website's account step. MeritOS stays connected and will continue automatically when the application form appears." });
      state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", pauseReason: "login_required", message: accountAction?.label ? `The exact "${accountAction.label}" control is highlighted. Complete the account step; MeritOS will continue when the form appears.` : "Complete this website's sign-in or account step. MeritOS will continue when the form appears." };
      return;
    }
    await scan();
    if (!state.fields.length) {
      const page = initialPage || await sendToTopPage({ type: "MERITOS_PAGE_STATE" });
      const hops = Number(run.navigationHops || 0);
      const visited = new Set(Array.isArray(run.visitedUrls) ? run.visitedUrls : [run.url].filter(Boolean));
      if (page?.kind === "captcha") {
        state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", pauseReason: "captcha", message: "This site requires a human verification step. Complete the CAPTCHA, then press Resume." };
        return;
      }
      if (page?.kind === "login") {
        const accountAction = page.actions?.signup || page.actions?.login;
        if (accountAction?.id) await sendToTopPage({ type: "MERITOS_GUIDE_ACTION", actionId: accountAction.id, step: "Account required", title: `Click “${accountAction.label}”`, instruction: "Complete the account step on this website. MeritOS will keep your profile connected and continue when you press Resume." });
        state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", pauseReason: "login_required", message: accountAction?.label ? `The exact “${accountAction.label}” control is highlighted on the page. Complete that account step, then press Resume.` : "Sign in or create the required applicant account, then press Resume. Your MeritOS profile stays connected." };
        return;
      }
      if (page?.kind === "landing" && page.applicationLink && hops < 5) {
        const nextUrl = page.applicationLink.url || "";
        if (nextUrl && visited.has(nextUrl)) {
          state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", pauseReason: "navigation_loop", message: "The Apply link returned to a page MeritOS already checked. Open the official application form, then press Resume." };
          return;
        }
        if (nextUrl) visited.add(nextUrl);
        state.applicationRun = {
          ...state.applicationRun,
          active: true,
          phase: "navigating",
          pauseReason: "",
          message: `Found ${page.applicationLink.ats || "the official"} application. Opening “${page.applicationLink.label || "Apply"}”…`,
          navigationHops: hops + 1,
          visitedUrls: [...visited].slice(-8),
        };
        await persistApplicationRun();
        state.activeFrameId = null;
        if (nextUrl && nextUrl !== page.url) await chrome.tabs.update(tab.id, { url: nextUrl, active: true });
        else {
          const clicked = await sendToTopPage({ type: "MERITOS_CLICK_APPLICATION_ENTRY", actionId: page.applicationLink.id });
          if (!clicked?.clicked) {
            await sendToTopPage({ type: "MERITOS_GUIDE_ACTION", actionId: page.applicationLink.id, step: "Open application", title: `Click “${page.applicationLink.label || "Apply"}”`, instruction: "This website blocked automatic navigation. Click the highlighted control once, then press Resume in MeritOS." });
            state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", pauseReason: "apply_control_failed", message: "MeritOS highlighted the Apply control the website requires you to click. Click it once, then press Resume." };
          }
        }
        return;
      }
      if (page?.kind === "ats_waiting") {
        state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", pauseReason: "ats_not_ready", message: `${page.ats || "The application system"} loaded, but no questions are visible yet. Finish any sign-in or introductory step, then press Resume.` };
        return;
      }
      state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", pauseReason: "no_form_or_apply_link", message: "This page has no application fields and no reliable Apply link. Open the official application form, then press Resume." };
      return;
    }

    const existing = new Set(state.fields.filter(fieldHasUserValue).map((field) => field.id));
    const fillable = state.fields.filter((field) => field.control !== "file" && !existing.has(field.id) && safeForBatch(state.suggestions.get(field.id)));
    const items = fillable.map((field) => ({ fieldId: field.id, value: state.suggestions.get(field.id).text }));
    const fillResult = items.length ? await sendToPage({ type: "MERITOS_FILL_MANY", items }) : { results: [] };
    const filledIds = new Set((fillResult.results || []).filter((item) => item.filled).map((item) => item.fieldId));
    const failedIds = new Set((fillResult.results || []).filter((item) => !item.filled).map((item) => item.fieldId));
    const missing = state.fields
      .filter((field) => !existing.has(field.id) && (!state.suggestions.get(field.id)?.text || failedIds.has(field.id)))
      .map((field) => ({
        fieldId: field.id,
        label: field.label,
        required: Boolean(field.required),
        kind: "missing",
        reasonCode: field.control === "file" ? "document_upload_required" : failedIds.has(field.id) ? "control_fill_failed" : state.suggestions.get(field.id)?.text ? "unsafe_or_sensitive" : "missing_profile_evidence",
        reason: field.control === "file" ? "Select the requested document for this upload field" : failedIds.has(field.id) ? "The website rejected automatic input for this control" : state.suggestions.get(field.id)?.source || "More verified profile context is needed",
      }));
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

    const postFill = await sendToPage({ type: "MERITOS_SCAN_STABLE", passes: 2 });
    const fieldSignature = (field) => [field.name, field.label, field.control, field.type].map((value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).join("|");
    const originalFields = new Set(state.fields.map(fieldSignature));
    const revealed = (postFill?.fields || []).filter((field) => !originalFields.has(fieldSignature(field)));
    if (revealed.length && Number(run.dynamicPasses || 0) < 2) {
      state.applicationRun = { ...state.applicationRun, active: true, dynamicPasses: Number(run.dynamicPasses || 0) + 1, message: `${revealed.length} follow-up question${revealed.length === 1 ? " appeared" : "s appeared"}. MeritOS is mapping them now…` };
      rerunAfterStabilizing = true;
      return;
    }

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
      await sendToPage({ type: "MERITOS_GUIDE_ACTION", fieldId: requiredMissing[0].fieldId, step: "Your input needed", title: requiredMissing[0].label || "Complete the highlighted field", instruction: requiredMissing[0].reason || "MeritOS does not have enough reliable context for this answer yet." });
      state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", message: `${requiredMissing.length} required answer${requiredMissing.length === 1 ? " needs" : "s need"} you. Complete the highlighted fields, then press Resume.` };
    } else if (actions?.final?.found) {
      await sendToPage({ type: "MERITOS_GUIDE_ACTION", actionId: actions.final.id, step: "Final review", title: `Review before “${actions.final.label}”`, instruction: "MeritOS prepared the page and stopped here. Check the highlighted inferences, then submit only when you are satisfied." });
      state.applicationRun = { ...state.applicationRun, active: false, phase: "review", message: `Prepared for final review. MeritOS stopped before “${actions.final.label}”.` };
    } else {
      state.applicationRun = { ...state.applicationRun, active: false, phase: "review", message: "This page is prepared. Review highlighted answers and submit only when you are satisfied." };
    }
  } catch (error) {
    state.applicationRun = { ...state.applicationRun, active: false, phase: "paused", message: error.message || "The application changed during the run. Press Resume to try this page again." };
  } finally {
    state.runBusy = false;
    await persistApplicationRun();
    if (rerunAfterStabilizing) window.setTimeout(() => executeApplicationRun(), 250);
  }
}

async function scan() {
  $("scanStatus").textContent = "Scanning page…";
  $("rescanButton").disabled = true;
  try {
    state.activeFrameId = null;
    let result = await sendToTopPage({ type: "MERITOS_SCAN_STABLE", passes: 3 });
    if (!result?.fields?.length) result = await scanBestFrame() || result;
    state.fields = result.fields || [];
    state.approved.clear();
    state.aiSuggestions.clear();
    state.manualSuggestions.clear();
    $("pageTitle").textContent = result.title || "Application form";
    renderFields({ autoSelect: true });
    const frameNote = Number.isInteger(state.activeFrameId) && state.activeFrameId !== 0 ? " · embedded form connected" : "";
    $("scanStatus").textContent = `${state.fields.length} question${state.fields.length === 1 ? "" : "s"} mapped${frameNote} · profile connected across tabs`;
    const tab = await activeTab();
    const autoFields = state.fields.filter(needsAiCompletion).slice(0, 20);
    const analysisKey = `${tab?.url || result.title || ""}|${state.fields.map((field) => field.id).join("|")}|${state.claims.length}`;
    if (state.proactive && autoFields.length && state.autoAnalysisKey !== analysisKey) {
      state.autoAnalysisKey = analysisKey;
      await generateDrafts(autoFields, $("rescanButton"), { automatic: true });
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
      body: JSON.stringify({ fields, mode: state.proactive ? state.initiativeMode : "standard", organizationApplication: state.organizationApplication, page: { title: tab?.title || "", url: tab?.url || "" } }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not analyze this form.");
    (data.results || []).forEach((result, index) => {
      const field = fields[index];
      if (!field) return;
      state.manualSuggestions.delete(field.id);
      const intent = deterministic(field).intent;
      const assumptions = Array.isArray(result.assumptions) ? result.assumptions.filter(Boolean) : [];
      const inferred = assumptions.length > 0 || result.confidence === "low";
      const confidence = result.confidence || "medium";
      state.aiSuggestions.set(field.id, result.status === "draft" && result.draft
        ? { text: result.draft, alternatives: Array.isArray(result.alternatives) ? result.alternatives : [], confidence, source: `${inferred ? "Proactive inference" : "AI answer"} · ${confidence} confidence · ${result.usedEvidenceIds.length} verified fact${result.usedEvidenceIds.length === 1 ? "" : "s"}${assumptions.length ? ` · Assumption: ${assumptions.join("; ")}` : ""} · review before filling`, intent, kind: inferred ? "ai_inference" : "ai" }
        : { text: "", source: result.questions?.[0] || "More verified context is required.", intent, kind: "missing" });
    });
    renderFields({ autoSelect: true });
    $("scanStatus").textContent = automatic ? "Answers refreshed automatically · uncertain suggestions still need your choice" : "Answer refreshed · edit it or choose a grounded alternative";
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
  const requestedToken = state.token;
  try {
    response = await fetch(`${state.baseUrl}/api/extension/profile`, { headers: { Authorization: `Bearer ${requestedToken}` } });
  } catch (error) {
    if (allowCache && state.claims.length) return false;
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      if (state.token !== requestedToken) return false;
      const stored = await chrome.storage.local.get(["meritosToken"]);
      if (stored.meritosToken === requestedToken) await chrome.storage.local.remove(["meritosToken", "meritosProfile"]);
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
$("searchRuns").addEventListener("click", () => void searchApplicationRuns());
$("runQuery").addEventListener("keydown", (event) => { if (event.key === "Enter") void searchApplicationRuns(); });
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
$("proactiveMode").addEventListener("change", async (event) => {
  state.proactive = event.target.checked;
  state.initiativeMode = state.proactive ? "proactive" : "careful";
  state.autoAnalysisKey = "";
  state.aiSuggestions.clear();
  state.manualSuggestions.clear();
  await chrome.storage.local.set({ meritosProactive: state.proactive, meritosInitiativeMode: state.initiativeMode });
  await scan();
});
$("organizationMode").addEventListener("change", async (event) => {
  state.organizationApplication = event.target.checked;
  state.autoAnalysisKey = "";
  state.aiSuggestions.clear();
  state.manualSuggestions.clear();
  await chrome.storage.local.set({ meritosOrganizationApplication: state.organizationApplication });
  await scan();
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
    $("scanStatus").textContent = "The page changed before filling. Refresh answers and try again.";
  } finally {
    $("fillApproved").disabled = false;
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!["MERITOS_FORM_DETECTED", "MERITOS_APPLICATION_ENTRY_DETECTED"].includes(message?.type) || !sender.tab?.id) return;
  void activeTab().then((tab) => {
    if (tab?.id === sender.tab.id) scheduleAutomaticScan(message.type === "MERITOS_FORM_DETECTED" ? 260 : 420);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  const nextToken = changes.meritosToken?.newValue;
  const tokenAvailable = typeof nextToken === "string" && Boolean(nextToken);
  if (changes.meritosBaseUrl?.newValue) {
    state.baseUrl = String(changes.meritosBaseUrl.newValue).replace(/\/$/, "");
    $("baseUrl").value = state.baseUrl;
  }
  if (changes.meritosProfile?.newValue) {
    hydrateProfile(changes.meritosProfile.newValue);
    if (state.token || tokenAvailable) showAssistant();
  }
  if (changes.meritosOrganizationApplication) {
    state.organizationApplication = changes.meritosOrganizationApplication.newValue !== false;
    $("organizationMode").checked = state.organizationApplication;
    state.autoAnalysisKey = "";
  }
  if (tokenAvailable) {
    state.token = nextToken;
    $("token").value = nextToken;
    showAssistant();
    window.clearTimeout(storageSyncTimer);
    storageSyncTimer = window.setTimeout(() => scheduleAutomaticScan(80), 80);
  } else if (changes.meritosToken && !nextToken && state.token) {
    state.token = "";
    showConnection("Your MeritOS connection was removed in another tab.");
  }
  if (changes.meritosApplicationRun) {
    state.applicationRun = changes.meritosApplicationRun.newValue || null;
    renderApplicationRun();
    if (state.applicationRun?.active) scheduleAutomaticScan(180, { resetAnalysis: false });
  }
  if (changes.meritosApplicationRunReport) {
    state.lastRunReport = changes.meritosApplicationRunReport.newValue || null;
    renderApplicationRun();
  }
});

chrome.tabs.onActivated.addListener(() => scheduleAutomaticScan(180, { resetAnalysis: false }));
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  const tab = await activeTab();
  if (tab?.id !== tabId) return;
  scheduleAutomaticScan(changeInfo.url ? 260 : 420);
});

(async () => {
  const stored = await chrome.storage.local.get(["meritosBaseUrl", "meritosToken", "meritosProfile", "meritosProactive", "meritosOrganizationApplication", "meritosInitiativeMode", "meritosApplicationRun", "meritosApplicationRunReport", "meritosApplicationQueue"]);
  state.proactive = stored.meritosProactive !== false;
  state.organizationApplication = stored.meritosOrganizationApplication !== false;
  state.initiativeMode = ["careful", "proactive", "high_initiative"].includes(stored.meritosInitiativeMode) ? stored.meritosInitiativeMode : (state.proactive ? "proactive" : "careful");
  // Opportunity search/autopilot is intentionally disabled in the accuracy-validation release.
  state.applicationRun = null;
  await chrome.storage.local.remove(["meritosApplicationRun", "meritosApplicationQueue"]);
  state.lastRunReport = stored.meritosApplicationRunReport || null;
  $("proactiveMode").checked = state.proactive;
  $("organizationMode").checked = state.organizationApplication;
  $("autoContinueRun").checked = state.applicationRun?.autoContinue !== false;
  renderApplicationRun();
  if (stored.meritosBaseUrl) $("baseUrl").value = stored.meritosBaseUrl;
  if (!stored.meritosToken) return;
  state.baseUrl = stored.meritosBaseUrl || $("baseUrl").value;
  state.token = stored.meritosToken;
  $("token").value = stored.meritosToken;
  if (stored.meritosProfile) {
    hydrateProfile(stored.meritosProfile);
    showAssistant();
    if (!state.applicationRun?.active) await scan();
  }
  try {
    await refreshProfile({ allowCache: true });
    showAssistant();
    if (!stored.meritosProfile && !state.applicationRun?.active) await scan();
    if (state.applicationRun?.active) await executeApplicationRun();
  } catch (error) {
    showConnection(error.message);
  }
})();
