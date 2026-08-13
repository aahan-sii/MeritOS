(function attachMeritOSFormCore(root) {
  function normalize(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function optionText(option) {
    return typeof option === "string" ? option : String(option?.label || option?.value || "");
  }

  function matchOption(answer, options) {
    const wanted = normalize(answer);
    if (!wanted || !Array.isArray(options) || !options.length) return null;
    const exact = options.find((option) => normalize(optionText(option)) === wanted || normalize(option?.value) === wanted);
    if (exact) return exact;
    const yesNo = wanted.match(/^(yes|no|true|false)$/)?.[1];
    if (yesNo) {
      const normalized = yesNo === "true" ? "yes" : yesNo === "false" ? "no" : yesNo;
      return options.find((option) => normalize(optionText(option)) === normalized) || null;
    }
    if (wanted.length >= 4) {
      const partial = options.filter((option) => {
        const candidate = normalize(optionText(option));
        return candidate.length >= 4 && (candidate.includes(wanted) || wanted.includes(candidate));
      });
      if (partial.length === 1) return partial[0];
    }
    return null;
  }

  function thirdPartyContactQuestion(value) {
    const text = normalize(value);
    return /\b(recommender|recommendation|reference|referee|teacher|counselor|counsellor|mentor|supervisor|manager|principal|parent|guardian|emergency contact|contact person)\b/.test(text);
  }

  function progressActionKind(value) {
    const text = normalize(value);
    if (/\b(submit|send application|finish application|complete application|apply now)\b/.test(text)) return "final";
    if (["next", "continue", "save continue", "save and continue", "review", "review application", "proceed"].includes(text)) return "next";
    return "";
  }

  function guidanceActionKind(value) {
    const text = normalize(value);
    if (/\b(create account|create profile|sign up|signup|register|new applicant)\b/.test(text)) return "signup";
    if (/\b(log in|login|sign in|signin|returning applicant)\b/.test(text)) return "login";
    if (/\b(apply|start application|begin application|open application)\b/.test(text)) return "apply";
    return progressActionKind(text);
  }

  function dateParts(value) {
    const text = String(value ?? "").trim();
    let match = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
    if (match) return { year: match[1], month: match[2], day: match[3], inferred: false };
    match = text.match(/\b(0?[1-9]|1[0-2])[\/-](0?[1-9]|[12]\d|3[01])[\/-](20\d{2})\b/);
    if (match) return { year: match[3], month: match[1].padStart(2, "0"), day: match[2].padStart(2, "0"), inferred: false };
    const months = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
    match = text.toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(?:(\d{1,2}),?\s+)?(20\d{2})\b/);
    if (match) return { year: match[3], month: months[match[1]], day: String(match[2] || "1").padStart(2, "0"), inferred: !match[2] };
    match = text.match(/\b(20\d{2})\b/);
    return match ? { year: match[1], month: "06", day: "01", inferred: true } : null;
  }

  function normalizeTemporalValue(value, type) {
    const raw = String(value ?? "").trim();
    if (!raw) return { value: "", inferred: false };
    if (type === "time") {
      const time = raw.match(/\b(\d{1,2}):(\d{2})(?:\s*([ap]m))?\b/i);
      if (!time) return { value: "", inferred: false };
      let hour = Number(time[1]);
      if (time[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
      if (time[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
      return { value: `${String(hour).padStart(2, "0")}:${time[2]}`, inferred: false };
    }
    if (type === "week") {
      const week = raw.match(/\b(20\d{2})-W(0[1-9]|[1-4]\d|5[0-3])\b/i);
      return { value: week ? `${week[1]}-W${week[2]}` : "", inferred: false };
    }
    if (type === "datetime-local") {
      const direct = raw.match(/\b(20\d{2}-\d{2}-\d{2})[T\s](\d{2}:\d{2})\b/);
      if (direct) return { value: `${direct[1]}T${direct[2]}`, inferred: false };
    }
    const parts = dateParts(raw);
    if (!parts) return { value: "", inferred: false };
    if (type === "month") return { value: `${parts.year}-${parts.month}`, inferred: parts.inferred };
    if (type === "datetime-local") return { value: `${parts.year}-${parts.month}-${parts.day}T09:00`, inferred: true };
    return { value: `${parts.year}-${parts.month}-${parts.day}`, inferred: parts.inferred };
  }

  function splitMultipleValues(value) {
    if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
    return String(value ?? "").split(/\s*(?:;|\n|\|)\s*/).map((item) => item.trim()).filter(Boolean);
  }

  root.MeritOSFormCore = { normalize, matchOption, thirdPartyContactQuestion, progressActionKind, guidanceActionKind, normalizeTemporalValue, splitMultipleValues };
})(globalThis);
