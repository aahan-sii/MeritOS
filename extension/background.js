chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab?.id) return;
  if (message?.type === "MERITOS_FORM_DETECTED") {
    chrome.action.setBadgeBackgroundColor({ color: "#5d6bff" });
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: String(Math.min(message.count, 99)) });
  }
  if (message?.type === "MERITOS_OPEN_SIDE_PANEL") {
    chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
  }
});
