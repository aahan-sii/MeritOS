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

  root.MeritOSFormCore = { normalize, matchOption, thirdPartyContactQuestion, progressActionKind };
})(globalThis);
