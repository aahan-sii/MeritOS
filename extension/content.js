const MeritForm = globalThis.MeritOSFormCore;
const MeritNav = globalThis.MeritOSNavigationCore;

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const trustedMeritOSOrigin = event.origin === "https://merit-os-jflo.vercel.app" || /^http:\/\/localhost(?::\d+)?$/.test(event.origin);
  if (!trustedMeritOSOrigin) return;
  if (event.data?.type === "MERITOS_SET_OPPORTUNITY_ALERT") {
    chrome.runtime.sendMessage({ type: "MERITOS_SET_OPPORTUNITY_ALERT", enabled: event.data.enabled === true, query: String(event.data.query || "").slice(0, 400) });
  }
  if (event.data?.type === "MERITOS_SET_INITIATIVE_MODE") {
    chrome.runtime.sendMessage({ type: "MERITOS_SET_INITIATIVE_MODE", mode: String(event.data.mode || "proactive") });
  }
  if (event.data?.type === "MERITOS_CONNECT_PROFILE") {
    const token = String(event.data.token || "");
    const baseUrl = String(event.data.baseUrl || event.origin || "");
    chrome.runtime.sendMessage({ type: "MERITOS_CONNECT_PROFILE", token, baseUrl }).then((result) => {
      window.postMessage({ type: "MERITOS_CONNECTION_RESULT", connected: result?.connected === true, error: result?.error || "" }, event.origin);
    }).catch(() => window.postMessage({ type: "MERITOS_CONNECTION_RESULT", connected: false, error: "Chrome could not receive the connection." }, event.origin));
  }
  if (event.data?.type === "MERITOS_QUEUE_APPLICATIONS") {
    const applications = Array.isArray(event.data.applications) ? event.data.applications.slice(0, 20).map((item) => ({ id: String(item.id || ""), title: String(item.title || "Application").slice(0, 200), organization: String(item.organization || "").slice(0, 200), url: String(item.url || "") })) : [];
    chrome.runtime.sendMessage({ type: "MERITOS_QUEUE_APPLICATIONS", applications, mode: String(event.data.mode || "proactive") });
  }
});
const baseSelector = [
  "input:not([type=hidden]):not([type=submit]):not([type=button])",
  "textarea",
  "select",
  "[contenteditable=true]",
  "[role=radiogroup]",
  "[role=listbox]",
  "[role=group]",
  "[role=radio]",
  "[role=checkbox]",
  "[role=combobox]",
  "[role=textbox]",
  "[role=spinbutton]",
  "[role=switch]",
  "button[aria-pressed]",
].join(",");

function visible(element) {
  if (!(element instanceof Element)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function cleanLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 700);
}

