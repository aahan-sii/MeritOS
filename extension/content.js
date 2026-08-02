const MeritForm = globalThis.MeritOSFormCore;
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
