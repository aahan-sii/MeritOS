const fieldSelector = [
  "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file])",
  "textarea",
  "select",
  "[contenteditable=true]"
].join(",");

function visible(element) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function labelFor(element) {
  const explicit = element.id
    ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.innerText
    : "";
  const wrapping = element.closest("label")?.innerText;
  const aria = element.getAttribute("aria-label") ||
    document.getElementById(element.getAttribute("aria-labelledby") || "")?.innerText;
  const nearby = element.closest("fieldset, .form-group, .field, [role=group]")?.querySelector("legend, label, h2, h3, p")?.innerText;
  return [explicit, wrapping, aria, nearby, element.placeholder, element.name]
    .find((value) => value?.trim())?.trim().slice(0, 500) || "Unlabelled field";
}

function scan() {
  return [...document.querySelectorAll(fieldSelector)]
    .filter(visible)
    .map((element, index) => {
      if (!element.dataset.meritosFieldId) element.dataset.meritosFieldId = `meritos-${index}-${Date.now()}`;
      return {
        id: element.dataset.meritosFieldId,
        label: labelFor(element),
        name: element.getAttribute("name") || element.id || "",
        kind: element.tagName.toLowerCase(),
        type: element.getAttribute("type") || "",
        currentValue: "value" in element ? element.value : element.innerText,
        required: element.required || element.getAttribute("aria-required") === "true",
        maxLength: element.maxLength > 0 ? element.maxLength : null
      };
    });
}

function setField(id, value) {
  const element = document.querySelector(`[data-meritos-field-id="${CSS.escape(id)}"]`);
  if (!element || !visible(element)) return false;
  element.focus();
  if (element.isContentEditable) {
    element.innerText = value;
  } else {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
  }
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "MERITOS_SCAN") {
    sendResponse({ fields: scan(), title: document.title, url: location.href });
    return;
  }
  if (message?.type === "MERITOS_FILL") {
    sendResponse({ filled: setField(message.fieldId, message.value) });
  }
});

const initialFields = scan();
if (initialFields.length >= 2) {
  chrome.runtime.sendMessage({ type: "MERITOS_FORM_DETECTED", count: initialFields.length });
  showLauncher(initialFields.length);
}

function showLauncher(count) {
  if (document.getElementById("meritos-launcher-host")) {
    const host = document.getElementById("meritos-launcher-host");
    host.shadowRoot.querySelector("[data-count]").textContent = `${count} fields`;
    return;
  }
  const host = document.createElement("div");
  host.id = "meritos-launcher-host";
  host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647";
  const root = host.attachShadow({ mode: "open" });
  const logoUrl = chrome.runtime.getURL("meritos-mark-v2.png");
  root.innerHTML = `
    <style>
      .wrap{display:flex;align-items:center;gap:7px;font:600 13px/1.2 Inter,ui-sans-serif,system-ui;animation:arrive .42s cubic-bezier(.2,.78,.25,1)}
      .open{display:flex;align-items:center;gap:10px;min-width:205px;padding:9px 13px 9px 9px;border:1px solid #a9d8bf99;border-radius:15px;background:linear-gradient(135deg,#123e34,#0d2c27);color:#f7fbf8;box-shadow:0 16px 44px #071b1780;cursor:pointer;text-align:left}
      .mark{width:32px;height:32px;flex:none}
      b{display:block;font-size:12px;letter-spacing:.01em}small{display:block;margin-top:3px;color:#b8d7c8;font-size:10px;font-weight:500}
      .close{width:26px;height:26px;padding:0;border:0;border-radius:50%;background:#123e34;color:#b9d8c9;cursor:pointer}
      .open:focus-visible,.close:focus-visible{outline:3px solid #e3bc69;outline-offset:2px}@keyframes arrive{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
    </style>
    <div class="wrap">
      <button class="open" type="button" aria-label="Open MeritOS application assistant">
        <img class="mark" src="${logoUrl}" alt="" /><span><b>MeritOS is ready</b><small data-count>${count} fields detected · Open assistant</small></span>
      </button>
      <button class="close" type="button" aria-label="Hide MeritOS button">×</button>
    </div>`;
  root.querySelector(".open").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "MERITOS_OPEN_SIDE_PANEL" });
  });
  root.querySelector(".close").addEventListener("click", () => host.remove());
  document.documentElement.append(host);
}

let rescanTimer;
const formObserver = new MutationObserver(() => {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => {
    const fields = scan();
    if (fields.length >= 2) {
      chrome.runtime.sendMessage({ type: "MERITOS_FORM_DETECTED", count: fields.length });
      showLauncher(fields.length);
    }
  }, 700);
});
formObserver.observe(document.documentElement, { childList: true, subtree: true });
