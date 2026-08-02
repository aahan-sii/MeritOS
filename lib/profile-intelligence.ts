import OpenAI from "openai";

export type VerifiedProfileClaim = {
  id: string;
  category: string;
  statement: string;
};

export type FitAnalysis = {
  target: string;
  score: number;
  readinessBand: "not_ready" | "developing" | "plausible" | "competitive" | "standout";
  summary: string;
  positioning: string;
  confidence: string;
  strengths: Array<{ claimId: string; title: string; reason: string }>;
  gaps: Array<{
    area: string;
    whyItMatters: string;
    action: string;
    priority: "high" | "medium" | "low";
  }>;
  missingContextQuestions: string[];
  storyAngles: Array<{ title: string; claimIds: string[]; angle: string }>;
  opportunitySearches: Array<{ label: string; query: string; why: string }>;
};

export type GeneratedStory = {
  title: string;
  lens: string;
  situation: string;
  action: string;
  result: string;
  reflection: string;
  sourceClaimIds: string[];
  missingQuestions: string[];
};

export type GapArtifact = {
  title: string;
  artifactType: "outline" | "worksheet" | "plan" | "email_draft" | "portfolio_draft";
  purpose: string;
  content: string;
  missingFields: Array<{ key: string; label: string; prompt: string }>;
  sourceClaimIds: string[];
};

const STORY_LENSES = ["Leadership", "Research", "Community impact", "Resilience", "Academic curiosity", "Entrepreneurship"] as const;

export type InterviewQuestion = {
  id: string;
  type: "fit" | "behavioral" | "technical" | "evidence" | "challenge";
  question: string;
  whyItIsAsked: string;
  sourceClaimIds: string[];
  strongAnswerNeeds: string[];
};

export type InterviewFeedback = {
  summary: string;
  strengths: string[];
  risks: string[];
  improvedOutline: string[];
  evidenceUsed: string[];
  followUpQuestion: string;
};

function openAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI features are not configured. Add OPENAI_API_KEY in Vercel and redeploy.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function evidenceText(claims: VerifiedProfileClaim[]) {
  return claims
    .slice(0, 80)
    .map((claim) => `[${claim.id}] ${claim.category}: ${claim.statement}`)
    .join("\n");
}

function parseOutput<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error("The profile intelligence service returned an invalid response.");
  }
}

async function structuredResponse<T>(
  name: string,
  schema: Record<string, unknown>,
  developer: string,
  user: string,
) {
  const response = await openAI().responses.create({
    model: process.env.OPENAI_PROFILE_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-sol",
    reasoning: { effort: "low" },
    input: [
      { role: "developer", content: developer },
      { role: "user", content: user },
    ],
    text: { format: { type: "json_schema", name, strict: true, schema } },
  });
  return parseOutput<T>(response.output_text);
}

const stringArray = { type: "array", items: { type: "string" } };

export function cleanProfileText(value: string, maxLength = 6000) {
  return value
    .replace(/\[\s*claim_[a-z0-9-]+\s*\]/gi, " ")
    .replace(/\bclaim_[a-z0-9-]+\b/gi, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim()
    .slice(0, maxLength);
}

export async function createFitAnalysis(input: {
  target: string;
  claims: VerifiedProfileClaim[];
  profileCoverage: number;
}): Promise<FitAnalysis> {
  const analysis = await structuredResponse<FitAnalysis>(
    "meritos_fit_analysis",
    {
      type: "object",
      additionalProperties: false,
      required: [
        "target", "score", "readinessBand", "summary", "positioning", "confidence",
        "strengths", "gaps", "missingContextQuestions", "storyAngles", "opportunitySearches",
      ],
      properties: {
        target: { type: "string" },
        score: { type: "integer", minimum: 0, maximum: 100 },
        readinessBand: {
          type: "string",
          enum: ["not_ready", "developing", "plausible", "competitive", "standout"],
        },
        summary: { type: "string" },
        positioning: { type: "string" },
        confidence: { type: "string" },
        strengths: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["claimId", "title", "reason"],
            properties: {
              claimId: { type: "string" },
              title: { type: "string" },
              reason: { type: "string" },
            },
          },
        },
        gaps: {
          type: "array",
          maxItems: 7,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["area", "whyItMatters", "action", "priority"],
            properties: {
              area: { type: "string" },
              whyItMatters: { type: "string" },
              action: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
          },
        },
        missingContextQuestions: { ...stringArray, maxItems: 8 },
        storyAngles: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "claimIds", "angle"],
            properties: {
              title: { type: "string" },
              claimIds: { ...stringArray, maxItems: 5 },
              angle: { type: "string" },
            },
          },
        },
        opportunitySearches: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "query", "why"],
            properties: {
              label: { type: "string" },
              query: { type: "string" },
              why: { type: "string" },
            },
          },
        },
      },
    },
    `You are MeritOS Profile Fit, a conservative application-preparation coach.
Assess how prepared the verified profile is for the stated target. This is not an admissions probability.
Use only supplied verified claims. Never invent grades, impact, roles, motivations, eligibility, or program facts.
The score measures profile completeness, evidence quality, and directional target alignment.
If official criteria were not supplied, say that the result is directional. Strengths and story angles must cite valid claim IDs.
Gaps may recommend evidence or experiences but cannot imply the applicant already has them.
Opportunity searches are search strategies, not claims that a program is open. Keep advice specific and practical.
The positioning field is supporting copy, not a headline: write one plain-language sentence under 220 characters.
Never include claim IDs or bracketed citations in any user-visible prose.`,
    `TARGET:\n${input.target}\n\nPROFILE COVERAGE: ${input.profileCoverage}%\n\nVERIFIED CLAIMS:\n${evidenceText(input.claims)}`,
  );

  const validIds = new Set(input.claims.map((claim) => claim.id));
  analysis.target = input.target;
  analysis.score = Math.max(0, Math.min(100, Math.round(analysis.score)));
  analysis.positioning = cleanProfileText(analysis.positioning, 220);
  analysis.summary = cleanProfileText(analysis.summary, 700);
  analysis.confidence = cleanProfileText(analysis.confidence, 240);
  analysis.strengths = analysis.strengths.filter((item) => validIds.has(item.claimId));
  analysis.storyAngles = analysis.storyAngles.map((item) => ({
    ...item,
    claimIds: item.claimIds.filter((claimId) => validIds.has(claimId)),
  }));
  return analysis;
}

