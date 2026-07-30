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

function questionIntent(field) {
  const value = `${field.label} ${field.type} ${field.name || ""}`.toLowerCase();
  if (field.type === "email" || /\b(e-?mail|email address)\b/.test(value)) return "email";
  if (/\b(full name|legal name|applicant name|your name)\b/.test(value)) return "name";
  if (/\b(school|institution|university|college|organization|organisation|employer)\b/.test(value)) return "institution";
  if (/\b(why.*apply|why.*fellowship|motivation|motivated|interest in this|personal statement|statement of purpose)\b/.test(value)) return "motivation";
  if (/\b(research|laboratory|experiment|publication|academic investigation)\b/.test(value)) return "research";
  if (/\b(leadership|initiative|led a|manage|mentor|team leader)\b/.test(value)) return "leadership";
  if (/\b(project|built|developed|created|technical work|impact)\b/.test(value)) return "project";
  if (/\b(community|volunteer|service|outreach|contributed|civic)\b/.test(value)) return "community";
  if (/\b(award|honou?r|achievement|distinction|recognition|scholarship)\b/.test(value)) return "award";
  if (/\b(education|coursework|degree|gpa|academic background)\b/.test(value)) return "education";
  return "unknown";
}

function claimIntent(claim) {
  const value = `${claim.category} ${claim.statement}`.toLowerCase();
  if (/\b(award|honou?r(?:able)?|distinction|dean'?s list|finalist|winner|scholarship|medal|champion|gold|silver|bronze)\b/.test(value)) return "award";
  if (/\b(volunteer|community service|nonprofit|outreach|tutor(?:ed|ing)?|fundrais)\b/.test(value)) return "community";
  if (/\b(led|founded|president|captain|chair|coordinated|organized|managed|mentored|supervised)\b/.test(value)) return "leadership";
  if (/\b(research|laboratory|lab\b|genomics|bioinformatics|publication|poster|abstract|experiment)\b/.test(value)) return "research";
  if (/\b(project|built|developed|designed|created|implemented|engineered|prototype|platform)\b/.test(value)) return "project";
  if (/\b(university|college|school|academy|degree|gpa|coursework|graduat(?:ed|ion))\b/.test(value)) return "education";
  if (/\b(motivation|reason for applying|career goal|aspire|passion)\b/.test(value)) return "motivation";
  return "unknown";
}

function identitySuggestion(intent, field) {
  if (intent === "name" && state.identity.displayName) {
    return { text: state.identity.displayName, source: "Account profile · verified identity", intent };
  }
  if (intent === "email" && state.identity.email) {
    return { text: state.identity.email, source: "Account profile · verified email", intent };
  }
  if (intent === "institution") {
    const education = state.claims.find((claim) => claimIntent(claim) === "education");
    if (education) {
      return {
        text: education.statement.slice(0, field.maxLength || 500),
        source: `Verified profile · ${education.category}`,
        intent,
      };
    }
  }
  return null;
}

function suggestionFor(field) {
  const intent = questionIntent(field);
  const identity = identitySuggestion(intent, field);
  if (identity) return identity;

  if (intent === "motivation") {
    const motivation = state.claims.filter((claim) => claimIntent(claim) === "motivation");
    if (!motivation.length) {
      return {
        text: "",
        source: "Needs your input — a résumé cannot prove why you want this specific opportunity",
        intent,
      };
    }
  }
  if (intent === "unknown") {
    return { text: "", source: "Question intent is unclear — answer manually", intent };
  }

  const ranked = state.claims
    .map((claim) => ({ claim, type: claimIntent(claim) }))
    .filter((item) => item.type === intent);
  if (!ranked.length) {
    return {
      text: "",
      source: `No verified ${intent} evidence found — answer manually or add evidence`,
      intent,
    };
  }

  const narrative = ["research", "leadership", "project", "community"].includes(intent);
  const selected = ranked.slice(0, narrative ? 2 : 1);
  return {
    text: selected
      .map((item) => item.claim.statement.trim())
      .filter(Boolean)
      .join("\n\n")
      .slice(0, field.maxLength || 2000),
    source: `${selected.length} verified ${intent} evidence item${selected.length === 1 ? "" : "s"}`,
    intent,
  };
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
  state.approved = new Set(
    state.fields.filter((field) => state.suggestions.get(field.id)?.text).map((field) => field.id),
  );
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
