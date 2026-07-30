const state = {
  claims: [],
  identity: { displayName: "", email: "", headline: "" },
  fields: [],
  suggestions: new Map(),
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
  if (!tab?.id) throw new Error("No active page found.");
  return chrome.tabs.sendMessage(tab.id, message);
}

function suggestionFor(field) {
  return globalThis.MeritOSIntelligence.suggest(field, state.claims, state.identity);
}

function updateApprovalCount() {
  $("approvedCount").textContent = state.approved.size;
  $("fillApproved").disabled = state.approved.size === 0;
}

function renderFields() {
  $("fieldCount").textContent = `${state.fields.length} field${state.fields.length === 1 ? "" : "s"}`;
  $("profileCount").textContent = `${state.claims.length} verified facts`;
  $("fields").innerHTML = "";
  state.suggestions.clear();
  state.fields.forEach((field) => {
    const suggestion = suggestionFor(field);
    state.suggestions.set(field.id, suggestion);
    const card = document.createElement("article");
    card.className = `field ${suggestion.text ? "supported" : "unsupported"}`;
    card.innerHTML = `<div class="field-top"><input type="checkbox" aria-label="Approve answer"><div><h2></h2><div class="meta"></div></div><span class="intent"></span></div><div class="suggestion"></div><div class="evidence"></div>`;
    card.querySelector("h2").textContent = field.label;
    card.querySelector(".meta").textContent = `${field.required ? "Required" : "Optional"} · ${field.kind}`;
    card.querySelector(".intent").textContent = suggestion.intent === "unknown" ? "Needs review" : suggestion.intent;
    card.querySelector(".suggestion").textContent = suggestion.text || "No supported answer found.";
    card.querySelector(".evidence").textContent = suggestion.source;
    const checkbox = card.querySelector("input");
    checkbox.disabled = !suggestion.text;
    checkbox.checked = state.approved.has(field.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.approved.add(field.id);
      else state.approved.delete(field.id);
      updateApprovalCount();
    });
    $("fields").append(card);
  });
  if (!state.fields.length) {
    $("fields").innerHTML = `<p class="empty">No editable application fields were detected on this page.</p>`;
  }
  updateApprovalCount();
}

async function scan() {
  try {
    const result = await sendToPage({ type: "MERITOS_SCAN" });
    state.fields = result.fields;
    state.approved.clear();
    $("pageTitle").textContent = result.title || "Application form";
    $("fillApproved").textContent = "Fill selected";
    renderFields();
  } catch {
    state.fields = [];
    renderFields();
    $("pageTitle").textContent = "Open a regular website to scan it";
  }
}

async function connect() {
  state.baseUrl = $("baseUrl").value.replace(/\/$/, "");
  state.token = $("token").value.trim();
  $("connectStatus").textContent = "Connecting…";
  try {
    const response = await fetch(`${state.baseUrl}/api/extension/profile`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not connect.");
    state.claims = data.profile.claims || [];
    state.identity = data.profile.identity || state.identity;
    await chrome.storage.local.set({ meritosBaseUrl: state.baseUrl, meritosToken: state.token });
    $("connection").hidden = true;
    $("assistant").hidden = false;
    await scan();
  } catch (error) {
    $("connectStatus").textContent = error.message;
  }
}

$("connectButton").addEventListener("click", connect);
$("rescanButton").addEventListener("click", scan);
$("settingsButton").addEventListener("click", () => {
  $("connection").hidden = !$("connection").hidden;
  $("assistant").hidden = !$("assistant").hidden;
});
$("selectAll").addEventListener("click", () => {
  state.approved = new Set(state.fields.filter((field) => state.suggestions.get(field.id)?.text).map((field) => field.id));
  renderFields();
});
$("clearSelections").addEventListener("click", () => {
  state.approved.clear();
  renderFields();
});
$("fillApproved").addEventListener("click", async () => {
  $("fillApproved").disabled = true;
  $("fillApproved").textContent = "Filling…";
  let filled = 0;
  for (const field of state.fields.filter((item) => state.approved.has(item.id))) {
    const suggestion = state.suggestions.get(field.id);
    if (!suggestion?.text) continue;
    const result = await sendToPage({ type: "MERITOS_FILL", fieldId: field.id, value: suggestion.text });
    if (result?.filled) filled += 1;
  }
  $("fillApproved").textContent = `${filled} filled — review`;
  $("fillApproved").disabled = false;
});

(async () => {
  const stored = await chrome.storage.local.get(["meritosBaseUrl", "meritosToken"]);
  if (stored.meritosBaseUrl) $("baseUrl").value = stored.meritosBaseUrl;
  if (stored.meritosToken) {
    $("token").value = stored.meritosToken;
    await connect();
  }
})();
