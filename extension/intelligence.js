(function attachMeritOSIntelligence(root) {
  const narrativeIntents = new Set(["research", "leadership", "project", "community"]);

  function questionIntent(field) {
    const value = `${field.label || ""} ${field.type || ""} ${field.name || ""}`.toLowerCase();
    if (field.type === "email" || /\b(e-?mail|email address)\b/.test(value)) return "email";
    if (/\b(full name|legal name|applicant name|your name)\b/.test(value)) return "name";
    if (/\b(school|institution|university|college|organization|organisation|employer)\b/.test(value)) return "institution";
    if (/\b(why.*apply|why.*fellowship|motivation|motivated|interest in this|personal statement|statement of purpose)\b/.test(value)) return "motivation";
    if (/\b(research|laboratory|experiment|publication|academic investigation)\b/.test(value)) return "research";
    if (/\b(leadership|initiative|led a|manage|mentor|team leader)\b/.test(value)) return "leadership";
    if (/\b(project|built|developed|created|technical work|impact)\b/.test(value)) return "project";
    if (/\b(community|volunteer|service|outreach|contributed|civic)\b/.test(value)) return "community";
    if (/\b(award|honou?r|achievement|distinction|recognition|scholarship)\b/.test(value)) return "award";
    if (/\b(education|coursework|degree|gpa|academic background)\b/.test(value)) return "education";
    return "unknown";
  }

  function claimIntent(claim) {
    const category = String(claim.category || "").toLowerCase();
    const value = `${category} ${claim.statement || ""}`.toLowerCase();
    if (/award or distinction/.test(category) || /\b(award|honou?r(?:able)?|distinction|dean'?s list|finalist|winner|scholarship|medal|champion|gold|silver|bronze)\b/.test(value)) return "award";
    if (/community contribution/.test(category) || /\b(volunteer|community service|nonprofit|outreach|tutor(?:ed|ing)?|fundrais)\b/.test(value)) return "community";
    if (/^leadership$/.test(category) || /\b(led|founded|president|captain|chair|coordinated|organized|managed|mentored|supervised)\b/.test(value)) return "leadership";
    if (/research experience/.test(category) || /\b(research|laboratory|lab\b|genomics|bioinformatics|publication|poster|abstract|experiment)\b/.test(value)) return "research";
    if (/project or impact/.test(category) || /\b(project|built|developed|designed|created|implemented|engineered|prototype|platform)\b/.test(value)) return "project";
    if (/^education$/.test(category) || /\b(university|college|academy|high school|school of|institute|degree|gpa|coursework|graduat(?:ed|ion))\b/.test(value)) return "education";
    if (/\b(motivation|reason for applying|career goal|aspire|passion)\b/.test(value)) return "motivation";
    return "unknown";
  }

  function institutionCandidate(claim) {
    const value = String(claim.statement || "");
    let score = 0;
    if (/\b(university|college|academy|high school|school of|institute|institut)\b/i.test(value)) score += 30;
    if (/\b(coursework|courses?|classes|ap\s+(calculus|physics|statistics|english|computer))\b/i.test(value)) score -= 25;
    if (/\b(queens creek|tempe|phoenix|arizona|california|new york|,\s*[A-Z]{2}\b)/i.test(value)) score += 4;
    if (claimIntent(claim) === "education") score += 8;
    return score;
  }

  function bestInstitution(claims) {
    return claims
      .map((claim) => ({ claim, score: institutionCandidate(claim) }))
      .filter((item) => item.score > 15)
      .sort((a, b) => b.score - a.score)[0]?.claim;
  }

  function selectEvidence(intent, claims) {
    return claims
      .map((claim) => ({ claim, type: claimIntent(claim) }))
      .filter((item) => item.type === intent)
      .slice(0, narrativeIntents.has(intent) ? 2 : 1);
  }

  function safeText(items, field, intent) {
    const limit = field.maxLength || 2000;
    const facts = items.map((item) => String(item.claim.statement || "").trim()).filter(Boolean);
    if (!facts.length) return "";
    if (!narrativeIntents.has(intent)) return facts[0].slice(0, limit);
    const compact = facts.map((fact) => `• ${fact}`).join("\n");
    return compact.slice(0, limit);
  }

  function suggest(field, claims, identity) {
    const intent = questionIntent(field);
    if (intent === "name") {
      return identity.displayName
        ? { text: identity.displayName, source: "Account profile · verified identity", intent, kind: "identity" }
        : { text: "", source: "Add your name in MeritOS profile settings", intent, kind: "missing" };
    }
    if (intent === "email") {
      return identity.email
        ? { text: identity.email, source: "Account profile · verified email", intent, kind: "identity" }
        : { text: "", source: "No verified account email is available", intent, kind: "missing" };
    }
    if (intent === "institution") {
      const institution = bestInstitution(claims);
      return institution
        ? { text: institution.statement.slice(0, field.maxLength || 500), source: "Verified education evidence", intent, kind: "evidence" }
        : { text: "", source: "No school or institution was found in verified evidence", intent, kind: "missing" };
    }
    if (intent === "motivation") {
      return { text: "", source: "Needs your input — a résumé cannot establish why you want this specific opportunity", intent, kind: "missing" };
    }
    if (intent === "unknown") {
      return { text: "", source: "Question intent is unclear — answer manually", intent, kind: "missing" };
    }
    const items = selectEvidence(intent, claims);
    const text = safeText(items, field, intent);
    return text
      ? { text, source: `${items.length} verified ${intent} evidence item${items.length === 1 ? "" : "s"}`, intent, kind: "evidence" }
      : { text: "", source: `No verified ${intent} evidence found — answer manually or add evidence`, intent, kind: "missing" };
  }

  root.MeritOSIntelligence = { questionIntent, claimIntent, bestInstitution, suggest };
})(globalThis);
