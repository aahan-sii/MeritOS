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
  root.innerHTML = `
    <style>
      .wrap{display:flex;align-items:center;gap:6px;font:600 13px/1.2 Inter,ui-sans-serif,system-ui}
      .open{display:flex;align-items:center;gap:9px;padding:10px 13px 10px 10px;border:1px solid #8992ff66;border-radius:13px;background:#101426;color:#f7f8ff;box-shadow:0 14px 38px #090b1680;cursor:pointer}
      .mark{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6976ff,#926cff);font-weight:800}
      small{display:block;margin-top:2px;color:#9ba2bb;font-size:10px;font-weight:500}
      .close{width:26px;height:26px;padding:0;border:0;border-radius:50%;background:#101426;color:#8e95aa;cursor:pointer}
      .open:focus-visible,.close:focus-visible{outline:3px solid #7984ff;outline-offset:2px}
    </style>
    <div class="wrap">
      <button class="open" type="button" aria-label="Open MeritOS application assistant">
        <span class="mark">M</span><span>Open MeritOS<small data-count>${count} fields</small></span>
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
