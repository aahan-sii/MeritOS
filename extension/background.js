function configureSidePanel() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

configureSidePanel();
chrome.runtime.onInstalled.addListener(configureSidePanel);

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "MERITOS_SET_OPPORTUNITY_ALERT") {
    chrome.storage.local.set({ meritosOpportunityAlert: { enabled: message.enabled === true, query: message.query || "" } });
    if (message.enabled && message.query) chrome.alarms.create("meritos-opportunity-watch", { delayInMinutes: 1, periodInMinutes: 15 });
    else chrome.alarms.clear("meritos-opportunity-watch");
    return;
  }
  if (!sender.tab?.id) return;
  if (message?.type === "MERITOS_FORM_DETECTED") {
    chrome.sidePanel.setOptions({ tabId: sender.tab.id, path: "sidepanel.html", enabled: true }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ color: "#5d6bff" });
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: String(Math.min(message.count, 99)) });
  }
  if (message?.type === "MERITOS_OPEN_SIDE_PANEL") {
    chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "meritos-opportunity-watch") return;
  const stored = await chrome.storage.local.get(["meritosOpportunityAlert", "meritosBaseUrl", "meritosToken", "meritosKnownAlertUrls"]);
  const watch = stored.meritosOpportunityAlert;
  if (!watch?.enabled || !watch.query || !stored.meritosBaseUrl || !stored.meritosToken) return;
  try {
    const response = await fetch(`${stored.meritosBaseUrl}/api/extension/discover`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${stored.meritosToken}` }, body: JSON.stringify({ query: watch.query }) });
    if (!response.ok) return;
    const data = await response.json();
    const known = new Set(stored.meritosKnownAlertUrls || []);
    const fresh = (data.items || []).filter((item) => !known.has(item.url));
    await chrome.storage.local.set({ meritosKnownAlertUrls: (data.items || []).map((item) => item.url).slice(0, 100) });
    if (!fresh.length) return;
    chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title: "MeritOS found new matches", message: `${fresh.length} new opportunity${fresh.length === 1 ? "" : "ies"} match “${watch.query}”. Open MeritOS to prepare them.` });
  } catch {}
});