function labelledText(element) {
  const ids = (element.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
  return ids.map((id) => document.getElementById(id)?.innerText || "").join(" ");
}

function questionContainer(element) {
  return element.closest('[role="listitem"], .Qr7Oae, .freebirdFormviewerComponentsQuestionBaseRoot, fieldset, .form-group, .field, .question, .application-question, [data-question-id], [data-automation-id*="formField"], [data-testid*="field"], .jobs-easy-apply-form-section__grouping');
}

function labelFor(element) {
  const explicit = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.innerText : "";
  const container = questionContainer(element);
  const google = container?.querySelector('.M7eMe, [role="heading"], [data-question-title]')?.innerText;
  const nearby = container?.querySelector("legend, label, h1, h2, h3, h4, .label, .prompt")?.innerText;
  const wrapping = element.closest("label")?.innerText;
  return [explicit, labelledText(element), element.getAttribute("aria-label"), google, nearby, wrapping, element.placeholder, element.name]
    .map(cleanLabel)
    .find(Boolean) || "Unlabelled field";
}

function descriptionFor(element) {
  const container = questionContainer(element);
  const describedIds = (element.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
  const described = describedIds.map((id) => document.getElementById(id)?.innerText || "").join(" ");
  const hint = container?.querySelector('.description, .hint, .help-text, [data-automation-id*="help"], [data-testid*="description"]')?.innerText || "";
  return cleanLabel([described, hint].filter(Boolean).join(" ")).slice(0, 500);
}

function optionRecord(element, index) {
  const label = cleanLabel(
    element.getAttribute("aria-label") ||
    element.getAttribute("data-value") ||
    element.getAttribute("data-answer-value") ||
    (element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.innerText : "") ||
    element.closest("label")?.innerText ||
    element.value ||
    element.innerText,
  );
  return { id: element.dataset.meritosOptionId || `${index}`, label, value: String(element.getAttribute("data-value") || element.getAttribute("data-answer-value") || element.value || label) };
}

function groupOptions(element, control) {
  if (control === "select" && element instanceof HTMLSelectElement) return [...element.options].filter((option) => option.value || option.text).map((option, index) => ({ id: `${index}`, label: cleanLabel(option.text), value: option.value }));
  if (control === "select") return [...element.querySelectorAll('[role="option"]')].filter(visible).map(optionRecord).filter((option) => option.label);
  const selector = control === "radio"
    ? 'input[type="radio"], [role="radio"], button[aria-pressed]'
    : 'input[type="checkbox"], [role="checkbox"], button[aria-pressed]';
  const candidates = element.matches(selector) ? [element] : [...element.querySelectorAll(selector)];
  return candidates.filter(visible).map(optionRecord).filter((option) => option.label);
}

function controlFor(element) {
  if (element.matches('input[type="file"]')) return "file";
  if (element.matches('[role="radiogroup"], [role="radio"]') || element.matches('input[type="radio"]') || element.querySelector('input[type="radio"], [role="radio"]')) return "radio";
  if (element.matches('[role="listbox"], [role="combobox"]') || element instanceof HTMLSelectElement) return "select";
  if (element.matches('[role="group"]') && element.querySelector('[role="checkbox"], input[type="checkbox"], button[aria-pressed]')) return "checkbox";
  if (element.matches('input[type="checkbox"], [role="checkbox"], [role="switch"], button[aria-pressed]')) return element.closest('[role="radiogroup"]') ? "radio" : "checkbox";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element.isContentEditable) return "contenteditable";
  if (element instanceof HTMLInputElement) return element.type || "text";
  if (element.matches('[role="spinbutton"]')) return "number";
  return "text";
}

function canonicalElement(element) {
  if (element.matches('input[type="radio"], [role="radio"]')) {
    return element.closest('[role="radiogroup"], fieldset, [role="listitem"], .Qr7Oae, [data-question-id]') || element;
  }
  if (element.matches('input[type="checkbox"], [role="checkbox"], button[aria-pressed]')) {
    const group = element.closest('[role="group"], fieldset');
    if (group?.querySelectorAll('input[type="checkbox"], [role="checkbox"], button[aria-pressed]').length > 1) return group;
    const container = questionContainer(element);
    if (container?.querySelectorAll('[role="checkbox"], button[aria-pressed]').length > 1) return container;
  }
  if (element.matches('[role="group"]') && !element.querySelector('[role="checkbox"], input[type="checkbox"], button[aria-pressed]')) return null;
  return element;
}

function scan() {
  const seen = new Set();
  return [...document.querySelectorAll(baseSelector)]
    .filter(visible)
    .map(canonicalElement)
    .filter((element) => element && visible(element) && !seen.has(element) && seen.add(element))
    .map((element, index) => {
      if (!element.dataset.meritosFieldId) element.dataset.meritosFieldId = `meritos-${Date.now()}-${index}`;
      const control = controlFor(element);
      const options = groupOptions(element, control);
      return {
        id: element.dataset.meritosFieldId,
        label: labelFor(element),
        description: descriptionFor(element),
        name: element.getAttribute("name") || element.id || "",
        kind: element.tagName.toLowerCase(),
        type: element.getAttribute("type") || control,
        control,
        options,
        multiple: control === "checkbox" || element.multiple === true,
        currentValue: "value" in element ? element.value : element.innerText,
        required: element.required || element.getAttribute("aria-required") === "true" || Boolean(element.closest('[role="listitem"]')?.querySelector('[aria-label*="Required"], .vnumgf')),
        maxLength: element.maxLength > 0 ? element.maxLength : null,
        frameUrl: location.href,
        topFrame: window.top === window,
      };
    });
}

function fieldKey(field) {
  return [field.name, field.label, field.control, field.type].map((value) => MeritForm.normalize(value)).join("|");
}

async function scanStable(passes = 3) {
  const total = Math.max(1, Math.min(4, Number(passes) || 3));
  const merged = new Map();
  let previousSignature = "";
  let stablePasses = 0;
  for (let index = 0; index < total; index += 1) {
    if (index) await new Promise((resolve) => setTimeout(resolve, index === 1 ? 320 : 520));
    const fields = scan();
    for (const field of fields) {
      const key = fieldKey(field) || field.id;
      merged.set(key, { ...(merged.get(key) || {}), ...field });
    }
    const signature = [...merged.keys()].sort().join("\n");
    stablePasses = signature === previousSignature ? stablePasses + 1 : 0;
    previousSignature = signature;
    if (stablePasses >= 2) break;
  }
  return { fields: [...merged.values()], title: document.title, url: location.href, topFrame: window.top === window, stabilized: true };
}

function jsonLdApplicationUrls() {
  const urls = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== "object") return;
    const type = Array.isArray(value["@type"]) ? value["@type"].join(" ") : String(value["@type"] || "");
    if (/JobPosting|Scholarship|EducationalOccupationalProgram/i.test(type)) {
      for (const key of ["applicationUrl", "applyUrl"]) {
        const url = MeritNav.safeUrl(value[key], location.href);
        if (url) urls.push(url);
      }
      if (value.directApply === true) {
        const url = MeritNav.safeUrl(value.url, location.href);
        if (url && url !== MeritNav.safeUrl(location.href)) urls.push(url);
      }
    }
    Object.values(value).forEach(visit);
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { visit(JSON.parse(script.textContent || "null")); } catch {}
  }
  return [...new Set(urls)];
}

