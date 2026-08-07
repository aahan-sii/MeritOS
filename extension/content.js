const MeritForm = globalThis.MeritOSFormCore;

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== "MERITOS_SET_OPPORTUNITY_ALERT") return;
  chrome.runtime.sendMessage({ type: "MERITOS_SET_OPPORTUNITY_ALERT", enabled: event.data.enabled === true, query: String(event.data.query || "").slice(0, 400) });
});
const baseSelector = [
  "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file])",
  "textarea",
  "select",
  "[contenteditable=true]",
  "[role=radiogroup]",
  "[role=listbox]",
  "[role=group]",
  "[role=radio]",
  "[role=checkbox]",
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
  return element.closest('[role="listitem"], .Qr7Oae, .freebirdFormviewerComponentsQuestionBaseRoot, fieldset, .form-group, .field, .question, [data-question-id]');
}

function labelFor(element) {
  const explicit = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.innerText : "";
  const container = questionContainer(element);
  const google = container?.querySelector('.M7eMe, [role="heading"], [data-question-title]')?.innerText;
  const nearby = container?.querySelector("legend, label, h1, h2, h3, h4, .label, .prompt")?.innerText;
  const wrapping = element.closest("label")?.innerText;
  return [google, explicit, labelledText(element), element.getAttribute("aria-label"), nearby, wrapping, element.placeholder, element.name]
    .map(cleanLabel)
    .find(Boolean) || "Unlabelled field";
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
  if (element.matches('[role="radiogroup"], [role="radio"]') || element.matches('input[type="radio"]') || element.querySelector('input[type="radio"], [role="radio"]')) return "radio";
  if (element.matches('[role="listbox"]') || element instanceof HTMLSelectElement) return "select";
  if (element.matches('[role="group"]') && element.querySelector('[role="checkbox"], input[type="checkbox"], button[aria-pressed]')) return "checkbox";
  if (element.matches('input[type="checkbox"], [role="checkbox"], button[aria-pressed]')) return element.closest('[role="radiogroup"]') ? "radio" : "checkbox";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (element.isContentEditable) return "contenteditable";
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
        name: element.getAttribute("name") || element.id || "",
        kind: element.tagName.toLowerCase(),
        type: element.getAttribute("type") || control,
        control,
        options,
        multiple: control === "checkbox" || element.multiple === true,
        currentValue: "value" in element ? element.value : element.innerText,
        required: element.required || element.getAttribute("aria-required") === "true" || Boolean(element.closest('[role="listitem"]')?.querySelector('[aria-label*="Required"], .vnumgf')),
        maxLength: element.maxLength > 0 ? element.maxLength : null,
      };
    });
}

function dispatchChange(element, value) {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(value) }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeText(element, value) {
  element.focus();
  if (element.isContentEditable) element.innerText = value;
  else {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, value); else element.value = value;
  }
  dispatchChange(element, value);
  return true;
}

function standardOptionElements(element, control) {
  const selector = control === "radio" ? 'input[type="radio"]' : 'input[type="checkbox"]';
  return element.matches(selector) ? [element] : [...element.querySelectorAll(selector)];
}

async function chooseOption(element, value, control) {
  if (element instanceof HTMLSelectElement) {
    const option = MeritForm.matchOption(value, [...element.options].map((item) => ({ label: item.text, value: item.value })));
    if (!option) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (setter) setter.call(element, option.value); else element.value = option.value;
    dispatchChange(element, option.value);
    return true;
  }
  const nativeOptions = standardOptionElements(element, control);
  if (nativeOptions.length) {
    const records = nativeOptions.map(optionRecord);
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

function progressActions() {
  const candidates = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], a[href]')]
    .filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true")
    .map((element) => ({ element, label: cleanLabel(element.innerText || element.value || element.getAttribute("aria-label")) }))
    .filter((item) => item.label);
  const safeNext = candidates.find((item) => MeritForm.progressActionKind(item.label) === "next");
  const finalAction = candidates.find((item) => MeritForm.progressActionKind(item.label) === "final");
  return {
    next: safeNext ? { found: true, label: safeNext.label } : { found: false, label: "" },
    final: finalAction ? { found: true, label: finalAction.label } : { found: false, label: "" },
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "MERITOS_SCAN") {
    sendResponse({ fields: scan(), title: document.title, url: location.href });
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
  if (message?.type === "MERITOS_PROGRESS_ACTIONS") {
    sendResponse(progressActions());
    return;
  }
  if (message?.type === "MERITOS_CLICK_SAFE_NEXT") {
    sendResponse({ clicked: clickSafeNext() });
    return;
  }
});

function detectAndLaunch() {
  const fields = scan();
  if (fields.length < 1) return;
  chrome.runtime.sendMessage({ type: "MERITOS_FORM_DETECTED", count: fields.length });
  showLauncher(fields.length);
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
const formObserver = new MutationObserver(() => {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(detectAndLaunch, 500);
});
formObserver.observe(document.documentElement, { childList: true, subtree: true });
