function configureSidePanel() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

const detectedFrames = new Map();

configureSidePanel();
chrome.runtime.onInstalled.addListener(configureSidePanel);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "MERITOS_SET_OPPORTUNITY_ALERT") {
    chrome.storage.local.set({ meritosOpportunityAlert: { enabled: message.enabled === true, query: message.query || "" } });
    if (message.enabled && message.query) chrome.alarms.create("meritos-opportunity-watch", { delayInMinutes: 1, periodInMinutes: 15 });
    else chrome.alarms.clear("meritos-opportunity-watch");
    return;
  }
  if (message?.type === "MERITOS_SET_INITIATIVE_MODE") {
    const mode = ["careful", "proactive", "high_initiative"].includes(message.mode) ? message.mode : "proactive";
    chrome.storage.local.set({ meritosInitiativeMode: mode, meritosProactive: mode !== "careful" });
    return;
  }
  if (message?.type === "MERITOS_CONNECT_PROFILE") {
    const pageUrl = String(sender.tab?.url || sender.url || "");
    const trustedPage = pageUrl.startsWith("https://merit-os-jflo.vercel.app/") || /^http:\/\/localhost(?::\d+)?\//.test(pageUrl);
    const baseUrl = String(message.baseUrl || "").replace(/\/$/, "");
    const trustedBase = baseUrl === "https://merit-os-jflo.vercel.app" || /^http:\/\/localhost(?::\d+)?$/.test(baseUrl);
    const token = String(message.token || "");
    if (!trustedPage || !trustedBase || !/^merit_[A-Za-z0-9_-]{20,}$/.test(token)) {
      sendResponse({ connected: false, error: "The connection request was invalid." });
      return;
    }
    fetch(`${baseUrl}/api/extension/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.profile) throw new Error(data.error || "The profile connection could not be verified.");
        await chrome.storage.local.set({ meritosBaseUrl: baseUrl, meritosToken: token, meritosProfile: data.profile });
        sendResponse({ connected: true });
      })
      .catch((error) => sendResponse({ connected: false, error: error.message || "The profile connection failed." }));
    return true;
  }
  if (message?.type === "MERITOS_QUEUE_APPLICATIONS") {
    const applications = (Array.isArray(message.applications) ? message.applications : []).filter((item) => {
      try { return new URL(item.url).protocol === "https:"; } catch { return false; }
    }).slice(0, 20);
    if (!applications.length) return;
    const mode = ["careful", "proactive", "high_initiative"].includes(message.mode) ? message.mode : "proactive";
    chrome.storage.local.set({ meritosApplicationQueue: applications, meritosInitiativeMode: mode, meritosProactive: mode !== "careful" });
    chrome.tabs.create({ url: applications[0].url, active: true }).then(async (tab) => {
      if (!tab.id) return;
      const run = {
        active: true,
        phase: "opening",
        message: "Finding the official application…",
        url: applications[0].url,
        opportunity: applications[0],
        queue: applications.slice(1),
        tabId: tab.id,
        steps: 0,
        navigationHops: 0,
        visitedUrls: [applications[0].url],
        autoContinue: true,
        startedAt: new Date().toISOString(),
      };
      await chrome.storage.local.set({ meritosApplicationRun: run, meritosApplicationRunReport: null });
      await chrome.sidePanel.setOptions({ tabId: tab.id, path: "sidepanel.html", enabled: true }).catch(() => {});
      await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
        chrome.action.setBadgeBackgroundColor({ color: "#0b4a3a" });
        chrome.action.setBadgeText({ tabId: tab.id, text: "GO" });
      });
    }).catch(() => {});
    return;
  }
  if (message?.type === "MERITOS_SEND_TO_APPLICATION_FRAME") {
    const tabId = Number(message.tabId);
    const frames = [...(detectedFrames.get(tabId)?.entries() || [])]
      .sort((a, b) => (b[1].count || 0) - (a[1].count || 0));
    const frameId = Number.isInteger(message.frameId) ? message.frameId : frames[0]?.[0];
    if (!Number.isInteger(frameId)) {
      sendResponse({ error: "No embedded application form was detected." });
      return;
    }
    chrome.tabs.sendMessage(tabId, message.payload, { frameId })
      .then((result) => sendResponse({ ...result, frameId }))
      .catch((error) => sendResponse({ error: error.message || "The embedded form could not be reached." }));
    return true;
  }
  if (!sender.tab?.id) return;
  if (message?.type === "MERITOS_FINAL_SUBMISSION_CONFIRMED") {
    chrome.storage.local.get(["meritosApplicationQueue", "meritosApplicationRun"]).then(async (stored) => {
      const queue = Array.isArray(stored.meritosApplicationQueue) ? stored.meritosApplicationQueue : [];
      if (!queue.length) return;
      if (stored.meritosApplicationRun?.tabId && stored.meritosApplicationRun.tabId !== sender.tab.id) return;
      const remaining = queue.slice(1);
      const next = remaining[0];
      const nextRun = next ? { active: true, phase: "opening", message: `Opening ${next.title || "the next application"}…`, url: next.url, opportunity: next, queue: remaining.slice(1), steps: 0, navigationHops: 0, visitedUrls: [next.url], autoContinue: true, startedAt: new Date().toISOString() } : null;
      await chrome.storage.local.set({ meritosApplicationQueue: remaining, meritosApplicationRun: nextRun, meritosApplicationRunReport: null });
      if (next?.url) setTimeout(() => chrome.tabs.create({ url: next.url, active: true }).then(async (tab) => {
        if (!tab.id) return;
        await chrome.storage.local.set({ meritosApplicationRun: { ...nextRun, tabId: tab.id } });
        await chrome.sidePanel.setOptions({ tabId: tab.id, path: "sidepanel.html", enabled: true }).catch(() => {});
        await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
      }).catch(() => {}), 1800);
      else chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title: "MeritOS batch complete", message: "You reached the end of this application queue." });
    });
    return;
  }
  if (message?.type === "MERITOS_FORM_DETECTED") {
    const frames = detectedFrames.get(sender.tab.id) || new Map();
    frames.set(sender.frameId || 0, { count: Number(message.count || 0), url: message.url || sender.tab.url || "", title: message.title || "", seenAt: Date.now() });
    detectedFrames.set(sender.tab.id, frames);
    chrome.sidePanel.setOptions({ tabId: sender.tab.id, path: "sidepanel.html", enabled: true }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ color: "#5d6bff" });
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: String(Math.min(message.count, 99)) });
    chrome.storage.local.get(["meritosApplicationRun"]).then(({ meritosApplicationRun: run }) => {
      if (run?.pauseReason === "login_required" && (!run.tabId || run.tabId === sender.tab.id) && message.state?.kind === "form") {
        chrome.storage.local.set({ meritosApplicationRun: { ...run, active: true, phase: "running", pauseReason: "", message: "Account step complete. Mapping the application formâ€¦" } });
      }
    }).catch(() => {});
  }
  if (message?.type === "MERITOS_APPLICATION_ENTRY_DETECTED") {
    chrome.sidePanel.setOptions({ tabId: sender.tab.id, path: "sidepanel.html", enabled: true }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ color: "#0b4a3a" });
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: "GO" });
    chrome.storage.local.get(["meritosApplicationRun", "meritosToken"]).then(async ({ meritosApplicationRun: run, meritosToken }) => {
      if (!run) {
        if (!meritosToken) return;
        if (message.state?.kind === "login") {
          const action = message.state.actions?.signup || message.state.actions?.login;
          if (action?.id) await chrome.tabs.sendMessage(sender.tab.id, { type: "MERITOS_GUIDE_ACTION", actionId: action.id, step: "Open your application", title: `Click â€œ${action.label}â€`, instruction: "Complete this website's account step. MeritOS will detect and prepare the application form when it appears." }).catch(() => {});
        } else if (message.state?.kind === "landing" && message.state.applicationLink?.id) {
          const action = message.state.applicationLink;
          await chrome.tabs.sendMessage(sender.tab.id, { type: "MERITOS_GUIDE_ACTION", actionId: action.id, step: "Open the application", title: `Click â€œ${action.label || "Apply"}â€`, instruction: "This is the application entry MeritOS detected. Open it and MeritOS will scan the form automatically." }).catch(() => {});
        }
        return;
      }
      if (run.tabId && run.tabId !== sender.tab.id) return;
      if (run.pauseReason === "login_required" && !["login", "captcha"].includes(message.state?.kind)) {
        await chrome.storage.local.set({ meritosApplicationRun: { ...run, active: true, phase: "running", pauseReason: "", message: "Account step complete. Continuing to the applicationâ€¦" } });
        return;
      }
      if (!run.active) return;
      if (message.state?.kind === "captcha") {
        await chrome.storage.local.set({ meritosApplicationRun: { ...run, active: false, phase: "paused", pauseReason: "captcha", message: "Complete the highlighted human-verification step, then press Resume." } });
        return;
      }
      if (message.state?.kind === "login") {
        const action = message.state.actions?.signup || message.state.actions?.login;
        if (action?.id) await chrome.tabs.sendMessage(sender.tab.id, { type: "MERITOS_GUIDE_ACTION", actionId: action.id, step: "Account required", title: `Click â€œ${action.label}â€`, instruction: "Complete this website's account step. MeritOS stays connected and will continue when the application form appears." }).catch(() => {});
        await chrome.storage.local.set({ meritosApplicationRun: { ...run, active: false, phase: "paused", pauseReason: "login_required", message: action?.label ? `The â€œ${action.label}â€ control is highlighted. Complete the account step; MeritOS will continue when the form appears.` : "Complete this website's sign-in or account step. MeritOS will continue when the form appears." } });
        return;
      }
      if (message.state?.kind !== "landing") return;
      const link = message.state.applicationLink;
      const hops = Number(run.navigationHops || 0);
      const visited = new Set(Array.isArray(run.visitedUrls) ? run.visitedUrls : [run.url].filter(Boolean));
      if (!link || hops >= 5 || (link.url && visited.has(link.url))) return;
      if (link.url) visited.add(link.url);
      const updated = { ...run, phase: "navigating", message: `Found ${link.ats || "the official"} application. Opening it…`, navigationHops: hops + 1, visitedUrls: [...visited].slice(-8) };
      await chrome.storage.local.set({ meritosApplicationRun: updated });
      if (link.url && link.url !== message.state.url) await chrome.tabs.update(sender.tab.id, { url: link.url, active: true });
      else if (link.id) await chrome.tabs.sendMessage(sender.tab.id, { type: "MERITOS_CLICK_APPLICATION_ENTRY", actionId: link.id }).catch(() => {});
    }).catch(() => {});
  }
  if (message?.type === "MERITOS_OPEN_SIDE_PANEL") {
    chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => detectedFrames.delete(tabId));

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