function applicationEntry() {
  const candidates = [...document.querySelectorAll('a[href], button, [role="button"], input[type="button"], input[type="submit"]')]
    .filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true")
    .map((element, index) => {
      if (!element.dataset.meritosActionId) element.dataset.meritosActionId = `meritos-action-${index}`;
      return {
        id: element.dataset.meritosActionId,
        label: cleanLabel(element.innerText || element.value || element.getAttribute("aria-label") || element.title),
        url: MeritNav.safeUrl(element.getAttribute("href"), location.href),
        clickable: true,
      };
    });
  for (const url of jsonLdApplicationUrls()) candidates.push({ id: "", label: "Apply", url, clickable: false, structured: true });
  return MeritNav.chooseApplicationLink(candidates, location.href);
}

function actionCandidates() {
  return [...document.querySelectorAll('a[href], button, [role="button"], input[type="button"], input[type="submit"]')]
    .filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true")
    .map((element, index) => {
      if (!element.dataset.meritosActionId) element.dataset.meritosActionId = `meritos-action-${index}`;
      const label = cleanLabel(element.innerText || element.value || element.getAttribute("aria-label") || element.title);
      return { element, id: element.dataset.meritosActionId, label, kind: MeritForm.guidanceActionKind(label) };
    })
    .filter((item) => item.label && item.kind);
}

function guidanceActions() {
  const candidates = actionCandidates();
  const result = {};
  for (const kind of ["signup", "login", "apply", "next", "final"]) {
    const action = candidates.find((item) => item.kind === kind);
    if (action) result[kind] = { id: action.id, label: action.label, found: true };
  }
  return result;
}

function pageState() {
  const fields = scan();
  const entry = fields.length ? null : applicationEntry();
  const actions = guidanceActions();
  const summary = {
    url: location.href,
    title: document.title,
    fieldCount: fields.length,
    applicationLink: entry ? { id: entry.id, label: entry.label, url: entry.url, score: entry.score, ats: MeritNav.atsName(entry.url), clickable: entry.clickable } : null,
    actions,
    ats: MeritNav.atsName(location.href),
    bodyText: cleanLabel(document.body?.innerText || "").slice(0, 12_000),
    hasPasswordInput: Boolean(document.querySelector('input[type="password"]')),
    topFrame: window.top === window,
  };
  return { ...summary, kind: MeritNav.classifyPage(summary) };
}

function clickApplicationEntry(actionId) {
  const element = [...document.querySelectorAll('[data-meritos-action-id]')].find((candidate) => candidate.dataset.meritosActionId === actionId);
  if (!element || !visible(element)) return false;
  element.click();
  return true;
}

