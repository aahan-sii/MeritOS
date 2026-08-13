(function attachMeritOSIntelligence(root) {
  const FormCore = root.MeritOSFormCore || {
    normalize: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    matchOption: () => null,
    thirdPartyContactQuestion: (value) => /\b(recommender|reference|teacher|counselor|mentor|supervisor|manager|parent|guardian)\b/i.test(String(value || "")),
  };
  const narrativeIntents = new Set(["research", "leadership", "project", "community", "entrepreneurship", "nonprofit", "work", "creative", "teaching"]);

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
    if (/\b(personal website|portfolio (?:url|link)|portfolio website|website(?: url| link)?|homepage|github(?: url| profile| link)?)\b/.test(value)) return "website";
    if (/\b(phone|telephone|mobile|cell number)\b/.test(value)) return "phone";
    if (field.type === "email" || /\b(your e-?mail|applicant e-?mail|primary e-?mail|email address)\b/.test(value)) return "email";
    if (/\b(first|given) name\b/.test(value)) return "first_name";
    if (/\b(last|family|surname) name\b/.test(value)) return "last_name";
    if (/\b(full name|legal name|applicant name|your name|preferred name)\b/.test(value)) return "name";
    if (/\b(work authori[sz]ation|legally authorized|visa sponsorship|citizenship status)\b/.test(value)) return "legal_status";
    if (/\b(consent|permission|agree to|authorize contact|may we contact)\b/.test(value)) return "consent";
    if (/\b(gender|race|ethnicity|disability|veteran status|sexual orientation|date of birth|birth date)\b/.test(value)) return "sensitive_demographic";
    if (/\b(street address|mailing address|home address|residential address)\b/.test(value)) return "address";
    if (/\b(current city|home city|city of residence|what city|city and state)\b/.test(value)) return "location_city";
    if (/\b(current state|state of residence|province|territory)\b/.test(value)) return "location_state";
    if (/\b(current location|where (?:are )?you based|location|geographic area|region)\b/.test(value)) return "location";
    if (/\b(current education level|level of education|school level|student level|academic level)\b/.test(value)) return "education_level";
    if (/\b(expected graduation|graduation (?:date|year)|class of)\b/.test(value)) return "graduation_year";
    if (/\b(current grade|grade level|year in school|class year)\b/.test(value)) return "grade_level";
    if (/\b(school|institution|university|college|organization|organisation|employer)\b/.test(value)) return "institution";
    if (/\b(why.*apply|why.*fellowship|motivation|motivated|interest in this|personal statement|statement of purpose)\b/.test(value)) return "motivation";
    if (/\b(startup|venture|entrepreneur|founder|co-?founder|business you (?:built|started)|company you (?:built|started))\b/.test(value)) return "entrepreneurship";
    if (/\b(nonprofit|non-profit|charity|social impact organization|mission-driven organization)\b/.test(value)) return "nonprofit";
    if (/\b(work experience|employment|professional experience|job responsibilities|role at|workplace|career experience)\b/.test(value)) return "work";
    if (/\b(creative work|design process|artistic|portfolio piece|artwork|film|writing sample)\b/.test(value)) return "creative";
    if (/\b(teaching|instruct|lesson|classroom|educat(?:ed|ing)|student learning)\b/.test(value)) return "teaching";
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
    if (/contact/.test(category) && (/\bemail\b/.test(value) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(value))) return "email";
    if (/location|availability|geograph/.test(category) || /\b(?:location|based in|located in|city of residence)\b/.test(value)) return "location";
    if (/^identity$/.test(category)) return "name";
    if (/^leadership$/.test(category)) return "leadership";
    if (/\b(startup|venture|entrepreneur|founder|founded|co-?founder|co-?founded|launched a company|business)\b/.test(value)) return "entrepreneurship";
    if (/\b(nonprofit|non-profit|charity|philanthrop|mission-driven)\b/.test(value)) return "nonprofit";
    if (/\b(teacher|teach|teaches|teaching|taught|tutor|tutoring|instructor|educator|lesson|classroom)\b/.test(value)) return "teaching";
    if (/\b(artist|artistic|designer|creative|film|illustrat|portfolio piece|art installation)\b/.test(value)) return "creative";
    if (/professional experience|employment/.test(category)) return "work";
    if (/award or distinction/.test(category) || /\b(award|honou?r(?:able)?|distinction|dean'?s list|finalist|winner|scholarship|medal|champion|gold|silver|bronze)\b/.test(value)) return "award";
    if (/community contribution/.test(category) || /\b(volunteer|community service|nonprofit|outreach|tutor(?:ed|ing)?|fundrais)\b/.test(value)) return "community";
    if (/^leadership$/.test(category) || /\b(led|founded|president|captain|chair|coordinated|organized|managed|mentored|supervised)\b/.test(value)) return "leadership";
    if (/research experience/.test(category) || /\b(research|laboratory|lab\b|genomics|bioinformatics|publication|poster|abstract|experiment)\b/.test(value)) return "research";
    if (/project or impact/.test(category) || /\b(project|built|developed|designed|created|implemented|engineered|prototype|platform)\b/.test(value)) return "project";
    if (/^education$/.test(category) || /\b(university|college|academy|high school|school of|institute|degree|gpa|coursework|graduat(?:ed|ion))\b/.test(value)) return "education";
    if (/\b(motivation|reason for applying|career goal|aspire|passion)\b/.test(value)) return "motivation";
    if (/\b(worked|employment|job|associate|specialist|consultant|engineer|analyst|manager)\b/.test(value)) return "work";
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
    const compatible = (type) => type === intent
      || (intent === "nonprofit" && type === "community")
      || (intent === "work" && type === "teaching")
      || (intent === "creative" && type === "project");
    const matches = claims.map((claim) => ({ claim, type: claimIntent(claim) })).filter((item) => compatible(item.type));
    if (!narrativeIntents.has(intent)) return matches.slice(0, 1);
    return matches
      .map((item) => ({ item, score: (item.type === intent ? 100 : 0) + (String(item.claim.statement || "").match(/\b\d[\d,.%$-]*/g) || []).length * 4 + Math.min(String(item.claim.statement || "").length, 500) / 100 }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 1)
      .map(({ item }) => item);
  }

  function safeText(items, field, intent) {
    const limit = field.maxLength || 2000;
    const facts = items.map((item) => String(item.claim.statement || "").trim()).filter(Boolean);
    if (!facts.length) return "";
    if (!narrativeIntents.has(intent)) return facts[0].slice(0, limit);
    return facts[0].slice(0, limit);
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

  function extractEmail(claims) {
    for (const claim of claims) {
      if (!/contact|email/i.test(`${claim.category} ${claim.statement}`)) continue;
      const match = String(claim.statement || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (match) return match[0];
    }
    return "";
  }

  function extractedName(claims) {
    const claim = claims.find((item) => /^identity$/i.test(String(item.category || "")));
    const value = String(claim?.statement || "").replace(/^name\s*:\s*/i, "").trim();
    return /^[A-Za-z][A-Za-z'\-.]+(?:\s+[A-Za-z][A-Za-z'\-.]+){1,4}$/.test(value) ? value : "";
  }

  function extractLocation(claims) {
    const stateNames = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia" };
    const ranked = [...claims].sort((left, right) => {
      const score = (claim) => /location|contact|address/i.test(claim.category || "") ? 3 : claimIntent(claim) === "education" ? 2 : 1;
      return score(right) - score(left);
    });
    for (const claim of ranked) {
      const statement = String(claim.statement || "");
      const matches = [...statement.matchAll(/\b([A-Z][A-Za-z.' -]{1,40}),\s*([A-Z]{2})(?:\b|\s+\d{5})/g)];
      const match = matches.at(-1);
      if (!match) continue;
      const city = match[1].trim();
      const state = match[2].toUpperCase();
      const inferred = !/location|contact|address/i.test(`${claim.category} ${statement.slice(0, 40)}`);
      return { city, state, stateName: stateNames[state] || state, full: `${city}, ${state}`, inferred, claim };
    }
    return null;
  }

  function fitToOptions(text, field) {
    if (!text || !Array.isArray(field.options) || !field.options.length) return text;
    const option = FormCore.matchOption(text, field.options);
    return option ? String(option.label || option.value || "") : "";
  }

  function educationProfile(claims) {
    const evidence = claims.filter((claim) => claimIntent(claim) === "education");
    const joined = evidence.map((claim) => claim.statement || "").join(" \n ");
    const graduationMatch = joined.match(/(?:class of|expected(?: graduation)?(?: in)?|graduat(?:ing|ion)[^0-9]{0,12})\s*(may|june|spring|fall)?\s*(20\d{2})/i);
    let graduation = graduationMatch?.[2] || "";
    let graduationDate = graduationMatch?.[1] && /^(may|june)$/i.test(graduationMatch[1]) ? `${graduationMatch[1]} ${graduation}` : graduation;
    let inferredGraduation = false;
    const explicitGrade = joined.match(/\b(9th|10th|11th|12th|freshman|sophomore|junior|senior)\s+(?:grade|student|year)?\b/i)?.[1] || "";
    if (!graduation && explicitGrade) {
      const gradeMap = { "9th": 9, freshman: 9, "10th": 10, sophomore: 10, "11th": 11, junior: 11, "12th": 12, senior: 12 };
      const grade = gradeMap[explicitGrade.toLowerCase()];
      const now = new Date();
      const academicEndYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
      if (grade) {
        graduation = String(academicEndYear + (12 - grade));
        graduationDate = graduation;
        inferredGraduation = true;
      }
    }
    let inferredGrade = "";
    if (!explicitGrade && graduation) {
      const now = new Date();
      const academicEndYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
      const grade = 12 - (Number(graduation) - academicEndYear);
      if (grade >= 9 && grade <= 12) inferredGrade = `${grade}${grade === 9 ? "th" : grade === 10 ? "th" : grade === 11 ? "th" : "th"} grade`;
    }
    const level = /\b(high school|secondary school|academy)\b/i.test(joined)
      ? "High school"
      : /\b(university|college|bachelor|undergraduate)\b/i.test(joined)
        ? "Undergraduate"
        : /\b(master|graduate student)\b/i.test(joined)
          ? "Graduate"
          : /\b(ph\.?d|doctorate|doctoral)\b/i.test(joined) ? "Doctoral" : "";
    return { level, graduation, graduationDate, grade: explicitGrade || inferredGrade, inferredGrade: Boolean(inferredGrade), inferredGraduation, evidence };
  }

  function missing(source, intent) {
    return { text: "", source, intent, kind: "missing" };
  }

  function suggest(field, claims, identity) {
    const intent = questionIntent(field);
    if (["third_party_email", "third_party_name", "third_party_phone"].includes(intent)) {
      return missing("This asks for someone else’s contact information. Add that person as application-specific context; MeritOS will never substitute your details.", intent);
    }
    if (intent === "email" && extractEmail(claims)) {
      return { text: fitToOptions(extractEmail(claims), field), source: "Imported resume contact detail · review before fill", intent, kind: "identity" };
    }
    if (["name", "first_name", "last_name"].includes(intent)) {
      const verifiedName = extractedName(claims) || String(identity.displayName || "").trim();
      const parts = verifiedName.split(/\s+/).filter(Boolean);
      const name = intent === "first_name" ? parts[0] : intent === "last_name" ? parts.slice(1).join(" ") : verifiedName;
      return name ? { text: fitToOptions(name, field), source: "Account profile · verified identity", intent, kind: "identity" } : missing("Add your full name in MeritOS profile settings", intent);
    }
    if (intent === "email") return identity.email ? { text: fitToOptions(identity.email, field), source: "Account profile · verified email", intent, kind: "identity" } : missing("No verified account email is available", intent);
    if (intent === "phone") {
      const phone = extractPhone(claims);
      return phone ? { text: fitToOptions(phone, field), source: "Imported resume contact detail · review before fill", intent, kind: "evidence" } : missing("No phone number was found in your profile", intent);
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
      const conciseInstitution = institution ? String(institution.statement).split(/\s*(?:\||—|–)\s*/)[0].trim() : "";
      const text = conciseInstitution ? fitToOptions(conciseInstitution.slice(0, field.maxLength || 500), field) : "";
      return text ? { text, source: "Verified education evidence", intent, kind: "evidence" } : missing("No matching school or institution was found in verified evidence", intent);
    }
    if (["education_level", "graduation_year", "grade_level"].includes(intent)) {
      const education = educationProfile(claims);
      const raw = intent === "education_level" ? education.level : intent === "graduation_year" ? education.graduation : education.grade;
      const temporal = intent === "graduation_year" && ["date", "month", "week", "datetime-local"].includes(field.type)
        ? globalThis.MeritOSFormCore?.normalizeTemporalValue(education.graduationDate || raw, field.type)
        : null;
      const text = fitToOptions(temporal?.value || raw, field);
      if (!text) return missing(`No verified education evidence supports this ${intent.replaceAll("_", " ")} answer`, intent);
      const inferred = (intent === "grade_level" && education.inferredGrade) || (intent === "graduation_year" && (education.inferredGraduation || temporal?.inferred));
      return { text, source: inferred ? "Estimated from verified expected-graduation evidence · review individually" : "Verified education evidence", intent, kind: inferred ? "inference" : "evidence" };
    }
    if (intent === "address") return missing("A street or mailing address requires your explicit profile input; MeritOS will not guess it from a school or employer", intent);
    if (["location", "location_city", "location_state"].includes(intent)) {
      const location = extractLocation(claims);
      if (!location) return missing("Add your current city and state under Location & availability", intent);
      const raw = intent === "location_city" ? location.city : intent === "location_state" ? location.stateName : location.full;
      const text = fitToOptions(raw, field) || (intent === "location_state" ? fitToOptions(location.state, field) : "");
      if (!text) return missing("Your verified location does not match one of this field’s available choices", intent);
      return { text, source: location.inferred ? "Estimated from a verified school or organization location · review individually" : "Applicant-confirmed location", intent, kind: location.inferred ? "inference" : "evidence" };
    }
    if (intent === "legal_status") return missing("Legal or work-authorization answers require your explicit application-specific confirmation", intent);
    if (intent === "consent") return missing("Consent choices always require your direct selection", intent);
    if (intent === "sensitive_demographic") return missing("Sensitive demographic information is never inferred or autofilled", intent);
    if (intent === "motivation") return missing("Needs your input — a résumé cannot establish why you want this specific opportunity", intent);
    if (intent === "unknown") return missing("MeritOS cannot confidently identify what this question is asking. Add context or answer manually.", intent);
    const items = selectEvidence(intent, claims);
    const text = fitToOptions(safeText(items, field, intent), field);
    const fragment = narrativeIntents.has(intent);
    return text ? { text, source: fragment ? `Verified ${intent} evidence fragment · use Analyze with AI for a complete answer` : `${items.length} verified ${intent} evidence item${items.length === 1 ? "" : "s"}`, intent, kind: fragment ? "evidence_preview" : "evidence" } : missing(`No verified ${intent} evidence matches this question`, intent);
  }

  function canDraftField(field, proactive = false) {
    const intent = questionIntent(field);
    if (["third_party_email", "third_party_name", "third_party_phone", "legal_status", "consent", "sensitive_demographic", "name", "first_name", "last_name", "email", "phone", "linkedin", "website"].includes(intent)) return false;
    if (proactive && ["motivation", "unknown"].includes(intent)) return true;
    return ["research", "leadership", "project", "community", "entrepreneurship", "nonprofit", "work", "creative", "teaching", "award", "education", "education_level", "graduation_year", "grade_level"].includes(intent);
  }

  root.MeritOSIntelligence = { questionIntent, claimIntent, bestInstitution, suggest, canDraftField };
})(globalThis);
