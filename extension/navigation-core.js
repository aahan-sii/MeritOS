(function attachMeritOSNavigationCore(root) {
  const ATS_HOSTS = [
    ["greenhouse.io", "Greenhouse"],
    ["lever.co", "Lever"],
    ["ashbyhq.com", "Ashby"],
    ["myworkdayjobs.com", "Workday"],
    ["workday.com", "Workday"],
    ["smartrecruiters.com", "SmartRecruiters"],
    ["icims.com", "iCIMS"],
    ["taleo.net", "Taleo"],
    ["jobvite.com", "Jobvite"],
    ["bamboohr.com", "BambooHR"],
    ["applytojob.com", "JazzHR"],
    ["recruitee.com", "Recruitee"],
    ["teamtailor.com", "Teamtailor"],
    ["typeform.com", "Typeform"],
    ["docs.google.com", "Google Forms"],
    ["airtable.com", "Airtable"],
  ];

  function normalize(value) {
    return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function safeUrl(value, baseUrl) {
    try {
      const parsed = new URL(String(value || ""), baseUrl || undefined);
      if (!["http:", "https:"].includes(parsed.protocol)) return "";
      parsed.hash = "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  function atsName(value) {
    const url = safeUrl(value);
    if (!url) return "";
    const host = new URL(url).hostname.toLowerCase();
    return ATS_HOSTS.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] || "";
  }

  function applicationLinkScore(candidate, currentUrl) {
    const label = normalize(candidate?.label);
    const href = safeUrl(candidate?.url, currentUrl);
    if (!label && !href) return -100;
    const combined = `${label} ${normalize(href)}`;
    if (/\b(sign in|log in|login|register|create account|privacy|terms|share|save job|view jobs|all jobs|search jobs|refer)\b/.test(label)) return -100;
    if (/mailto:|javascript:/i.test(String(candidate?.url || ""))) return -100;
    let score = 0;
    if (/^(apply|apply now|apply here|apply today|apply for this job|apply on company site|apply externally|go to application|open application|start application|continue application|begin application|submit an application)$/.test(label)) score += 90;
    else if (/\b(apply|application|candidate)\b/.test(label)) score += 45;
    if (atsName(href)) score += 55;
    if (/\b(apply|application|jobs|careers|candidate)\b/.test(combined)) score += 20;
    if (/\b(download|learn more|read more|details|overview)\b/.test(label)) score -= 30;
    try {
      if (href && currentUrl && new URL(href).hostname !== new URL(currentUrl).hostname) score += 8;
    } catch {}
    return score;
  }

  function chooseApplicationLink(candidates, currentUrl) {
    const ranked = (Array.isArray(candidates) ? candidates : [])
      .map((candidate) => ({ ...candidate, url: safeUrl(candidate?.url, currentUrl), score: applicationLinkScore(candidate, currentUrl) }))
      .filter((candidate) => candidate.score >= 45 && (candidate.url || candidate.clickable))
      .sort((a, b) => b.score - a.score);
    return ranked[0] || null;
  }

  function blockerKind(input) {
    const text = normalize(`${input?.title || ""} ${input?.bodyText || ""}`);
    if (/\b(captcha|verify you are human|security check|cloudflare challenge|challenge required)\b/.test(text)) return "captcha";
    if (/\b(sign in to apply|log in to apply|login to apply|create an account to apply|account required)\b/.test(text)) return "login";
    return "";
  }

  function classifyPage(input) {
    const fields = Number(input?.fieldCount || 0);
    const blocker = blockerKind(input);
    if (blocker) return blocker;
    const accountAction = Boolean(input?.actions?.signup?.found || input?.actions?.login?.found);
    const accountContext = /\b(applicant|application portal|candidate|account|profile)\b/.test(normalize(`${input?.title || ""} ${input?.bodyText || ""}`));
    if (input?.hasPasswordInput || (accountAction && (atsName(input?.url) || accountContext))) return "login";
    if (fields > 0) return "form";
    if (input?.applicationLink) return "landing";
    if (atsName(input?.url)) return "ats_waiting";
    return "unknown";
  }

  root.MeritOSNavigationCore = { ATS_HOSTS, normalize, safeUrl, atsName, applicationLinkScore, chooseApplicationLink, blockerKind, classifyPage };
})(globalThis);