function dispatchChange(element, value) {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(value) }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeText(element, value) {
  let nextValue = String(value ?? "");
  if (element instanceof HTMLInputElement && ["date", "month", "week", "time", "datetime-local"].includes(element.type)) {
    nextValue = MeritForm.normalizeTemporalValue(nextValue, element.type).value;
    if (!nextValue) return false;
  }
  if (element instanceof HTMLInputElement && ["number", "range"].includes(element.type)) {
    const numeric = nextValue.match(/-?\d+(?:\.\d+)?/)?.[0] || "";
    if (!numeric) return false;
    nextValue = numeric;
  }
  element.focus();
  if (element.isContentEditable) element.innerText = nextValue;
  else {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, nextValue); else element.value = nextValue;
  }
  dispatchChange(element, nextValue);
  if (element.isContentEditable) return cleanLabel(element.innerText) === cleanLabel(nextValue);
  const validity = element.validity;
  return String(element.value) === nextValue && !(validity?.badInput || validity?.typeMismatch || validity?.rangeOverflow || validity?.rangeUnderflow || validity?.stepMismatch);
}

function standardOptionElements(element, control) {
  const selector = control === "radio" ? 'input[type="radio"]' : 'input[type="checkbox"]';
  return element.matches(selector) ? [element] : [...element.querySelectorAll(selector)];
}

