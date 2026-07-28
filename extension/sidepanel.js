const state = { profile: [], fields: [], approved: new Set(), baseUrl: "", token: "" };
const $ = (id) => document.getElementById(id);

async function activeTab() {
  return (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
}

async function sendToPage(message) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active page found.");
  return chrome.tabs.sendMessage(tab.id, message);
}

function terms(value) {
  return new Set(value.toLowerCase().match(/[a-z0-9]{4,}/g) || []);
}

function suggestionFor(field) {
  const questionTerms = terms(field.label);
  const ranked = state.profile.map((claim) => {
    const claimTerms = terms(`${claim.category} ${claim.statement}`);
    let score = 0;
    questionTerms.forEach((term) => { if (claimTerms.has(term)) score += 2; });
    ["leadership","research","community","education","award","experience","impact","project"].forEach((term) => {
      if (field.label.toLowerCase().includes(term) && `${claim.category} ${claim.statement}`.toLowerCase().includes(term)) score += 3;
    });
    return { claim, score };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score === 0) return { text: "", source: "Missing information — answer manually" };
  return { text: best.claim.statement.slice(0, field.maxLength || 2000), source: `Verified profile · ${best.claim.category}` };
}

function renderFields() {
  $("fieldCount").textContent = `${state.fields.length} field${state.fields.length === 1 ? "" : "s"}`;
  $("profileCount").textContent = `${state.profile.length} verified facts`;
  $("fields").innerHTML = "";
  state.fields.forEach((field) => {
    const suggestion = suggestionFor(field);
    const card = document.createElement("article");
    card.className = "field";
    card.innerHTML = `<div class="field-top"><input type="checkbox" aria-label="Approve answer"><div><h2></h2><div class="meta"></div></div></div><div class="suggestion"></div><div class="evidence"></div>`;
    card.querySelector("h2").textContent = field.label;
    card.querySelector(".meta").textContent = `${field.required ? "Required" : "Optional"} · ${field.kind}`;
    card.querySelector(".suggestion").textContent = suggestion.text || "No supported answer found.";
    card.querySelector(".evidence").textContent = suggestion.source;
    const checkbox = card.querySelector("input");
    checkbox.disabled = !suggestion.text;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.approved.add(field.id);
      else state.approved.delete(field.id);
      $("approvedCount").textContent = state.approved.size;
    });
    $("fields").append(card);
  });
  if (!state.fields.length) $("fields").innerHTML = `<p class="empty">No editable application fields were detected on this page.</p>`;
}

async function scan() {
  try {
    const result = await sendToPage({ type: "MERITOS_SCAN" });
    state.fields = result.fields;
    state.approved.clear();
    $("approvedCount").textContent = "0";
    $("pageTitle").textContent = result.title || "Application form";
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
    const response = await fetch(`${state.baseUrl}/api/extension/profile`, { headers: { Authorization: `Bearer ${state.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not connect.");
    state.profile = data.profile.claims || [];
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
$("fillApproved").addEventListener("click", async () => {
  for (const field of state.fields.filter((item) => state.approved.has(item.id))) {
    const suggestion = suggestionFor(field);
    if (suggestion.text) await sendToPage({ type: "MERITOS_FILL", fieldId: field.id, value: suggestion.text });
  }
  $("fillApproved").textContent = "Filled — review page";
});

(async () => {
  const stored = await chrome.storage.local.get(["meritosBaseUrl", "meritosToken"]);
  if (stored.meritosBaseUrl) $("baseUrl").value = stored.meritosBaseUrl;
  if (stored.meritosToken) { $("token").value = stored.meritosToken; await connect(); }
})();
