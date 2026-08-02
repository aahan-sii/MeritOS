const state = {
  claims: [],
  coverage: [],
  identity: { displayName: "", email: "", headline: "" },
  activeOpportunity: null,
  fields: [],
  suggestions: new Map(),
  aiSuggestions: new Map(),
  approved: new Set(),
  baseUrl: "",
  token: "",
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
  return globalThis.MeritOSIntelligence.canDraftField(field);
}

function safeForBatch(suggestion) {
  return suggestion?.text && ["identity", "evidence"].includes(suggestion.kind);
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
  $("analyzeMissing").disabled = !state.fields.some((field) => !state.suggestions.get(field.id)?.text && canUseAi(field));
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
  } catch {
    state.fields = [];
    renderFields();
    $("pageTitle").textContent = "Open an application form";
    $("scanStatus").textContent = "This page could not be scanned. The profile connection is still saved.";
  } finally {
    $("rescanButton").disabled = false;
  }
}

async function generateDrafts(fields, button) {
  if (!fields.length) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = fields.length > 1 ? "Analyzing…" : "Drafting…";
  try {
    const tab = await activeTab();
    const response = await fetch(`${state.baseUrl}/api/extension/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ fields, page: { title: tab?.title || "", url: tab?.url || "" } }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not analyze this form.");
    (data.results || []).forEach((result, index) => {
      const field = fields[index];
      if (!field) return;
      const intent = deterministic(field).intent;
      state.aiSuggestions.set(field.id, result.status === "draft" && result.draft
        ? { text: result.draft, source: `AI answer grounded in ${result.usedEvidenceIds.length} verified fact${result.usedEvidenceIds.length === 1 ? "" : "s"} · review before filling`, intent, kind: "ai" }
        : { text: "", source: result.questions?.[0] || "More verified context is required.", intent, kind: "missing" });
    });
    renderFields();
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
$("rescanButton").addEventListener("click", scan);
$("settingsButton").addEventListener("click", () => {
  $("connection").hidden = !$("connection").hidden;
  $("assistant").hidden = !$("assistant").hidden;
});
$("analyzeMissing").addEventListener("click", () => generateDrafts(state.fields.filter((field) => !state.suggestions.get(field.id)?.text && canUseAi(field)).slice(0, 20), $("analyzeMissing")));
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

chrome.tabs.onActivated.addListener(() => window.setTimeout(scan, 180));
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  const tab = await activeTab();
  if (tab?.id === tabId) scan();
});

(async () => {
  const stored = await chrome.storage.local.get(["meritosBaseUrl", "meritosToken", "meritosProfile"]);
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