async function chooseOption(element, value, control) {
  if (element instanceof HTMLSelectElement) {
    const records = [...element.options].map((item) => ({ label: item.text, value: item.value }));
    if (element.multiple) {
      const wanted = MeritForm.splitMultipleValues(value);
      const matches = wanted.map((answer) => MeritForm.matchOption(answer, records)).filter(Boolean);
      if (!matches.length) return false;
      const selected = new Set(matches.map((item) => item.value));
      [...element.options].forEach((option) => { option.selected = selected.has(option.value); });
      dispatchChange(element, matches.map((item) => item.value).join("; "));
      return true;
    }
    const option = MeritForm.matchOption(value, records);
    if (!option) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(element, option.value); else element.value = option.value;
    dispatchChange(element, option.value);
    return element.value === option.value;
  }
  const nativeOptions = standardOptionElements(element, control);
  if (nativeOptions.length) {
    const records = nativeOptions.map(optionRecord);
    if (control === "checkbox" && nativeOptions.length > 1) {
      const wanted = MeritForm.splitMultipleValues(value);
      const choices = wanted.map((answer) => MeritForm.matchOption(answer, records)).filter(Boolean);
      if (!choices.length) return false;
      const selected = new Set(choices.map((choice) => records.indexOf(choice)));
      nativeOptions.forEach((target, index) => {
        if (selected.has(index) !== target.checked) target.click();
      });
      return [...selected].every((index) => nativeOptions[index]?.checked);
    }
    const choice = MeritForm.matchOption(value, records);
    const target = choice ? nativeOptions[records.indexOf(choice)] : null;
    if (!target) return false;
    target.click();
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  const role = control === "radio" ? "radio" : control === "checkbox" ? "checkbox" : "option";
  let roleOptions = [...element.querySelectorAll(`[role="${role}"]`)].filter(visible);
  if (!roleOptions.length && ["radio", "checkbox"].includes(control)) {
    roleOptions = [...element.querySelectorAll('button[aria-pressed]')].filter(visible);
  }
  if (!roleOptions.length && control === "select") {
    element.click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    roleOptions = [...document.querySelectorAll('[role="option"]')].filter(visible);
  }
  const records = roleOptions.map(optionRecord);
  const choice = MeritForm.matchOption(value, records);
  const target = choice ? roleOptions[records.indexOf(choice)] : null;
  if (!target) return false;
  target.click();
  return true;
}

async function setField(id, value) {
  const element = document.querySelector(`[data-meritos-field-id="${CSS.escape(id)}"]`);
  if (!element || !visible(element)) return false;
  const control = controlFor(element);
  if (control === "file") return false;
  if (["radio", "checkbox", "select"].includes(control)) return chooseOption(element, value, control);
  return setNativeText(element, value);
}

function clearReviewHighlights() {
  document.querySelectorAll("[data-meritos-review-status]").forEach((element) => {
    element.removeAttribute("data-meritos-review-status");
    element.removeAttribute("data-meritos-review-note");
  });
  document.getElementById("meritos-run-review-host")?.remove();
  document.getElementById("meritos-run-review-style")?.remove();
}

function highlightReview(items = [], summary = {}) {
  clearReviewHighlights();
  const style = document.createElement("style");
  style.id = "meritos-run-review-style";
  style.textContent = `
    [data-meritos-review-status="missing"]{outline:3px solid #d98b35!important;outline-offset:4px!important;box-shadow:0 0 0 8px rgba(217,139,53,.14)!important}
    [data-meritos-review-status="review"]{outline:3px solid #6b64e8!important;outline-offset:4px!important;box-shadow:0 0 0 8px rgba(107,100,232,.12)!important}
    @media(prefers-reduced-motion:no-preference){[data-meritos-review-status]{transition:outline-color .2s,box-shadow .2s}}
  `;
  document.documentElement.append(style);
  let firstMissing = null;
  for (const item of items) {
    const element = document.querySelector(`[data-meritos-field-id="${CSS.escape(item.fieldId)}"]`);
    if (!element) continue;
    element.setAttribute("data-meritos-review-status", item.status === "review" ? "review" : "missing");
    element.setAttribute("data-meritos-review-note", cleanLabel(item.message || "Needs your review"));
    if (!firstMissing && item.status !== "review") firstMissing = element;
  }
  const host = document.createElement("div");
  host.id = "meritos-run-review-host";
  host.style.cssText = "position:fixed;right:20px;top:20px;z-index:2147483647";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    .card{width:min(310px,calc(100vw - 40px));padding:14px 15px;border:1px solid #d7a25f;border-radius:16px;background:#fffaf0;color:#173b31;box-shadow:0 18px 48px #173b3133;font:500 12px/1.4 ui-sans-serif,system-ui}
    .top{display:flex;align-items:flex-start;gap:11px}.mark{width:30px;height:30px}.copy{flex:1}.copy b{display:block;font-size:13px}.copy span{display:block;margin-top:3px;color:#715d42}.close{border:0;background:transparent;color:#5d7169;font-size:18px;cursor:pointer}.key{display:flex;gap:12px;margin-top:10px;padding-top:9px;border-top:1px solid #ead9bc;color:#6f6049;font-size:10px}.dot{display:inline-block;width:8px;height:8px;margin-right:4px;border-radius:50%;background:#d98b35}.dot.review{background:#6b64e8}
  </style><div class="card"><div class="top"><img class="mark" src="${chrome.runtime.getURL("meritos-mark-v2.png")}" alt=""><div class="copy"><b>Application prepared for review</b><span>${Number(summary.filled || 0)} filled · ${Number(summary.missing || 0)} missing · MeritOS did not submit</span></div><button class="close" aria-label="Dismiss review summary">×</button></div><div class="key"><span><i class="dot"></i>Needs information</span><span><i class="dot review"></i>Verify inference</span></div></div>`;
  root.querySelector(".close")?.addEventListener("click", () => host.remove());
  document.documentElement.append(host);
  if (firstMissing) firstMissing.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  return { highlighted: items.length };
}

function clearGuidance() {
  document.getElementById("meritos-guidance-host")?.remove();
  document.getElementById("meritos-guidance-style")?.remove();
  document.querySelectorAll("[data-meritos-guided]").forEach((element) => element.removeAttribute("data-meritos-guided"));
}

function showGuidance({ actionId = "", fieldId = "", title = "Your next step", instruction = "Complete this step, then return to MeritOS.", step = "" } = {}) {
  clearGuidance();
  const target = actionId
    ? document.querySelector(`[data-meritos-action-id="${CSS.escape(actionId)}"]`)
    : document.querySelector(`[data-meritos-field-id="${CSS.escape(fieldId)}"]`);
  if (!target) return { highlighted: false };
  target.setAttribute("data-meritos-guided", "true");
  const style = document.createElement("style");
  style.id = "meritos-guidance-style";
  style.textContent = `[data-meritos-guided="true"]{outline:4px solid #29a879!important;outline-offset:6px!important;box-shadow:0 0 0 12px rgba(41,168,121,.18),0 12px 42px rgba(12,61,49,.24)!important;position:relative!important;z-index:2147483645!important}@media(prefers-reduced-motion:no-preference){[data-meritos-guided="true"]{animation:meritos-guide-pulse 1.8s ease-in-out infinite}@keyframes meritos-guide-pulse{50%{box-shadow:0 0 0 18px rgba(41,168,121,.08),0 12px 42px rgba(12,61,49,.24)}}}`;
  document.documentElement.append(style);
  const host = document.createElement("div");
  host.id = "meritos-guidance-host";
  host.style.cssText = "position:fixed;right:20px;top:20px;z-index:2147483647";
  const root = host.attachShadow({ mode: "open" });
  const card = document.createElement("div");
  card.setAttribute("role", "status");
  card.setAttribute("aria-live", "polite");
  card.style.cssText = "width:min(330px,calc(100vw - 40px));padding:16px;border:1px solid #8ccdb5;border-radius:18px;background:#f5fff9;color:#123d31;box-shadow:0 20px 56px #123d3133;font:500 13px/1.45 ui-sans-serif,system-ui";
  const eyebrow = document.createElement("div");
  eyebrow.textContent = step ? `MERITOS GUIDE · ${step}` : "MERITOS GUIDE";
  eyebrow.style.cssText = "font-size:10px;font-weight:800;letter-spacing:.12em;color:#26795e";
  const heading = document.createElement("strong");
  heading.textContent = title;
  heading.style.cssText = "display:block;margin-top:6px;font-size:15px";
  const copy = document.createElement("p");
  copy.textContent = instruction;
  copy.style.cssText = "margin:5px 0 0;color:#47675d";
  const close = document.createElement("button");
  close.textContent = "Dismiss";
  close.style.cssText = "margin-top:12px;border:0;border-radius:10px;padding:8px 11px;background:#123d31;color:white;font:700 11px ui-sans-serif,system-ui;cursor:pointer";
  close.addEventListener("click", clearGuidance);
  card.append(eyebrow, heading, copy, close);
  root.append(card);
  document.documentElement.append(host);
  target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  return { highlighted: true };
}

function progressActions() {
  const candidates = actionCandidates();
  const safeNext = candidates.find((item) => MeritForm.progressActionKind(item.label) === "next");
  const finalAction = candidates.find((item) => MeritForm.progressActionKind(item.label) === "final");
  return {
    next: safeNext ? { found: true, id: safeNext.id, label: safeNext.label } : { found: false, id: "", label: "" },
    final: finalAction ? { found: true, id: finalAction.id, label: finalAction.label } : { found: false, id: "", label: "" },
  };
}

function clickSafeNext() {
  const candidates = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], a[href]')]
    .filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true");
  const target = candidates.find((element) => MeritForm.progressActionKind(cleanLabel(element.innerText || element.value || element.getAttribute("aria-label"))) === "next");
  if (!target) return false;
  window.setTimeout(() => target.click(), 60);
  return true;
}

document.addEventListener("submit", (event) => {
  const target = event.submitter instanceof Element ? event.submitter : null;
  const label = target ? cleanLabel(target.innerText || target.value || target.getAttribute("aria-label")) : "submit";
  if (MeritForm.progressActionKind(label) !== "final") return;
  chrome.runtime.sendMessage({ type: "MERITOS_FINAL_SUBMISSION_CONFIRMED", url: location.href });
}, true);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "MERITOS_SCAN") {
    sendResponse({ fields: scan(), title: document.title, url: location.href, topFrame: window.top === window });
    return;
  }
  if (message?.type === "MERITOS_SCAN_STABLE") {
    scanStable(message.passes).then(sendResponse);
    return true;
  }
  if (message?.type === "MERITOS_PAGE_STATE") {
    sendResponse(pageState());
    return;
  }
  if (message?.type === "MERITOS_CLICK_APPLICATION_ENTRY") {
    sendResponse({ clicked: clickApplicationEntry(String(message.actionId || "")) });
    return;
  }
  if (message?.type === "MERITOS_FILL") {
    setField(message.fieldId, message.value).then((filled) => sendResponse({ filled }));
    return true;
  }
  if (message?.type === "MERITOS_FILL_MANY") {
    Promise.all((message.items || []).map(async (item) => ({ fieldId: item.fieldId, filled: await setField(item.fieldId, item.value) })))
      .then((results) => sendResponse({ results }));
    return true;
  }
  if (message?.type === "MERITOS_HIGHLIGHT_REVIEW") {
    sendResponse(highlightReview(message.items || [], message.summary || {}));
    return;
  }
  if (message?.type === "MERITOS_CLEAR_REVIEW") {
    clearReviewHighlights();
    sendResponse({ cleared: true });
    return;
  }
  if (message?.type === "MERITOS_GUIDE_ACTION") {
    sendResponse(showGuidance(message));
    return;
  }
  if (message?.type === "MERITOS_CLEAR_GUIDE") {
    clearGuidance();
    sendResponse({ cleared: true });
    return;
  }
  if (message?.type === "MERITOS_PROGRESS_ACTIONS") {
    sendResponse(progressActions());
    return;
  }
  if (message?.type === "MERITOS_CLICK_SAFE_NEXT") {
    sendResponse({ clicked: clickSafeNext() });
    return;
  }
});

