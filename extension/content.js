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
}
