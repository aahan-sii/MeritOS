import OpenAI from "openai";
import { scoreOpportunity } from "./opportunity-watch-core.js";

export type WebOpportunity = {
  eligible: boolean;
  company: string;
  title: string;
  location: string;
  url: string;
  source: string;
  repository: string;
  deadlineText: string;
  audienceEvidence: string;
  fieldEvidence: string;
  matchCount: number;
  relevanceScore: number;
  audienceFit: string;
  matchReasons: string[];
};

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function safeUrl(value: unknown) {
  try {
    const parsed = new URL(clean(value, 2_000));
    if (parsed.protocol !== "https:") return "";
    if (/google\.com\/search|bing\.com\/search|duckduckgo\.com/i.test(parsed.href)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

export async function scanLiveWebOpportunities(query: string, profileContext = ""): Promise<WebOpportunity[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5.6",
      reasoning: { effort: "low" },
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "developer",
          content: [
            "You are MeritOS Opportunity Discovery. Use live web search before answering.",
            "Find currently open or clearly upcoming legitimate opportunities matching the user's exact field and applicant level.",
            "Treat audience constraints such as high school, undergraduate, graduate, age, location, and citizenship as separate from field relevance. Exclude an opportunity when its page explicitly conflicts with the requested applicant level.",
            "Prefer official employer, university, government, nonprofit, laboratory, fellowship, scholarship, and applicant-tracking-system pages. Prefer the direct application URL over a news article, search page, or aggregator.",
            "Never invent an opening, deadline, eligibility rule, or URL. If applicant-level eligibility is not stated, say so in audienceEvidence rather than assuming it.",
            "Return no more than 15 results and only JSON matching the schema.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({ searchGoal: clean(query, 500), relevantVerifiedProfileContext: clean(profileContext, 4_000), currentDate: new Date().toISOString().slice(0, 10) }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meritos_live_opportunity_results",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["items"],
            properties: {
              items: {
                type: "array",
                maxItems: 15,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["company", "title", "location", "url", "deadlineText", "audienceEvidence", "fieldEvidence"],
                  properties: {
                    company: { type: "string" },
                    title: { type: "string" },
                    location: { type: "string" },
                    url: { type: "string" },
                    deadlineText: { type: "string" },
                    audienceEvidence: { type: "string" },
                    fieldEvidence: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    }, { signal: AbortSignal.timeout(18_000) });
    const payload = JSON.parse(response.output_text) as { items?: Array<Record<string, unknown>> };
    return (payload.items || []).flatMap((item) => {
      const url = safeUrl(item.url);
      if (!url) return [];
      const company = clean(item.company, 200) || "Opportunity";
      const title = clean(item.title, 240) || "Open opportunity";
      const location = clean(item.location, 180) || "Check official page";
      const audienceEvidence = clean(item.audienceEvidence, 500);
      const fieldEvidence = clean(item.fieldEvidence, 500);
      const scored = scoreOpportunity({ company, title, location, searchText: `${company} ${title} ${location} ${audienceEvidence} ${fieldEvidence}` }, query);
      if (!scored.eligible) return [];
      return [{
        eligible: true,
        company,
        title,
        location,
        url,
        source: "Live official-web search",
        repository: url,
        deadlineText: clean(item.deadlineText, 180),
        audienceEvidence,
        fieldEvidence,
        matchCount: scored.matchCount,
        relevanceScore: scored.relevanceScore + 8,
        audienceFit: scored.audienceFit,
        matchReasons: scored.matchReasons,
      }];
    });
  } catch {
    return [];
  }
}