let lastDetectionSignature = "";
let lastObservedUrl = location.href;

function detectAndLaunch(force = false) {
  const fields = scan();
  const state = window.top === window ? pageState() : null;
  if (state && ["login", "captcha"].includes(state.kind)) {
    const signature = `${location.href}|${state.kind}|${state.actions?.signup?.id || state.actions?.login?.id || ""}`;
    if (!force && signature === lastDetectionSignature) return;
    lastDetectionSignature = signature;
    chrome.runtime.sendMessage({ type: "MERITOS_APPLICATION_ENTRY_DETECTED", state });
    return;
  }
  if (fields.length > 0) {
    const signature = `${location.href}|form|${fields.map((field) => fieldKey(field) || field.id).sort().join("|")}`;
    if (!force && signature === lastDetectionSignature) return;
    lastDetectionSignature = signature;
    chrome.runtime.sendMessage({ type: "MERITOS_FORM_DETECTED", count: fields.length, url: location.href, title: document.title, topFrame: window.top === window, state });
    if (window.top === window) showLauncher(fields.length);
    return;
  }
  if (window.top === window) {
    const signature = `${location.href}|${state.kind}|${state.applicationLink?.url || state.applicationLink?.label || ""}`;
    if (!force && signature === lastDetectionSignature) return;
    lastDetectionSignature = signature;
    if (state.applicationLink || ["login", "captcha", "ats_waiting"].includes(state.kind)) chrome.runtime.sendMessage({ type: "MERITOS_APPLICATION_ENTRY_DETECTED", state });
  }
}

