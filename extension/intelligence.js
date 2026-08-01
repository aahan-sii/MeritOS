(function attachMeritOSIntelligence(root) {
  const FormCore = root.MeritOSFormCore || {
    normalize: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    matchOption: () => null,
    thirdPartyContactQuestion: (value) => /\b(recommender|reference|teacher|counselor|mentor|supervisor|manager|parent|guardian)\b/i.test(String(value || "")),
  };
  const narrativeIntents = new Set(["research", "leadership", "project", "community"]);

  function fieldText(field) {
    return `${field.label || ""} ${field.name || ""} ${field.type || ""}`.toLowerCase();
  }

  function questionIntent(field) {
    const value = fieldText(field);
    const thirdParty = FormCore.thirdPartyContactQuestion(value);
    if (thirdParty && /\b(e-?mail|email address)\b/.test(value)) return "third_party_email";
    if (thirdParty && /\b(name|full name)\b/.test(value)) return "third_party_name";
    if (thirdParty && /\b(phone|telephone|mobile|cell)\b/.test(value)) return "third_party_phone";
    if (/\b(linkedin|linked in)\b/.test(value)) return "linkedin";
    if (/\b(personal website|portfolio(?: url| link)?|website(?: url| link)?|homepage|github(?: url| profile| link)?)\b/.test(value)) return "website";
    if (/\b(phone|telephone|mobile|cell number)\b/.test(value)) return "phone";
    if (field.type === "email" || /\b(your e-?mail|applicant e-?mail|primary e-?mail|email address)\b/.test(value)) return "email";
    if (/\b(full name|legal name|applicant name|your name|preferred name)\b/.test(value)) return "name";
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
    if (/links?|profiles?|online presence/.test(category) || /linkedin\.com|github\.com|https?:\/\//.test(value)) return "website";
    if (/contact/.test(category) && /\b(phone|mobile|telephone)\b/.test(value)) return "phone";
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
    if (/\b(queen creek|tempe|phoenix|arizona|california|new york|,\s*[A-Z]{2}\b)/i.test(value)) score += 4;
    if (claimIntent(claim) === "education") score += 8;
    return score;
  }

  function bestInstitution(claims) {
    return claims.map((claim) => ({ claim, score: institutionCandidate(claim) })).filter((item) => item.score > 15).sort((a, b) => b.score - a.score)[0]?.claim;
  }

  function selectEvidence(intent, claims) {
    return claims.map((claim) => ({ claim, type: claimIntent(claim) })).filter((item) => item.type === intent).slice(0, narrativeIntents.has(intent) ? 2 : 1);
  }

  function safeText(items, field, intent) {
    const limit = field.maxLength || 2000;
    const facts = items.map((item) => String(item.claim.statement || "").trim()).filter(Boolean);
    if (!facts.length) return "";
    if (!narrativeIntents.has(intent)) return facts[0].slice(0, limit);
    return facts.map((fact) => `• ${fact}`).join("\n").slice(0, limit);
  }

  function extractUrl(claims, pattern) {
    for (const claim of claims) {
      const match = String(claim.statement || "").match(/https?:\/\/[^\s)\]}]+/i);
      if (match && pattern.test(match[0])) return match[0];
    }
    return "";
  }

  function extractPhone(claims) {
    for (const claim of claims) {
      if (!/contact|phone|mobile|telephone/i.test(`${claim.category} ${claim.statement}`)) continue;
      const match = String(claim.statement || "").match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
      if (match) return match[0];
    }
    return "";
  }

  function fitToOptions(text, field) {
    if (!text || !Array.isArray(field.options) || !field.options.length) return text;
    const option = FormCore.matchOption(text, field.options);
    return option ? String(option.label || option.value || "") : "";
  }

  function missing(source, intent) {
    return { text: "", source, intent, kind: "missing" };
  }

  function suggest(field, claims, identity) {
    const intent = questionIntent(field);
    if (["third_party_email", "third_party_name", "third_party_phone"].includes(intent)) {
      return missing("This asks for someone else’s contact information. Add that person as application-specific context; MeritOS will never substitute your details.", intent);
    }
    if (intent === "name") return identity.displayName ? { text: fitToOptions(identity.displayName, field), source: "Account profile · verified identity", intent, kind: "identity" } : missing("Add your name in MeritOS profile settings", intent);
    if (intent === "email") return identity.email ? { text: fitToOptions(identity.email, field), source: "Account profile · verified email", intent, kind: "identity" } : missing("No verified account email is available", intent);
    if (intent === "phone") {
      const phone = extractPhone(claims);
      return phone ? { text: fitToOptions(phone, field), source: "Verified contact detail", intent, kind: "evidence" } : missing("No verified phone number is in your profile", intent);
    }
    if (intent === "linkedin") {
      const url = extractUrl(claims, /linkedin\.com/i);
      return url ? { text: fitToOptions(url, field), source: "Verified LinkedIn link", intent, kind: "evidence" } : missing("Add your LinkedIn URL under Links & profiles", intent);
    }
    if (intent === "website") {
      const url = extractUrl(claims, /./);
      return url ? { text: fitToOptions(url, field), source: "Verified profile link", intent, kind: "evidence" } : missing("Add a personal website, portfolio, or GitHub URL under Links & profiles", intent);
    }
    if (intent === "institution") {
      const institution = bestInstitution(claims);
      const text = institution ? fitToOptions(institution.statement.slice(0, field.maxLength || 500), field) : "";
      return text ? { text, source: "Verified education evidence", intent, kind: "evidence" } : missing("No matching school or institution was found in verified evidence", intent);
    }
    if (intent === "motivation") return missing("Needs your input — a résumé cannot establish why you want this specific opportunity", intent);
    if (intent === "unknown") return missing("MeritOS cannot confidently identify what this question is asking. Add context or answer manually.", intent);
    const items = selectEvidence(intent, claims);
    const text = fitToOptions(safeText(items, field, intent), field);
    return text ? { text, source: `${items.length} verified ${intent} evidence item${items.length === 1 ? "" : "s"}`, intent, kind: "evidence" } : missing(`No verified ${intent} evidence matches this question`, intent);
  }

  function canDraftField(field) {
    const intent = questionIntent(field);
    return ["research", "leadership", "project", "community", "award", "education"].includes(intent);
  }

  root.MeritOSIntelligence = { questionIntent, claimIntent, bestInstitution, suggest, canDraftField };
})(globalThis);