export async function createStory(input: {
  target: string;
  lens: string;
  focus?: string;
  depth?: string;
  claims: VerifiedProfileClaim[];
}): Promise<GeneratedStory> {
  const story = await structuredResponse<GeneratedStory>(
    "meritos_story",
    {
      type: "object",
      additionalProperties: false,
      required: [
        "title", "lens", "situation", "action", "result", "reflection",
        "sourceClaimIds", "missingQuestions",
      ],
      properties: {
        title: { type: "string" },
        lens: { type: "string", enum: STORY_LENSES },
        situation: { type: "string" },
        action: { type: "string" },
        result: { type: "string" },
        reflection: { type: "string" },
        sourceClaimIds: { ...stringArray, maxItems: 8 },
        missingQuestions: { ...stringArray, maxItems: 5 },
      },
    },
    `You are MeritOS Story Studio. Build a reusable Situation-Action-Result-Reflection story scaffold from verified evidence only.
Never invent chronology, metrics, emotions, obstacles, results, or motivations. If evidence is absent, keep that section brief and ask a targeted question.
Preserve concrete language. This is an editable scaffold, not a submission-ready essay.
When LENS is "Auto-select from target", choose exactly one allowed lens by weighing target relevance, evidence specificity, and whether the evidence supports all four story sections. Do not default to Leadership. Prefer Community impact when service or outreach evidence is stronger or more relevant, and Research when investigation evidence is stronger or more relevant.
When the applicant explicitly chooses a lens, use it only if the evidence supports it; otherwise ask for missing context instead of forcing unrelated evidence.
Claim IDs belong only in sourceClaimIds. Never include a claim ID, bracketed citation, or internal identifier in the title or story prose.`,
    `TARGET: ${input.target || "General future applications"}\nLENS: ${input.lens}\nEXPERIENCE FOCUS: ${input.focus || "Best-supported experience"}\nDEPTH: ${input.depth || "Standard"}\n\nVERIFIED CLAIMS:\n${evidenceText(input.claims)}`,
  );
  const validIds = new Set(input.claims.map((claim) => claim.id));
  const requestedLens = STORY_LENSES.find((lens) => lens === input.lens);
  story.lens = requestedLens || (STORY_LENSES.includes(story.lens as (typeof STORY_LENSES)[number]) ? story.lens : "Research");
  story.sourceClaimIds = story.sourceClaimIds.filter((claimId) => validIds.has(claimId));
  story.title = cleanProfileText(story.title, 180);
  story.situation = cleanProfileText(story.situation);
  story.action = cleanProfileText(story.action);
  story.result = cleanProfileText(story.result);
  story.reflection = cleanProfileText(story.reflection);
  story.missingQuestions = story.missingQuestions.map((question) => cleanProfileText(question, 500));
  return story;
}