function showLauncher(count) {
  const existing = document.getElementById("meritos-launcher-host");
  if (existing) {
    existing.shadowRoot.querySelector("[data-count]").textContent = `${count} questions found`;
    return;
  }
  const host = document.createElement("div");
  host.id = "meritos-launcher-host";
  host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647";
  const root = host.attachShadow({ mode: "open" });
  const logoUrl = chrome.runtime.getURL("meritos-mark-v2.png");
  root.innerHTML = `
    <style>
      .wrap{display:flex;align-items:center;gap:8px;font:600 13px/1.2 ui-sans-serif,system-ui;animation:arrive .38s cubic-bezier(.2,.78,.25,1)}
      .open{display:flex;align-items:center;gap:11px;min-width:220px;padding:10px 14px 10px 10px;border:1px solid #8ec8b2;border-radius:16px;background:#103f34;color:#f7fbf8;box-shadow:0 18px 42px #071b1747;cursor:pointer;text-align:left}
      .mark{width:34px;height:34px;flex:none;object-fit:contain}.copy{display:block}b{display:block;font-size:13px}small{display:block;margin-top:4px;color:#b9dacb;font-size:10px;font-weight:500}
      .close{width:28px;height:28px;padding:0;border:1px solid #8ec8b2;border-radius:50%;background:#103f34;color:#d9eee5;cursor:pointer}
      .open:focus-visible,.close:focus-visible{outline:3px solid #e3bc69;outline-offset:2px}@keyframes arrive{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}@media(prefers-reduced-motion:reduce){.wrap{animation:none}}
    </style>
    <div class="wrap"><button class="open" type="button" aria-label="Open MeritOS application assistant"><img class="mark" src="${logoUrl}" alt=""><span class="copy"><b>MeritOS is ready</b><small data-count>${count} questions found</small></span></button><button class="close" type="button" aria-label="Hide MeritOS button">×</button></div>`;
  root.querySelector(".open").addEventListener("click", () => chrome.runtime.sendMessage({ type: "MERITOS_OPEN_SIDE_PANEL" }));
  root.querySelector(".close").addEventListener("click", () => host.remove());
  document.documentElement.append(host);
}

detectAndLaunch();
let rescanTimer;
function scheduleDetection(force = false, delay = 350) {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => detectAndLaunch(force), delay);
}
const formObserver = new MutationObserver(() => {
  scheduleDetection(false, 500);
});
formObserver.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("pageshow", () => scheduleDetection(true, 180));
window.addEventListener("popstate", () => scheduleDetection(true, 180));
window.addEventListener("hashchange", () => scheduleDetection(true, 180));
window.setInterval(() => {
  if (location.href === lastObservedUrl) return;
  lastObservedUrl = location.href;
  scheduleDetection(true, 180);
}, 800);
