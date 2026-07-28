chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "MERITOS_FORM_DETECTED" || !sender.tab?.id) return;
  chrome.action.setBadgeBackgroundColor({ color: "#5d6bff" });
  chrome.action.setBadgeText({ tabId: sender.tab.id, text: String(Math.min(message.count, 99)) });
});