export async function createGapArtifact(input: {
  target: string;
  gap: { area: string; whyItMatters: string; action: string };
  claims: VerifiedProfileClaim[];
}): Promise<GapArtifact> {
  const artifact = await structuredResponse<GapArtifact>(
    "meritos_gap_artifact",
    {
      type: "object",
      additionalProperties: false,
      required: ["title", "artifactType", "purpose", "content", "missingFields", "sourceClaimIds"],
      properties: {
        title: { type: "string" },
        artifactType: { type: "string", enum: ["outline", "worksheet", "plan", "email_draft", "portfolio_draft"] },
        purpose: { type: "string" },
        content: { type: "string" },
        missingFields: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "label", "prompt"],
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              prompt: { type: "string" },
            },
          },
        },
        sourceClaimIds: { ...stringArray, maxItems: 8 },
      },
    },
    `You are MeritOS Artifact Studio. Create a truthful, useful starter that helps an applicant close one preparation gap.
Use verified evidence only. Never create a credential, award, role, result, recommendation, publication, grade, or experience the applicant does not have.
If the gap requires a future experience, create a practical plan, worksheet, outreach email draft, or portfolio outline rather than pretending the experience exists.
Represent every applicant-specific detail that is not supported by evidence with a placeholder exactly like {{short_key}} and include a matching missingFields entry.
Keep the artifact editable and immediately useful. Do not include internal claim IDs in content. Do not claim the artifact is submission-ready.`,
    `TARGET: ${input.target}\nGAP AREA: ${input.gap.area}\nWHY IT MATTERS: ${input.gap.whyItMatters}\nSUGGESTED ACTION: ${input.gap.action}\n\nVERIFIED CLAIMS:\n${evidenceText(input.claims)}`,
  );
  const validIds = new Set(input.claims.map((claim) => claim.id));
  artifact.title = cleanProfileText(artifact.title, 180);
  artifact.purpose = cleanProfileText(artifact.purpose, 400);
  const keyMap = new Map(artifact.missingFields.map((field, index) => [
    field.key,
    field.key.replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 50) || `detail_${index + 1}`,
  ]));
  artifact.content = cleanProfileText(artifact.content, 8_000).replace(/\{\{\s*([^}]+)\s*\}\}/g, (placeholder, key: string) => {
    const normalizedKey = keyMap.get(key.trim());
    return normalizedKey ? `{{${normalizedKey}}}` : placeholder;
  });
  artifact.missingFields = artifact.missingFields
    .map((field) => ({
      key: keyMap.get(field.key) || field.key,
      label: cleanProfileText(field.label, 120),
      prompt: cleanProfileText(field.prompt, 300),
    }))
    .filter((field, index, list) => field.label && list.findIndex((item) => item.key === field.key) === index);
  artifact.sourceClaimIds = artifact.sourceClaimIds.filter((claimId) => validIds.has(claimId));
  return artifact;
}

export async function createInterviewQuestions(input: {
  target: string;
  claims: VerifiedProfileClaim[];
}): Promise<InterviewQuestion[]> {
  const result = await structuredResponse<{ questions: InterviewQuestion[] }>(
    "meritos_interview_questions",
    {
      type: "object",
      additionalProperties: false,
      required: ["questions"],
      properties: {
        questions: {
          type: "array",
          minItems: 6,
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "type", "question", "whyItIsAsked", "sourceClaimIds", "strongAnswerNeeds"],
            properties: {
              id: { type: "string" },
              type: {
                type: "string",
                enum: ["fit", "behavioral", "technical", "evidence", "challenge"],
              },
              question: { type: "string" },
              whyItIsAsked: { type: "string" },
              sourceClaimIds: { ...stringArray, maxItems: 5 },
              strongAnswerNeeds: { ...stringArray, maxItems: 5 },
            },
          },
        },
      },
    },
    `You are MeritOS Interview Practice. Generate realistic target-specific practice questions from the target and verified claims.
You are not an actual admissions officer and have no insider knowledge. Include fit, behavioral, evidence-defense, and challenge questions.
Do not assert missing facts. Claim IDs must be valid. Help the applicant defend what they can truthfully say.`,
    `TARGET: ${input.target}\n\nVERIFIED CLAIMS:\n${evidenceText(input.claims)}`,
  );
  const validIds = new Set(input.claims.map((claim) => claim.id));
  return result.questions.map((question, index) => ({
    ...question,
    id: question.id || `question-${index + 1}`,
    sourceClaimIds: question.sourceClaimIds.filter((claimId) => validIds.has(claimId)),
  }));
}

export async function evaluateInterviewAnswer(input: {
  target: string;
  question: string;
  answer: string;
  claims: VerifiedProfileClaim[];
}): Promise<InterviewFeedback> {
  const feedback = await structuredResponse<InterviewFeedback>(
    "meritos_interview_feedback",
    {
      type: "object",
      additionalProperties: false,
      required: ["summary", "strengths", "risks", "improvedOutline", "evidenceUsed", "followUpQuestion"],
      properties: {
        summary: { type: "string" },
        strengths: { ...stringArray, maxItems: 5 },
        risks: { ...stringArray, maxItems: 5 },
        improvedOutline: { ...stringArray, maxItems: 6 },
        evidenceUsed: { ...stringArray, maxItems: 8 },
        followUpQuestion: { type: "string" },
      },
    },
    `You are MeritOS Interview Coach. Evaluate the practice answer for clarity, specificity, truthfulness, and evidence.
Do not rewrite it into invented accomplishments. Identify claims unsupported by the verified profile. Return an improvement outline, not a memorized script.`,
    `TARGET: ${input.target}\nQUESTION: ${input.question}\nANSWER: ${input.answer}\n\nVERIFIED CLAIMS:\n${evidenceText(input.claims)}`,
  );
  const validIds = new Set(input.claims.map((claim) => claim.id));
  feedback.evidenceUsed = feedback.evidenceUsed.filter((claimId) => validIds.has(claimId));
  return feedback;
}
