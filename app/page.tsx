"use client";
/* eslint-disable @next/next/no-img-element */

import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

type View = "overview" | "profile" | "review" | "autopilot" | "fit" | "stories" | "interview" | "extension";
type ClaimStatus = "verified" | "draft" | "inference" | "restricted" | "missing";
type ImportStage = "idle" | "selected" | "uploading" | "done" | "error";

type Profile = {
  displayName: string;
  headline: string;
  onboardingComplete: boolean;
};

type Claim = {
  id: string;
  category: string;
  statement: string;
  status: ClaimStatus;
  evidence: string;
  sensitivity: "standard" | "sensitive";
  confidence: number;
};

type FitAnalysis = {
  id: string;
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

type FitGap = FitAnalysis["gaps"][number];

type GapArtifact = {
  title: string;
  artifactType: "outline" | "worksheet" | "plan" | "email_draft" | "portfolio_draft";
  purpose: string;
  content: string;
  missingFields: Array<{ key: string; label: string; prompt: string }>;
  sourceClaimIds: string[];
};

type OpportunityResult = {
  company: string;
  title: string;
  location: string;
  url: string;
  source: string;
  repository: string;
  fitScore?: number;
  matchReasons?: string[];
  audienceFit?: "confirmed" | "unconfirmed" | "conflict" | "not_requested";
};

type OpportunityPreflight = {
  title: string;
  organization: string;
  opportunityType: string;
  summary: string;
  deadlineText: string;
  deadlineIso: string;
  location: string;
  aiPolicy: { status: "permitted" | "restricted" | "prohibited" | "unknown"; detail: string };
  eligibilityRules: string[];
  requiredDocuments: string[];
  applicationQuestions: string[];
  requirements: Array<{
    category: "eligibility" | "document" | "experience" | "question" | "dependency";
    requirement: string;
    status: "supported" | "unclear" | "missing";
    evidenceClaimIds: string[];
    action: string;
  }>;
  missingInformationQuestions: string[];
  nextActions: Array<{ title: string; detail: string; priority: "now" | "soon" | "later" }>;
  confidence: string;
};

type ApplicationPacket = {
  opportunityId: string;
  applicationId: string;
  title: string;
  organization: string;
  sourceUrl: string;
  deadlineText: string;
  requiredDocuments: string[];
  requirements: OpportunityPreflight["requirements"];
  answers: Array<{
    question: string;
    status: "draft" | "needs_input" | "not_configured";
    draft: string;
    usedEvidenceIds: string[];
    questions: string[];
  }>;
  missingInputs: string[];
  nextActions: OpportunityPreflight["nextActions"];
  safetyNote: string;
};

type ApplicationQueueItem = {
  application: { id: string; opportunityId: string; status: "planning" | "drafting" | "review" | "submitted" | "withdrawn"; updatedAt: string };
  opportunity: { id: string; title: string; organization: string; url: string; deadline: string | null };
  preparation: {
    readiness: number;
    supported: number;
    requirementCount: number;
    missing: number;
    missingItems: string[];
    requiredDocuments: string[];
    visibleQuestions: number;
    aiPolicy: "permitted" | "restricted" | "prohibited" | "unknown";
  };
};

type InitiativeMode = "careful" | "proactive" | "high_initiative";

type Story = {
  id: string;
  title: string;
  lens: string;
  situation: string;
  action: string;
  result: string;
  reflection: string;
  sourceClaimIds: string[];
  status: "draft" | "approved";
};

type InterviewQuestion = {
  id: string;
  type: "fit" | "behavioral" | "technical" | "evidence" | "challenge";
  question: string;
  whyItIsAsked: string;
  sourceClaimIds: string[];
  strongAnswerNeeds: string[];
};

type InterviewSession = {
  id: string;
  target: string;
  questions: InterviewQuestion[];
};

type InterviewFeedback = {
  summary: string;
  strengths: string[];
  risks: string[];
  improvedOutline: string[];
  evidenceUsed: string[];
  followUpQuestion: string;
};

const supportedDocumentExtensions = ["pdf", "docx", "txt"];
const lenses = ["Auto-select from target", "Leadership", "Research", "Community impact", "Resilience", "Academic curiosity", "Entrepreneurship"];
const storyFocuses = [
  "Best-supported experience",
  "Research challenge",
  "Leadership decision",
  "Technical project",
  "Community contribution",
  "Failure and learning",
];
const storyDepths = ["Compact", "Standard", "Detailed"];
const coverageAreas = [
  { name: "Contact details", pattern: /contact|phone|mobile|telephone|email/i },
  { name: "Links & profiles", pattern: /linkedin|github|portfolio|website|https?:\/\//i },
  { name: "Education", pattern: /education|academic|school|coursework|degree|gpa/i },
  { name: "Experience", pattern: /experience|employment|intern|work|research/i },
  { name: "Projects & impact", pattern: /project|impact|portfolio|built|developed/i },
  { name: "Leadership", pattern: /leadership|led|founded|president|captain|mentor/i },
  { name: "Awards", pattern: /award|distinction|honou?r|recognition|achievement/i },
  { name: "Community", pattern: /community|service|volunteer|outreach/i },
  { name: "Skills", pattern: /skill|technical|language|tool|certif/i },
  { name: "Motivation & goals", pattern: /motivation|goal|interest|why|aspiration/i },
  { name: "Preferences & availability", pattern: /availability|location preference|work preference|start date|schedule/i },
];
const claimCategories = coverageAreas.map((area) => area.name);
const onboardingPurposeOptions = [
  { value: "jobs_internships", label: "Jobs and internships" },
  { value: "scholarships_fellowships", label: "Scholarships and fellowships" },
  { value: "college_graduate", label: "College or graduate programs" },
  { value: "grants_awards", label: "Grants and awards" },
  { value: "programs_service", label: "Programs, volunteering, or service" },
  { value: "mixed", label: "A mix of applications" },
];
const onboardingPurposePrompts: Record<string, string> = {
  jobs_internships: "Add recurring availability, preferred locations, remote or in-person preference, role types, and industries.",
  scholarships_fellowships: "Add recurring academic interests, community impact, leadership themes, recommendation constraints, and award goals.",
  college_graduate: "Add intended field, degree level, graduation timeline, research interests, program preferences, and geographic limits.",
  grants_awards: "Add project stage, intended impact, collaborators, approximate timing, organization context, and common required documents.",
  programs_service: "Add causes, availability, travel limits, languages, skills, age-related requirements you know, and preferred commitment level.",
  mixed: "Add the facts that repeatedly appear on your applications: availability, location preferences, goals, constraints, links, and recurring themes.",
};

const navigation: Array<{ id: View; label: string; index: string }> = [
  { id: "overview", label: "Home", index: "00" },
  { id: "profile", label: "Build profile", index: "01" },
  { id: "review", label: "Verify facts", index: "02" },
  { id: "extension", label: "Test autofill", index: "03" },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "mos-logo compact" : "mos-logo"}>
      <img src="/meritos-mark-v2.png" alt="" />
      {!compact && (
        <span>
          <strong>MeritOS</strong>
          <small>Application intelligence</small>
        </span>
      )}
    </div>
  );
}

function ReadinessVisual({ value, label }: { value: number; label: string }) {
  return (
    <div className="mos-readiness-scene" aria-label={`${label}: ${value}%`}>
      <div className="mos-readiness-plane plane-one" />
      <div className="mos-readiness-plane plane-two" />
      <div className="mos-orbit orbit-one" />
      <div className="mos-orbit orbit-two" />
      <img className="mos-orbit-mark mark-shadow" src="/meritos-mark-v2.png" alt="" />
      <img className="mos-orbit-mark" src="/meritos-mark-v2.png" alt="" />
      <div className="mos-readiness-number">
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return message ? <p className="mos-error" role="alert">{message}</p> : null;
}

function formatBand(value?: FitAnalysis["readinessBand"]) {
  if (!value) return "Profile coverage";
  return value.replaceAll("_", " ");
}

function evidenceSource(evidence: string) {
  try {
    const parsed = JSON.parse(evidence);
    return parsed[0]?.filename || parsed[0]?.source || "Added directly";
  } catch {
    return "MeritOS profile";
  }
}

export default function Home() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [view, setView] = useState<View>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>({ displayName: "", headline: "", onboardingComplete: false });
  const [onboardingPurpose, setOnboardingPurpose] = useState("jobs_internships");
  const [onboardingLevel, setOnboardingLevel] = useState("");
  const [onboardingLocation, setOnboardingLocation] = useState("");
  const [onboardingRecurringContext, setOnboardingRecurringContext] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [fit, setFit] = useState<FitAnalysis | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [target, setTarget] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [claimFilter, setClaimFilter] = useState<"all" | "verified" | "review">("all");
  const [claimQuery, setClaimQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importStage, setImportStage] = useState<ImportStage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [showFactForm, setShowFactForm] = useState(false);
  const [factCategory, setFactCategory] = useState("Motivation & goals");
  const [factStatement, setFactStatement] = useState("");
  const [factPrompt, setFactPrompt] = useState("");
  const [storyLens, setStoryLens] = useState(lenses[0]);
  const [storyFocus, setStoryFocus] = useState(storyFocuses[0]);
  const [storyDepth, setStoryDepth] = useState(storyDepths[1]);
  const [storyQuestions, setStoryQuestions] = useState<string[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState("");
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [extensionToken, setExtensionToken] = useState("");
  const [gapArtifact, setGapArtifact] = useState<GapArtifact | null>(null);
  const [gapArtifactValues, setGapArtifactValues] = useState<Record<string, string>>({});
  const [showContextImport, setShowContextImport] = useState(false);
  const [contextUrl, setContextUrl] = useState("");
  const [contextText, setContextText] = useState("");
  const [opportunityQuery, setOpportunityQuery] = useState("");
  const [opportunityResults, setOpportunityResults] = useState<OpportunityResult[]>([]);
  const [opportunityUrl, setOpportunityUrl] = useState("");
  const [preflight, setPreflight] = useState<OpportunityPreflight | null>(null);
  const [currentOpportunityId, setCurrentOpportunityId] = useState("");
  const [applicationPacket, setApplicationPacket] = useState<ApplicationPacket | null>(null);
  const [applicationQueue, setApplicationQueue] = useState<ApplicationQueueItem[]>([]);
  const [opportunityAlerts, setOpportunityAlerts] = useState(false);
  const [selectedOpportunityUrls, setSelectedOpportunityUrls] = useState<string[]>([]);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([]);
  const [initiativeMode, setInitiativeMode] = useState<InitiativeMode>("proactive");

  const verifiedClaims = useMemo(
    () => claims.filter((claim) => claim.status === "verified"),
    [claims],
  );
  const reviewClaims = useMemo(
    () => claims.filter((claim) => claim.status !== "verified"),
    [claims],
  );
  const coveredAreas = useMemo(
    () => coverageAreas.filter((area) =>
      verifiedClaims.some((claim) => area.pattern.test(`${claim.category} ${claim.statement}`)),
    ),
    [verifiedClaims],
  );
  const profileCoverage = Math.round(
    ((coveredAreas.length + (profile.displayName.trim() ? 0.5 : 0) + (profile.headline.trim() ? 0.5 : 0)) /
      (coverageAreas.length + 1)) * 100,
  );
  const readinessValue = fit?.score ?? profileCoverage;
  const activeQuestion = interview?.questions.find((question) => question.id === activeQuestionId)
    ?? interview?.questions[0]
    ?? null;
  const storyFocusOptions = useMemo(
    () => Array.from(new Set([...storyFocuses, ...(fit?.storyAngles.map((angle) => angle.title) || [])])),
    [fit],
  );
  const recommendedSources = useMemo(() => {
    const text = claims.map((claim) => `${claim.category} ${claim.statement} ${claim.evidence}`).join(" ");
    return [
      { name: "Résumé or CV", reason: "Identity, education, roles, projects, skills, and dates", present: /r[eé]sum[eé]|curriculum vitae|imported document/i.test(text), action: "upload" },
      { name: "LinkedIn export", reason: "Role history, organizations, links, and profile summary", present: /linkedin/i.test(text), action: "context" },
      { name: "Portfolio or personal site", reason: "Projects, public proof, writing, and technical work", present: /portfolio|personal website|github\.com|website/i.test(text), action: "context" },
      { name: "Transcript", reason: "Courses, institution, grades, and academic timeline", present: /transcript/i.test(text), action: "upload" },
      { name: "Prior essays or cover letters", reason: "Motivation, voice, values, and reusable stories", present: /essay|cover letter|personal statement/i.test(text), action: "upload" },
    ];
  }, [claims]);

  const filteredClaims = claims.filter((claim) => {
    const statusMatch =
      claimFilter === "all"
      || (claimFilter === "verified" && claim.status === "verified")
      || (claimFilter === "review" && claim.status !== "verified");
    return statusMatch && `${claim.category} ${claim.statement}`.toLowerCase().includes(claimQuery.toLowerCase());
  });

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/profile"),
      fetch("/api/claims"),
      fetch("/api/fit-analysis"),
      fetch("/api/stories"),
      fetch("/api/interview"),
      fetch("/api/applications"),
    ])
      .then(async (responses) => {
        if (responses.some((response) => !response.ok)) throw new Error("Your workspace could not be loaded.");
        const [profileData, claimsData, fitData, storiesData, interviewData, applicationsData] =
          await Promise.all(responses.map((response) => response.json()));
        if (cancelled) return;
        const nextProfile = {
          displayName: profileData.profile.displayName || user?.fullName || "",
          headline: profileData.profile.headline || "",
          onboardingComplete: profileData.profile.onboardingComplete === true,
        };
        setProfile(nextProfile);
        setClaims(claimsData.claims);
        setFit(fitData.analysis);
        setStories(storiesData.stories);
        setInterview(interviewData.session);
        setApplicationQueue(applicationsData.applications || []);
        setTarget(fitData.analysis?.target || interviewData.session?.target || "");
        setActiveQuestionId(interviewData.session?.questions?.[0]?.id || "");
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Your workspace could not be loaded."))
      .finally(() => !cancelled && setAccountLoading(false));
    return () => { cancelled = true; };
  }, [isSignedIn, user?.fullName]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpportunityAlerts(window.localStorage.getItem("meritosOpportunityAlerts") === "true");
      const savedMode = window.localStorage.getItem("meritosInitiativeMode");
      if (savedMode === "careful" || savedMode === "proactive" || savedMode === "high_initiative") setInitiativeMode(savedMode);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const mobileMenuTrigger = mobileMenuTriggerRef.current;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    const backgroundNodes = Array.from(document.querySelectorAll<HTMLElement>(".mos-workspace,.mos-mobile-dock"));
    backgroundNodes.forEach((node) => node.setAttribute("inert", ""));
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => mobileMenuCloseRef.current?.focus());
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      backgroundNodes.forEach((node) => node.removeAttribute("inert"));
      mobileMenuTrigger?.focus();
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (reduceMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.08, rootMargin: "0px 0px -24px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [
    view,
    claims.length,
    fit?.id,
    stories.length,
    isLoaded,
    isSignedIn,
    accountLoading,
    profile.onboardingComplete,
  ]);

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function goTo(next: View) {
    setView(next);
    setMobileMenuOpen(false);
    setError("");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  async function readJson(response: Response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  async function finishOnboarding() {
    setBusy("onboarding");
    setError("");
    try {
      const purposeLabel = onboardingPurposeOptions.find((option) => option.value === onboardingPurpose)?.label || "Applications";
      const onboardingFacts = [
        { category: "Motivation & goals", statement: `Primary MeritOS use: ${purposeLabel}.` },
        { category: "Education", statement: `Applicant-confirmed current education level: ${onboardingLevel}.` },
        onboardingLocation.trim() ? { category: "Preferences & availability", statement: `Applicant-confirmed current location: ${onboardingLocation.trim()}.` } : null,
        onboardingRecurringContext.trim() ? { category: "Preferences & availability", statement: `Applicant-confirmed recurring context for ${purposeLabel}: ${onboardingRecurringContext.trim()}` } : null,
      ].filter((item): item is { category: string; statement: string } => Boolean(item?.statement));
      const newFacts = onboardingFacts.filter((item) => !claims.some((claim) => claim.statement.trim().toLowerCase() === item.statement.trim().toLowerCase()));
      const createdClaims = await Promise.all(newFacts.map(async (item) => {
        const response = await readJson(await fetch("/api/claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, status: "verified", confidence: 100, evidence: [{ source: "Applicant-confirmed onboarding context" }], allowedUses: ["application_assistance", "fit_analysis", "interview_practice"] }),
        }));
        return response.claim as Claim;
      }));
      const data = await readJson(await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, onboardingComplete: true }),
      }));
      if (createdClaims.length) setClaims((current) => [...createdClaims, ...current]);
      setProfile(data.profile);
      announce("Your verified profile is ready.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Setup could not be saved.");
    } finally {
      setBusy("");
    }
  }

  function chooseFile(file: File | undefined) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!supportedDocumentExtensions.includes(extension)) {
      setImportStage("error");
      setImportMessage("Use a PDF, DOCX, or TXT file.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setImportStage("error");
      setImportMessage("This file is over the 12 MB limit.");
      return;
    }
    setSelectedFile(file);
    setImportStage("selected");
    setImportMessage("");
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    chooseFile(event.dataTransfer.files[0]);
  }

  async function importDocument() {
    if (!selectedFile) return;
    setImportStage("uploading");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const data = await readJson(await fetch("/api/documents", { method: "POST", body: formData }));
      setClaims((current) => [...data.candidateClaims, ...current]);
      setImportMessage(
        data.extraction?.mode === "ai"
          ? `${data.candidateClaims.length} grouped facts extracted. Review them before MeritOS uses them.`
          : data.extraction?.warning || `${data.candidateClaims.length} candidate facts extracted.`,
      );
      setImportStage("done");
    } catch (requestError) {
      setImportStage("error");
      setImportMessage(requestError instanceof Error ? requestError.message : "Upload failed.");
    }
  }

  function closeImport() {
    setShowImport(false);
    setImportStage("idle");
    setSelectedFile(null);
    setImportMessage("");
  }

  async function changeClaimStatus(claim: Claim, status: ClaimStatus) {
    setBusy(`claim-${claim.id}`);
    try {
      const data = await readJson(await fetch(`/api/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }));
      setClaims((current) => current.map((item) => item.id === claim.id ? data.claim : item));
      if (status === "verified" && /experience|project|leadership|community|research|employment|entrepreneur/i.test(claim.category) && !stories.some((story) => story.sourceClaimIds.includes(claim.id))) {
        void generateAutomaticStory(data.claim);
      }
      announce(status === "verified" ? "Fact verified and available to MeritOS." : "Fact moved out of automatic use.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The fact could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function changeClaimCategory(claim: Claim, category: string) {
    if (!category.trim() || category === claim.category) return;
    setBusy(`claim-${claim.id}`);
    try {
      const data = await readJson(await fetch(`/api/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      }));
      setClaims((current) => current.map((item) => item.id === claim.id ? data.claim : item));
      announce(`Moved this fact to ${category}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The fact category could not be changed.");
    } finally {
      setBusy("");
    }
  }

  async function generateAutomaticStory(claim: Claim) {
    try {
      const data = await readJson(await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target || fit?.target || "General future applications", lens: "Auto-select from target", focus: claim.category, depth: "Standard" }),
      }));
      setStories((current) => current.some((story) => story.id === data.story.id) ? current : [data.story, ...current]);
      announce("Fact verified. MeritOS also built a reusable story draft from it.");
    } catch {
      // Fact verification remains successful if optional background story creation is unavailable.
    }
  }

  async function deleteClaim(claim: Claim) {
    setBusy(`claim-${claim.id}`);
    try {
      const response = await fetch(`/api/claims/${claim.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("The fact could not be deleted.");
      setClaims((current) => current.filter((item) => item.id !== claim.id));
      announce("Fact deleted from your profile.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The fact could not be deleted.");
    } finally {
      setBusy("");
    }
  }

  function openFactForm(category = "Motivation & goals", prompt = "") {
    setFactCategory(category);
    setFactPrompt(prompt);
    setFactStatement("");
    setShowFactForm(true);
  }

  async function saveFact() {
    if (!factStatement.trim()) return;
    setBusy("fact");
    try {
      const data = await readJson(await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: factCategory,
          statement: factStatement,
          status: "verified",
          confidence: 100,
          evidence: [{ source: "Applicant-confirmed profile context" }],
          allowedUses: ["application_assistance", "fit_analysis", "interview_practice"],
        }),
      }));
      setClaims((current) => [data.claim, ...current]);
      setShowFactForm(false);
      announce("Context added to your verified profile.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The fact could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function runFitAnalysis() {
    if (!target.trim()) return;
    setBusy("fit");
    setError("");
    try {
      const data = await readJson(await fetch("/api/fit-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, profileCoverage }),
      }));
      setFit(data.analysis);
      announce("Target analysis rebuilt from your current verified profile.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Target analysis failed.");
    } finally {
      setBusy("");
    }
  }

  async function buildGapArtifact(gap: FitGap) {
    setBusy(`gap-${gap.area}`);
    setError("");
    try {
      const data = await readJson(await fetch("/api/gap-artifact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: fit?.target || target, gap }),
      }));
      setGapArtifact(data.artifact);
      setGapArtifactValues({});
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "MeritOS could not build this starter.");
    } finally {
      setBusy("");
    }
  }

  function completedArtifact() {
    if (!gapArtifact) return "";
    return gapArtifact.content.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
      const value = gapArtifactValues[key]?.trim();
      return value || `[NEEDS YOUR INPUT: ${gapArtifact.missingFields.find((field) => field.key === key)?.label || key}]`;
    });
  }

  function downloadGapArtifact() {
    if (!gapArtifact) return;
    const file = new Blob([`# ${gapArtifact.title}\n\n${gapArtifact.purpose}\n\n${completedArtifact()}\n`], { type: "text/markdown" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${gapArtifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "meritos-starter"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    announce("Starter downloaded.");
  }

  async function addArtifactAsContext() {
    if (!gapArtifact) return;
    setBusy("save-artifact");
    try {
      const data = await readJson(await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "Generated artifact draft",
          statement: `${gapArtifact.title}\n\n${completedArtifact()}`,
          status: "draft",
          confidence: 0,
          evidence: [{ source: "MeritOS gap starter", supportingClaimIds: gapArtifact.sourceClaimIds }],
          allowedUses: [],
        }),
      }));
      setClaims((current) => [data.claim, ...current]);
      setGapArtifact(null);
      announce("Added as a draft. Review it before MeritOS can reuse it.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The starter could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function importContextSource() {
    if (!contextUrl.trim()) return;
    setBusy("context-url");
    setError("");
    try {
      const data = await readJson(await fetch("/api/context-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: contextUrl, pastedText: contextText }),
      }));
      setClaims((current) => [...data.candidateClaims, ...current]);
      setShowContextImport(false);
      setContextUrl("");
      setContextText("");
      announce(`${data.candidateClaims.length} draft profile item${data.candidateClaims.length === 1 ? "" : "s"} imported for review.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "That context source could not be imported.");
    } finally {
      setBusy("");
    }
  }

  async function scanOpportunityBoards(prepareBest = false, background = false) {
    const query = opportunityQuery.trim() || fit?.target || target;
    if (!query) return;
    if (!background) { setBusy("opportunity-watch"); setError(""); }
    try {
      const data = await readJson(await fetch("/api/opportunity-watch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) }));
      const items: OpportunityResult[] = data.items || [];
      setOpportunityResults(items);
      if (!background) setSelectedOpportunityUrls(items.slice(0, 5).map((item) => item.url));
      const known = new Set<string>(JSON.parse(window.localStorage.getItem("meritosKnownOpportunities") || "[]"));
      const newItems = items.filter((item) => !known.has(item.url));
      window.localStorage.setItem("meritosKnownOpportunities", JSON.stringify(items.map((item) => item.url).slice(0, 100)));
      if (background && newItems.length && Notification.permission === "granted") new Notification("MeritOS found new matches", { body: `${newItems.length} new opportunity${newItems.length === 1 ? "" : "ies"} match your Autopilot alert.` });
      if (!background) announce(`Searched ${data.sources?.length || 0} live sources and found ${items.length} possible matches.`);
      if (prepareBest && items[0]?.url) await analyzeOpportunityPage(items[0].url);
    } catch (requestError) {
      if (!background) setError(requestError instanceof Error ? requestError.message : "Opportunity sources could not be searched.");
    } finally { if (!background) setBusy(""); }
  }

  async function prepareSelectedApplications() {
    const urls = selectedOpportunityUrls.slice(0, 10);
    if (!urls.length) return;
    setBusy("application-batch");
    setError("");
    let prepared = 0;
    let latestPacket: ApplicationPacket | null = null;
    for (const url of urls) {
      try {
        const preflightData = await readJson(await fetch("/api/opportunity-preflight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, pastedText: "" }),
        }));
        const packetData = await readJson(await fetch("/api/application-packet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId: preflightData.opportunityId, mode: initiativeMode }),
        }));
        latestPacket = packetData.packet;
        prepared += 1;
      } catch {
        // Keep preparing the remaining user-selected opportunities.
      }
    }
    if (latestPacket) setApplicationPacket(latestPacket);
    const applicationsData = await readJson(await fetch("/api/applications"));
    setApplicationQueue(applicationsData.applications || []);
    setSelectedApplicationIds((applicationsData.applications || []).filter((item: ApplicationQueueItem) => item.application.status !== "submitted" && item.application.status !== "withdrawn").slice(0, prepared).map((item: ApplicationQueueItem) => item.application.id));
    setBusy("");
    announce(`${prepared} application${prepared === 1 ? "" : "s"} prepared. Review the exception queue, then hand the batch to Chrome.`);
  }

  function changeInitiativeMode(mode: InitiativeMode) {
    setInitiativeMode(mode);
    window.localStorage.setItem("meritosInitiativeMode", mode);
    window.postMessage({ type: "MERITOS_SET_INITIATIVE_MODE", mode }, window.location.origin);
    announce(mode === "high_initiative" ? "High-initiative mode enabled. Low-risk gaps will be inferred and labeled." : `${mode === "proactive" ? "Proactive" : "Careful"} mode enabled.`);
  }

  function handoffSelectedApplications() {
    const selected = applicationQueue.filter((item) => selectedApplicationIds.includes(item.application.id));
    if (!selected.length) return;
    window.postMessage({
      type: "MERITOS_QUEUE_APPLICATIONS",
      mode: initiativeMode,
      applications: selected.map((item) => ({ id: item.application.id, title: item.opportunity.title, organization: item.opportunity.organization, url: item.opportunity.url })),
    }, window.location.origin);
    announce(`${selected.length} application${selected.length === 1 ? "" : "s"} sent to the Chrome queue. MeritOS will open the first form and pause at true exceptions.`);
  }

  async function toggleOpportunityAlerts() {
    const next = !opportunityAlerts;
    if (next && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    setOpportunityAlerts(next);
    window.localStorage.setItem("meritosOpportunityAlerts", String(next));
    window.postMessage({ type: "MERITOS_SET_OPPORTUNITY_ALERT", enabled: next, query: opportunityQuery.trim() || fit?.target || target }, window.location.origin);
    announce(next ? "Autopilot alert enabled. The Chrome extension will keep watching in the background." : "Autopilot alert paused.");
    if (next) void scanOpportunityBoards(false, true);
  }

  async function analyzeOpportunityPage(selectedUrl = opportunityUrl) {
    if (!selectedUrl.trim()) return;
    setBusy("opportunity-preflight");
    setError("");
    setApplicationPacket(null);
    try {
      const data = await readJson(await fetch("/api/opportunity-preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: selectedUrl, pastedText: "" }),
      }));
      setPreflight(data.preflight);
      setCurrentOpportunityId(data.opportunityId);
      setOpportunityUrl(data.sourceUrl);
      const applicationsData = await readJson(await fetch("/api/applications"));
      setApplicationQueue(applicationsData.applications || []);
      announce("Best match analyzed. MeritOS is preparing its application packet.");
      await buildApplicationPacket(data.opportunityId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "That opportunity could not be analyzed.");
    } finally {
      setBusy("");
    }
  }

  async function buildApplicationPacket(opportunityId = currentOpportunityId) {
    if (!opportunityId) return;
    setBusy("application-packet");
    setError("");
    try {
      const data = await readJson(await fetch("/api/application-packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, mode: initiativeMode }),
      }));
      setApplicationPacket(data.packet);
      const applicationsData = await readJson(await fetch("/api/applications"));
      setApplicationQueue(applicationsData.applications || []);
      announce("Your evidence-backed application packet is ready for review.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The application packet could not be built.");
    } finally {
      setBusy("");
    }
  }

  function downloadApplicationPacket() {
    if (!applicationPacket) return;
    const answers = applicationPacket.answers.map((answer) => `## ${answer.question}\n\n${answer.status === "draft" ? answer.draft : `NEEDS INPUT: ${answer.questions.join(" ")}`}`).join("\n\n");
    const content = [
      `# ${applicationPacket.title} — Application packet`,
      `Organization: ${applicationPacket.organization}`,
      `Official page: ${applicationPacket.sourceUrl}`,
      `Deadline: ${applicationPacket.deadlineText || "Not confirmed"}`,
      "## Required documents",
      ...(applicationPacket.requiredDocuments.length ? applicationPacket.requiredDocuments.map((item) => `- ${item}`) : ["- No documents were explicitly detected. Confirm on the official page."]),
      "## Draft answers",
      answers || "No application questions were visible on the analyzed page. Use the Chrome extension on the live form.",
      "## Missing information",
      ...(applicationPacket.missingInputs.length ? applicationPacket.missingInputs.map((item) => `- ${item}`) : ["- None detected by this preflight."]),
      `> ${applicationPacket.safetyNote}`,
    ].join("\n\n");
    const file = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${applicationPacket.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "application"}-packet.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    announce("Application packet downloaded.");
  }

  async function generateStory() {
    setBusy("story");
    setStoryQuestions([]);
    setError("");
    try {
      const data = await readJson(await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: target || fit?.target,
          lens: storyLens,
          focus: storyFocus,
          depth: storyDepth,
        }),
      }));
      setStories((current) => [data.story, ...current]);
      setStoryQuestions(data.missingQuestions || []);
      announce("A grounded story scaffold was added to your bank.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Story generation failed.");
    } finally {
      setBusy("");
    }
  }

  async function saveStory(story: Story, status = story.status) {
    setBusy(`story-${story.id}`);
    try {
      const data = await readJson(await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...story, status }),
      }));
      setStories((current) => current.map((item) => item.id === story.id ? data.story : item));
      announce(status === "approved" ? "Story approved for reuse." : "Story changes saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Story could not be saved.");
    } finally {
      setBusy("");
    }
  }

  function updateStory(id: string, field: keyof Story, value: string) {
    setStories((current) => current.map((story) => story.id === id ? { ...story, [field]: value } : story));
  }

  async function generateInterview() {
    if (!target.trim()) return;
    setBusy("interview");
    setFeedback(null);
    setError("");
    try {
      const data = await readJson(await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", target }),
      }));
      setInterview(data.session);
      setActiveQuestionId(data.session.questions[0]?.id || "");
      setPracticeAnswer("");
      announce("Your target-specific interview set is ready.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Interview set could not be generated.");
    } finally {
      setBusy("");
    }
  }

  async function evaluateAnswer() {
    if (!activeQuestion || !practiceAnswer.trim()) return;
    setBusy("feedback");
    setError("");
    try {
      const data = await readJson(await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate",
          target: interview?.target || target,
          question: activeQuestion.question,
          answer: practiceAnswer,
        }),
      }));
      setFeedback(data.feedback);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Answer feedback failed.");
    } finally {
      setBusy("");
    }
  }

  async function createExtensionConnection() {
    setBusy("extension");
    try {
      const data = await readJson(await fetch("/api/extension/connect", { method: "POST" }));
      setExtensionToken(data.token);
      window.postMessage({ type: "MERITOS_CONNECT_PROFILE", token: data.token, baseUrl: window.location.origin }, window.location.origin);
      await navigator.clipboard?.writeText(data.token);
      announce("Chrome connection sent. The copied key remains available as a fallback.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Connection key could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function copyValidationTemplate() {
    const template = [
      "MeritOS accuracy test",
      "Scenario: internship / research / scholarship / grant / nonprofit",
      "Profile source used:",
      "Fields detected:",
      "Correct answers:",
      "Wrong answers (question → suggested answer):",
      "Important fields missed:",
      "Fields MeritOS correctly left blank:",
      "Did date, radio, select, and checkbox controls fill?",
      "Did MeritOS stop before final Submit?",
      "Anything confusing:",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(template);
      announce("Test report template copied. Paste it back into this chat after your run.");
    } catch {
      announce("Copy was blocked by the browser. Use the checklist shown on this page.");
    }
  }

  if (!isLoaded || (isSignedIn && accountLoading)) {
    return (
      <main className="mos-loading">
        <Logo />
        <div className="mos-loader-line"><span /></div>
        <p>Opening your private profile…</p>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="mos-landing">
        <nav className="mos-landing-nav">
          <Logo />
          <div className="mos-landing-links">
            <a href="#how-it-works">How it works</a>
            <a href="#profile-intelligence">Profile intelligence</a>
            <a href="/install">Chrome extension</a>
          </div>
          <div>
            <SignInButton mode="modal"><button className="mos-button ghost">Sign in</button></SignInButton>
            <SignUpButton mode="modal"><button className="mos-button dark">Create account</button></SignUpButton>
          </div>
        </nav>
        <section className="mos-landing-hero">
          <div className="mos-landing-copy" data-reveal>
            <span className="mos-kicker">One profile. Every application form.</span>
            <h1>Your real experience,<br /><em>ready wherever you apply.</em></h1>
            <p>
              MeritOS turns your approved résumé facts into accurate suggestions beside legitimate
              application forms. You inspect every fact, fix mistakes once, and keep final control.
            </p>
            <div className="mos-action-row">
              <SignUpButton mode="modal"><button className="mos-button dark large">Build my profile</button></SignUpButton>
              <a className="mos-button light large" href="/install">Desktop extension</a>
            </div>
            <p className="mos-mobile-companion-note">
              On iPhone, MeritOS is your review and approval companion. The form-filling extension runs in desktop Chrome.
            </p>
            <div className="mos-trust-row">
              <span>Facts you approved</span><span>Evidence linked</span><span>Stops before final submit</span>
            </div>
          </div>
          <div className="mos-landing-visual" data-reveal>
            <div className="mos-profile-stack">
              <article><small>VERIFIED PROFILE</small><strong>Research experience</strong><span>Résumé · approved by you</span></article>
              <article><small>LIVE FORM</small><strong>Suggested answer</strong><span>2 supporting facts · review first</span></article>
              <article><small>VISIBLE LIMIT</small><strong>Answer needs you</strong><span>No supporting evidence found</span></article>
            </div>
            <img src="/meritos-mark-v2.png" alt="" />
          </div>
        </section>
        <section className="mos-flow" id="how-it-works" aria-label="How MeritOS works">
          <article><b>01</b><strong>Build your profile</strong><p>Upload documents and add context a résumé cannot capture.</p></article>
          <article><b>02</b><strong>Verify every fact</strong><p>Control what is true, sensitive, or safe to reuse.</p></article>
          <article><b>03</b><strong>Open the real form</strong><p>The Chrome side panel detects supported factual questions beside the application.</p></article>
          <article><b>04</b><strong>Approve before filling</strong><p>MeritOS fills what you approve and stops at the irreversible final action.</p></article>
        </section>
        <section className="mos-landing-intelligence" id="profile-intelligence">
          <div className="mos-landing-section-copy" data-reveal>
            <span className="mos-kicker">Application context that improves over time</span>
            <h2>A private source of truth, not another essay generator.</h2>
            <p>
              MeritOS separates verified evidence from generated language. Every suggestion can be traced
              back to the profile facts you approved, while missing context stays visibly missing.
            </p>
            <a className="mos-button dark large" href="/install">See how the extension works</a>
          </div>
          <div className="mos-intelligence-stack" data-reveal>
            <article><b>01</b><span><strong>Context coverage</strong><small>See what MeritOS knows—and what it still needs.</small></span></article>
            <article><b>02</b><span><strong>Evidence boundaries</strong><small>Unsupported and sensitive answers stay visibly unresolved.</small></span></article>
            <article><b>03</b><span><strong>External form assistant</strong><small>Review grounded answers beside the real application.</small></span></article>
            <img src="/meritos-mark-v2.png" alt="" />
          </div>
        </section>
      </main>
    );
  }

  if (!profile.onboardingComplete) {
    return (
      <main className="mos-onboarding">
        <nav className="mos-landing-nav"><Logo /><UserButton /></nav>
        <section className="mos-onboarding-card">
          <div className="mos-onboarding-steps"><span className="active">Account</span><span className="active">Profile</span><span>Workspace</span></div>
          <span className="mos-kicker">One-time setup</span>
          <h1>Give MeritOS enough context to be useful.</h1>
          <p>This guided setup disappears when you finish. Your profile remains editable.</p>
          <div className="mos-field-grid">
            <label>Full name<input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} placeholder="Your full name" /></label>
            <label>Current direction<input value={profile.headline} onChange={(event) => setProfile({ ...profile, headline: event.target.value })} placeholder="What are you working toward?" /></label>
          </div>
          <section className="mos-onboarding-intake" aria-labelledby="onboarding-intake-title">
            <div><span className="mos-kicker">Application intent</span><h2 id="onboarding-intake-title">Teach MeritOS what your forms usually ask.</h2><p>These answers become verified reusable context, so the extension asks you fewer questions later.</p></div>
            <div className="mos-field-grid">
              <label>What will you use MeritOS for most?<select value={onboardingPurpose} onChange={(event) => setOnboardingPurpose(event.target.value)}>{onboardingPurposeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label>Current stage<select value={onboardingLevel} onChange={(event) => setOnboardingLevel(event.target.value)}><option value="">Choose your current stage</option><option>Middle school</option><option>High school</option><option>College undergraduate</option><option>Graduate or professional school</option><option>Early career</option><option>Experienced professional</option><option>Career change</option><option>Other</option></select></label>
              <label>Current city and state or region<input value={onboardingLocation} onChange={(event) => setOnboardingLocation(event.target.value)} placeholder="Example: Queen Creek, AZ" /></label>
              <label>Context that appears repeatedly<textarea value={onboardingRecurringContext} onChange={(event) => setOnboardingRecurringContext(event.target.value)} placeholder={onboardingPurposePrompts[onboardingPurpose]} /></label>
            </div>
            <small>{onboardingPurposePrompts[onboardingPurpose]} MeritOS never guesses consent, legal status, sensitive demographics, or exact addresses.</small>
          </section>
          <div className="mos-setup-row">
            <span><b>1</b><span><strong>Import your résumé or CV</strong><small>PDF, DOCX, or TXT. AI groups related bullets into usable facts.</small></span></span>
            <button className="mos-button light" onClick={() => setShowImport(true)}>Choose document</button>
          </div>
          <div className="mos-setup-row">
            <span><b>2</b><span><strong>Verify extracted facts</strong><small>{verifiedClaims.length} of {claims.length} currently approved.</small></span></span>
            <span className="mos-pill">{claims.length ? "Review below" : "Waiting for upload"}</span>
          </div>
          <div className="mos-setup-row">
            <span><b>3</b><span><strong>Add what your résumé misses</strong><small>Links, contact details, goals, preferences, and availability improve form accuracy.</small></span></span>
            <div className="mos-action-row"><button className="mos-button light" onClick={() => setShowContextImport(true)}>Import website / LinkedIn</button><button className="mos-button light" onClick={() => openFactForm("Contact details")}>Add contact</button></div>
          </div>
          {claims.length > 0 && (
            <div className="mos-onboarding-claims">
              {claims.map((claim) => (
                <article key={claim.id}>
                  <span><small>{claim.category}</small><strong>{claim.statement}</strong></span>
                  <button
                    className={claim.status === "verified" ? "mos-button light" : "mos-button dark"}
                    disabled={busy === `claim-${claim.id}`}
                    onClick={() => changeClaimStatus(claim, claim.status === "verified" ? "draft" : "verified")}
                  >
                    {claim.status === "verified" ? "Verified ✓" : "Verify"}
                  </button>
                </article>
              ))}
            </div>
          )}
          <ErrorMessage message={error} />
          <button
            className="mos-button dark large full"
            disabled={!profile.displayName.trim() || !onboardingLevel || verifiedClaims.length === 0 || busy === "onboarding"}
            onClick={finishOnboarding}
          >
            {busy === "onboarding" ? "Saving…" : "Finish profile setup"}
          </button>
          {verifiedClaims.length === 0 && <small className="mos-helper">Verify at least one real fact to continue.</small>}
        </section>
        {showImport && renderImportModal()}
        {showContextImport && renderContextImportModal()}
      </main>
    );
  }

  const pageTitle = navigation.find((item) => item.id === view)?.label || "Home";
  const mobilePrimaryNavigation = navigation.filter((item) => ["overview", "profile", "extension"].includes(item.id));
  const autopilotStages = [
    { label: "Set your goal", complete: Boolean(opportunityQuery.trim() || fit?.target || target) },
    { label: "Review matches", complete: opportunityResults.length > 0 },
    { label: "Prepare applications", complete: applicationQueue.length > 0 },
    { label: "Finish in Chrome", complete: Boolean(applicationPacket) },
  ];
  const firstIncompleteAutopilotStage = autopilotStages.findIndex((stage) => !stage.complete);
  const autopilotStageIndex = firstIncompleteAutopilotStage === -1 ? autopilotStages.length - 1 : firstIncompleteAutopilotStage;

  return (
    <main className="mos-app">
      <aside className="mos-sidebar">
        <Logo />
        <p className="mos-nav-label">Workspace</p>
        <nav>
          {navigation.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => goTo(item.id)}>
              <span>{item.index}</span>{item.label}
              {item.id === "review" && reviewClaims.length > 0 && <b>{reviewClaims.length}</b>}
            </button>
          ))}
        </nav>
        <div className="mos-sidebar-status">
          <span><small>Profile coverage</small><strong>{profileCoverage}%</strong></span>
          <div><i style={{ width: `${profileCoverage}%` }} /></div>
          <p>{verifiedClaims.length} verified facts · {coveredAreas.length}/{coverageAreas.length} context areas</p>
        </div>
        <div className="mos-user">
          <span>{profile.displayName.slice(0, 2).toUpperCase()}</span>
          <div><strong>{profile.displayName}</strong><small>{profile.headline || "Add your direction"}</small></div>
          <UserButton />
        </div>
      </aside>

      <nav className="mos-mobile-dock" aria-label="Primary workspace navigation">
        {mobilePrimaryNavigation.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => goTo(item.id)}>
            <span>{item.index}</span><strong>{item.label}</strong>
          </button>
        ))}
        <button ref={mobileMenuTriggerRef} className={!mobilePrimaryNavigation.some((item) => item.id === view) ? "active" : ""} aria-haspopup="dialog" aria-controls="mos-mobile-navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}>
          <span>04</span><strong>More</strong>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="mos-mobile-sheet-backdrop" role="presentation" onClick={() => setMobileMenuOpen(false)}>
          <section id="mos-mobile-navigation" className="mos-mobile-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-navigation-title" onClick={(event) => event.stopPropagation()}>
            <header><div><span className="mos-kicker">Workspace</span><h2 id="mobile-navigation-title">Where do you want to go?</h2></div><button ref={mobileMenuCloseRef} className="mos-mobile-sheet-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation">Close</button></header>
            <div className="mos-mobile-sheet-grid">
              {navigation.map((item) => (
                <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => goTo(item.id)}>
                  <span>{item.index}</span><strong>{item.label}</strong>
                  {item.id === "review" && reviewClaims.length > 0 && <b>{reviewClaims.length} to review</b>}
                </button>
              ))}
            </div>
            <footer><span>Profile coverage</span><strong>{profileCoverage}%</strong><div><i style={{ width: `${profileCoverage}%` }} /></div></footer>
          </section>
        </div>
      )}

      <section className="mos-workspace">
        <header className="mos-topbar">
          <div><span className="mos-kicker">Your private application workspace</span><h1>{pageTitle}</h1></div>
          <div className="mos-top-actions">
            <button className="mos-button light" onClick={() => openFactForm()}>Add context</button>
            <button className="mos-button dark" onClick={() => setShowImport(true)}>Upload document</button>
          </div>
        </header>

        <ErrorMessage message={error} />

        {view === "overview" && (
          <div className="mos-page mos-overview">
            <section className="mos-hero" data-reveal>
              <div>
                <span className="mos-pill inverse">Accuracy validation release</span>
                <h2>Fill repetitive application fields from facts you can inspect.</h2>
                <p>Upload your résumé, correct the extracted profile, and test MeritOS beside a safe application form. Unsupported, sensitive, and opportunity-specific answers remain visible instead of being invented.</p>
                <div className="mos-action-row">
                  <button className="mos-button pale" onClick={() => goTo(verifiedClaims.length ? "extension" : "profile")}>{verifiedClaims.length ? "Test my profile" : "Build my profile"}</button>
                  <button className="mos-button text-inverse" onClick={() => goTo("review")}>Review extracted facts →</button>
                </div>
              </div>
              <ReadinessVisual value={readinessValue} label="profile coverage" />
            </section>

            <section className="mos-metric-strip" data-reveal>
              <article><small>Verified facts</small><strong>{verifiedClaims.length}</strong><span>safe for supported answers</span></article>
              <article><small>Needs your review</small><strong>{reviewClaims.length}</strong><span>excluded from autofill</span></article>
              <article><small>Context coverage</small><strong>{coveredAreas.length}/{coverageAreas.length}</strong><span>areas represented</span></article>
              <article><small>Chrome connection</small><strong>{extensionToken ? "Ready" : "Off"}</strong><span>{extensionToken ? "profile connected" : "connect before testing"}</span></article>
            </section>

            <section className="mos-grid two-one">
              <article className="mos-card" data-reveal>
                <div className="mos-card-head"><div><span className="mos-kicker">Next best actions</span><h3>Make MeritOS more accurate</h3></div></div>
                <div className="mos-action-list">
                  {reviewClaims.length > 0 && <button onClick={() => goTo("review")}><b>01</b><span><strong>Review {reviewClaims.length} extracted facts</strong><small>Unverified information cannot enter forms.</small></span><i>→</i></button>}
                  {coveredAreas.length < coverageAreas.length && <button onClick={() => openFactForm(coverageAreas.find((area) => !coveredAreas.includes(area))?.name)}><b>02</b><span><strong>Fill a missing context area</strong><small>Your résumé does not explain everything that matters.</small></span><i>→</i></button>}
                  <button onClick={() => goTo("extension")}><b>03</b><span><strong>Run the factual autofill test</strong><small>Check identity, education, dates, choices, and unsupported questions on a safe form.</small></span><i>→</i></button>
                </div>
              </article>
              <article className="mos-card mos-context-card" data-reveal>
                <span className="mos-kicker">What MeritOS knows</span>
                <h3>Context map</h3>
                <div className="mos-coverage-list">
                  {coverageAreas.map((area) => {
                    const covered = coveredAreas.includes(area);
                    return <button key={area.name} onClick={() => !covered && openFactForm(area.name)}><span className={covered ? "covered" : ""} />{area.name}<small>{covered ? "Ready" : "Add"}</small></button>;
                  })}
                </div>
              </article>
            </section>

            <section className="mos-extension-callout" data-reveal>
              <img src="/meritos-mark-v2.png" alt="" />
              <div><span className="mos-kicker">One workflow to prove</span><h3>Does your verified profile fill a real form accurately?</h3><p>Use the controlled testing lab first. If an answer is wrong, the test tells us whether extraction, matching, or form filling needs work.</p></div>
              <button className="mos-button dark" onClick={() => goTo("extension")}>Start accuracy test</button>
            </section>
          </div>
        )}

        {view === "profile" && (
          <div className="mos-page">
            <section className="mos-page-intro" data-reveal>
              <div><span className="mos-kicker">Your source of truth</span><h2>Build the fullest truthful picture of you.</h2><p>Documents provide evidence. Direct context captures goals, motivations, preferences, and details that never make it onto a résumé.</p></div>
              <div className="mos-action-row"><button className="mos-button light" onClick={() => setShowContextImport(true)}>Import website / LinkedIn</button><button className="mos-button light" onClick={() => openFactForm()}>Add context</button><button className="mos-button dark" onClick={() => setShowImport(true)}>Upload document</button></div>
            </section>
            <section className="mos-source-plan" data-reveal>
              <div><span className="mos-kicker">Smart source checklist</span><h3>Give MeritOS evidence once.</h3><p>Each source closes different gaps. Add the highest-value missing source; MeritOS re-checks coverage after every import.</p></div>
              <div>{recommendedSources.map((source) => <article key={source.name} className={source.present ? "complete" : ""}><span>{source.present ? "✓" : "+"}</span><div><strong>{source.name}</strong><small>{source.present ? "Detected in your profile" : source.reason}</small></div>{!source.present && <button onClick={() => source.action === "context" ? setShowContextImport(true) : setShowImport(true)}>Add source</button>}</article>)}</div>
            </section>
            <section className="mos-coverage-grid" data-reveal>
              {coverageAreas.map((area) => {
                const count = verifiedClaims.filter((claim) => area.pattern.test(`${claim.category} ${claim.statement}`)).length;
                return (
                  <button key={area.name} className={count ? "complete" : ""} onClick={() => !count && openFactForm(area.name)}>
                    <span>{count ? "✓" : "+"}</span><strong>{area.name}</strong><small>{count ? `${count} verified` : "Add context"}</small>
                  </button>
                );
              })}
            </section>
            <section className="mos-card" data-reveal>
              <div className="mos-card-head">
                <div><span className="mos-kicker">Profile facts</span><h3>{filteredClaims.length} facts shown</h3></div>
                <div className="mos-filter-row">
                  <input value={claimQuery} onChange={(event) => setClaimQuery(event.target.value)} placeholder="Search profile" aria-label="Search profile facts" />
                  {(["all", "verified", "review"] as const).map((filter) => <button key={filter} className={claimFilter === filter ? "active" : ""} onClick={() => setClaimFilter(filter)}>{filter}</button>)}
                </div>
              </div>
              <div className="mos-claim-list">
                {filteredClaims.map((claim) => (
                  <article key={claim.id}>
                    <span className={`mos-claim-state ${claim.status}`} />
                    <div><small>{evidenceSource(claim.evidence)}</small><select className="mos-claim-category" value={claim.category} disabled={busy === `claim-${claim.id}`} onChange={(event) => void changeClaimCategory(claim, event.target.value)} aria-label={`Category for ${claim.statement}`}>{[...new Set([...claimCategories, claim.category])].map((category) => <option key={category}>{category}</option>)}</select><strong>{claim.statement}</strong><p>{claim.status === "verified" ? "Available for supported answers" : claim.status === "restricted" ? "Sensitive and excluded unless you approve it" : "Excluded until you verify it"}</p></div>
                    <div className="mos-claim-actions">
                      <button className="mos-button light small" disabled={busy === `claim-${claim.id}`} onClick={() => changeClaimStatus(claim, claim.status === "verified" ? "draft" : "verified")}>{claim.status === "verified" ? "Unverify" : "Verify"}</button>
                      <button className="mos-button ghost small" onClick={() => changeClaimStatus(claim, "restricted")}>Restrict</button>
                      <button className="mos-button danger small" onClick={() => deleteClaim(claim)}>Delete</button>
                    </div>
                  </article>
                ))}
                {!filteredClaims.length && <div className="mos-empty"><strong>No matching facts.</strong><p>Upload a document or add context directly.</p></div>}
              </div>
            </section>
          </div>
        )}

        {view === "review" && (
          <div className="mos-page">
            <section className="mos-page-intro" data-reveal>
              <div><span className="mos-kicker">Truth check</span><h2>Review what MeritOS is allowed to use.</h2><p>This is profile QA—not an admissions review. Fix weak extraction, protect sensitive details, and close context gaps before opening an application form.</p></div>
              <div className="mos-score-chip"><strong>{profileCoverage}%</strong><span>profile coverage</span></div>
            </section>
            <section className="mos-review-grid">
              <article className="mos-card" data-reveal><span className="mos-kicker">Needs attention</span><h3>{reviewClaims.length} facts are excluded</h3><p>Draft, inferred, missing, and restricted facts never autofill as verified information.</p><button className="mos-button dark" onClick={() => { setClaimFilter("review"); goTo("profile"); }}>Review these facts</button></article>
              <article className="mos-card" data-reveal><span className="mos-kicker">Context gaps</span><h3>{coverageAreas.length - coveredAreas.length} areas are thin</h3><div className="mos-mini-tags">{coverageAreas.filter((area) => !coveredAreas.includes(area)).map((area) => <button key={area.name} onClick={() => openFactForm(area.name)}>{area.name} +</button>)}</div></article>
              <article className="mos-card" data-reveal><span className="mos-kicker">Sensitive context</span><h3>{claims.filter((claim) => claim.status === "restricted" || claim.sensitivity === "sensitive").length} protected facts</h3><p>These remain out of suggestions unless you deliberately change their permissions.</p></article>
            </section>
            <section className="mos-card" data-reveal>
              <div className="mos-card-head"><div><span className="mos-kicker">Verified evidence ledger</span><h3>What the extension can currently reference</h3></div><button className="mos-button light" onClick={() => goTo("fit")}>Check against a target</button></div>
              <div className="mos-ledger">
                {coverageAreas.map((area) => {
                  const areaClaims = verifiedClaims.filter((claim) => area.pattern.test(`${claim.category} ${claim.statement}`));
                  return <article key={area.name}><span className={areaClaims.length ? "ready" : ""}>{areaClaims.length ? "✓" : "—"}</span><div><strong>{area.name}</strong><small>{areaClaims.length ? `${areaClaims.length} supported fact${areaClaims.length === 1 ? "" : "s"}` : "No verified context"}</small></div>{!areaClaims.length && <button onClick={() => openFactForm(area.name)}>Add</button>}</article>;
                })}
              </div>
            </section>
          </div>
        )}

        {view === "autopilot" && (
          <div className="mos-page">
            <section className="mos-target-hero mos-autopilot-hero" data-reveal>
              <div><span className="mos-kicker">Application Autopilot</span><h2>One goal. A complete application queue.</h2><p>MeritOS searches public repositories, remote boards, startup discussions, and career feeds; ranks matches against your profile; and prepares several applications in one run.</p></div>
              <div className="mos-target-form">
                <textarea id="mos-autopilot-goal" value={opportunityQuery} onChange={(event) => setOpportunityQuery(event.target.value)} placeholder="Example: high-school computational biology internships for summer 2027, remote or near Phoenix" />
                <button className="mos-button dark large" disabled={!(opportunityQuery.trim() || fit?.target || target) || Boolean(busy)} onClick={() => void scanOpportunityBoards(false)}>{busy === "opportunity-watch" ? "Searching public feeds + the live web…" : "Find matching applications"}</button>
                <button className={opportunityAlerts ? "mos-button light active" : "mos-button light"} disabled={!opportunityQuery.trim()} onClick={() => void toggleOpportunityAlerts()}>{opportunityAlerts ? "Alerts on ✓" : "Alert me to new matches"}</button>
              </div>
            </section>

            <section className="mos-autopilot-runway" aria-label="Autopilot application progress" data-reveal>
              <header><div><span className="mos-kicker">Your application run</span><h3>Step {autopilotStageIndex + 1} of {autopilotStages.length}: {autopilotStages[autopilotStageIndex].label}</h3></div><span className="mos-runway-status">{applicationQueue.length ? `${applicationQueue.length} prepared` : opportunityResults.length ? `${opportunityResults.length} matches` : "Ready to start"}</span></header>
              <ol>
                {autopilotStages.map((stage, index) => <li key={stage.label} className={stage.complete ? "complete" : index === autopilotStageIndex ? "active" : ""}><span>{stage.complete ? "Done" : index + 1}</span><strong>{stage.label}</strong></li>)}
              </ol>
              <div className="mos-runway-next">
                <div><small>Next action</small><strong>{autopilotStages[autopilotStageIndex].label}</strong><p>{autopilotStageIndex === 0 ? "Describe the opportunity once; MeritOS handles the search plan." : autopilotStageIndex === 1 ? "Search current sources and choose the matches worth preparing." : autopilotStageIndex === 2 ? "Build grounded packets and surface only missing information." : "Open the prepared forms with the Chrome assistant and review before submission."}</p></div>
                {autopilotStageIndex === 0 && <button className="mos-button dark" onClick={() => document.getElementById("mos-autopilot-goal")?.focus()}>Describe my goal</button>}
                {autopilotStageIndex === 1 && <button className="mos-button dark" disabled={Boolean(busy)} onClick={() => void scanOpportunityBoards(false)}>Refresh matches</button>}
                {autopilotStageIndex === 2 && <button className="mos-button dark" disabled={!selectedOpportunityUrls.length || Boolean(busy)} onClick={() => void prepareSelectedApplications()}>Prepare selected</button>}
                {autopilotStageIndex === 3 && selectedApplicationIds.length > 0 && <button className="mos-button dark" onClick={handoffSelectedApplications}>Start selected in Chrome</button>}
                {autopilotStageIndex === 3 && selectedApplicationIds.length === 0 && applicationQueue.length > 0 && <button className="mos-button dark" onClick={() => setSelectedApplicationIds(applicationQueue.filter((item) => !["submitted", "withdrawn"].includes(item.application.status)).map((item) => item.application.id))}>Select prepared applications</button>}
              </div>
            </section>

            <section className="mos-metric-strip" data-reveal>
              <article><small>Search coverage</small><strong>12+</strong><span>public feeds, repositories, and official-web search</span></article>
              <article><small>Matches found</small><strong>{opportunityResults.length}</strong><span>ranked against your profile</span></article>
              <article><small>Prepared queue</small><strong>{applicationQueue.filter((item) => !["submitted", "withdrawn"].includes(item.application.status)).length}</strong><span>waiting for confirmation</span></article>
              <article><small>Batch handoff</small><strong>1 approval</strong><span>for every selected application</span></article>
            </section>

            <section className="mos-initiative-panel" data-reveal>
              <div><span className="mos-kicker">AI initiative level</span><h3>Choose how boldly MeritOS completes low-risk gaps.</h3><p>This changes inference behavior, never your underlying verified facts.</p></div>
              <div className="mos-mode-grid" role="radiogroup" aria-label="AI initiative level">
                <button className={initiativeMode === "careful" ? "active" : ""} onClick={() => changeInitiativeMode("careful")}><strong>Careful</strong><small>Verified evidence only</small></button>
                <button className={initiativeMode === "proactive" ? "active" : ""} onClick={() => changeInitiativeMode("proactive")}><strong>Proactive</strong><small>Draft reasonable fit and wording</small></button>
                <button className={initiativeMode === "high_initiative" ? "active" : ""} onClick={() => changeInitiativeMode("high_initiative")}><strong>High initiative</strong><small>Infer most low-risk answers; flag assumptions</small></button>
              </div>
              <p className="mos-fine-print">Never guessed: identity, credentials, grades, legal/work authorization, demographics, sensitive disclosures, consent, or final submission. It never silently presses Submit.</p>
            </section>

            <section className="mos-command-center" data-reveal>
              <div className="mos-command-intro"><span className="mos-kicker">Exception-first workflow</span><h2>MeritOS prepares the batch. You see only what needs judgment.</h2><p>Supported fields disappear into the ready count. The queue surfaces missing evidence, prohibited-AI policies, sensitive questions, account checks, and final confirmation instead of making you inspect every field.</p><div className="mos-command-guardrail"><strong>No repetitive intake.</strong><span>If your résumé, website, LinkedIn export, or prior verified answer contains it, MeritOS reuses it.</span></div></div>
              {applicationPacket ? <div className="mos-command-input"><span className="mos-pill success">Ready for confirmation</span><h3>{applicationPacket.title}</h3><p>{applicationPacket.organization} · {applicationPacket.answers.filter((answer) => answer.status === "draft").length} answers prepared</p><a className="mos-button dark large full" href={applicationPacket.sourceUrl} target="_blank" rel="noreferrer">Open prepared form for final review ↗</a><small className="mos-fine-print">The Chrome side panel completes supported fields on the external form and stops before Submit.</small></div> : <div className="mos-command-input"><strong>No prepared application yet</strong><p>Enter one search goal above. MeritOS will search, rank, preflight, and build the best packet in one run.</p></div>}
            </section>

            {opportunityResults.length > 0 && <section className="mos-opportunity-radar" data-reveal>
              <div className="mos-card-head"><div><span className="mos-kicker">Ranked live matches</span><h3>Select the applications MeritOS should prepare.</h3><p>The top five are selected by default. Nothing is submitted from this screen.</p></div><button className="mos-button dark" disabled={!selectedOpportunityUrls.length || Boolean(busy)} onClick={() => void prepareSelectedApplications()}>{busy === "application-batch" ? "Preparing batch…" : `Prepare ${selectedOpportunityUrls.length} selected`}</button></div>
              <div className="mos-radar-results">{opportunityResults.map((item, index) => <article className={selectedOpportunityUrls.includes(item.url) ? "selected" : ""} key={`${item.source}-${item.url}`}><label className="mos-result-check"><input type="checkbox" checked={selectedOpportunityUrls.includes(item.url)} onChange={(event) => setSelectedOpportunityUrls((current) => event.target.checked ? [...new Set([...current, item.url])].slice(0, 10) : current.filter((url) => url !== item.url))} /><span><small>#{index + 1} · {item.company} · {item.location}</small><strong>{item.title}</strong><span className={`mos-audience-fit ${item.audienceFit || "not_requested"}`}>{item.audienceFit === "confirmed" ? "Applicant level confirmed" : item.audienceFit === "unconfirmed" ? "Applicant level not stated — verify eligibility" : "Applicant level not filtered"}</span>{item.matchReasons?.length ? <span className="mos-match-reason">{item.matchReasons.slice(0, 2).join(" · ")}</span> : null}<em>{item.fitScore ? `${item.fitScore}% directional fit · ` : ""}{item.source}</em></span></label><div><button disabled={Boolean(busy)} onClick={() => void analyzeOpportunityPage(item.url)}>Prepare now</button><a href={item.url} target="_blank" rel="noreferrer">Source ↗</a></div></article>)}</div>
            </section>}

            {applicationQueue.length > 0 && <section className="mos-batch-queue" data-reveal>
              <header><div><span className="mos-kicker">Application command center</span><h2>Approve the ready batch—not every field.</h2><p>Select prepared applications, inspect only their exceptions, then hand the batch to the Chrome extension.</p></div><button className="mos-button dark large" disabled={!selectedApplicationIds.length} onClick={handoffSelectedApplications}>Start {selectedApplicationIds.length} in Chrome ↗</button></header>
              <div className="mos-batch-toolbar"><button onClick={() => setSelectedApplicationIds(applicationQueue.filter((item) => !["submitted", "withdrawn"].includes(item.application.status)).map((item) => item.application.id))}>Select all active</button><button onClick={() => setSelectedApplicationIds([])}>Clear</button><span>{selectedApplicationIds.length} selected</span></div>
              <div className="mos-batch-list">{applicationQueue.filter((item) => !["submitted", "withdrawn"].includes(item.application.status)).map((item) => {
                const preparation = item.preparation || { readiness: 0, supported: 0, requirementCount: 0, missing: 0, missingItems: [], requiredDocuments: [], visibleQuestions: 0, aiPolicy: "unknown" as const };
                return <article key={item.application.id} className={selectedApplicationIds.includes(item.application.id) ? "selected" : ""}>
                  <label><input type="checkbox" checked={selectedApplicationIds.includes(item.application.id)} onChange={(event) => setSelectedApplicationIds((current) => event.target.checked ? [...new Set([...current, item.application.id])] : current.filter((id) => id !== item.application.id))} /><span><strong>{item.opportunity.title}</strong><small>{item.opportunity.organization} · {item.application.status}</small></span></label>
                  <div className="mos-readiness-meter"><span style={{ width: `${preparation.readiness}%` }} /><b>{preparation.readiness}% requirements supported</b></div>
                  <div className="mos-queue-stats"><span>{preparation.supported}/{preparation.requirementCount || "?"} supported</span><span className={preparation.missing ? "warn" : "ready"}>{preparation.missing ? `${preparation.missing} exceptions` : "No known exceptions"}</span><span>{preparation.requiredDocuments.length} documents</span><span>AI policy: {preparation.aiPolicy}</span></div>
                  {preparation.missingItems.length > 0 && <details><summary>What MeritOS still needs</summary><ul>{preparation.missingItems.map((missing, index) => <li key={`${missing}-${index}`}>{missing}</li>)}</ul></details>}
                  <div className="mos-queue-actions"><button onClick={() => void buildApplicationPacket(item.opportunity.id)}>Open packet</button><a href={item.opportunity.url} target="_blank" rel="noreferrer">Official form ↗</a></div>
                </article>;
              })}</div>
            </section>}
          </div>
        )}

        {view === "fit" && (
          <div className="mos-page">
            <section className="mos-target-hero" data-reveal>
              <div><span className="mos-kicker">Target-aware profile scan</span><h2>What are you trying to apply for?</h2><p>Be specific: include the program, field, award type, or role. MeritOS compares only your verified profile and returns a preparation score—not fake acceptance odds.</p></div>
              <div className="mos-target-form">
                <textarea value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Example: undergraduate computational biology summer research programs focused on genomics and health equity" />
                <button className="mos-button dark large" disabled={!target.trim() || busy === "fit"} onClick={runFitAnalysis}>{busy === "fit" ? "Scanning profile…" : fit ? "Refresh my analysis" : "Analyze my fit"}</button>
              </div>
            </section>
            <section className="mos-command-center" data-reveal>
              <div className="mos-command-intro"><span className="mos-kicker">Separate jobs from strategy</span><h2>Target analysis improves your profile.</h2><p>Use this page for readiness, gaps, and positioning. The multi-source search and batch application queue now live in one dedicated Autopilot workspace.</p></div>
              <div className="mos-command-input"><strong>{applicationQueue.length} saved application{applicationQueue.length === 1 ? "" : "s"}</strong><p>Open Autopilot to search, prepare, select, and hand several forms to Chrome.</p><button className="mos-button dark large full" onClick={() => goTo("autopilot")}>Open Application Autopilot →</button></div>
              {preflight && (
                <div className="mos-preflight">
                  <header>
                    <div><span className="mos-pill success">Saved to application queue</span><h3>{preflight.title}</h3><p>{preflight.organization}{preflight.location ? ` · ${preflight.location}` : ""}</p></div>
                    <div className="mos-preflight-actions"><a className="mos-button light" href={opportunityUrl} target="_blank" rel="noreferrer">Open official form ↗</a><button className="mos-button dark" disabled={busy === "application-packet"} onClick={() => void buildApplicationPacket()}>{busy === "application-packet" ? "Building packet…" : "Rebuild packet"}</button></div>
                  </header>
                  <div className="mos-preflight-metrics">
                    <article><small>Deadline</small><strong>{preflight.deadlineText || "Not confirmed"}</strong></article>
                    <article><small>Requirements supported</small><strong>{preflight.requirements.filter((item) => item.status === "supported").length}/{preflight.requirements.length}</strong></article>
                    <article><small>Needs attention</small><strong>{preflight.requirements.filter((item) => item.status !== "supported").length}</strong></article>
                    <article><small>AI policy</small><strong>{preflight.aiPolicy.status}</strong></article>
                  </div>
                  <p className="mos-preflight-summary">{preflight.summary}</p>
                  <div className="mos-requirement-list">
                    {preflight.requirements.slice(0, 12).map((item, index) => <article key={`${item.requirement}-${index}`}><span className={`mos-requirement-status ${item.status}`}>{item.status}</span><div><strong>{item.requirement}</strong><small>{item.action}</small></div></article>)}
                  </div>
                  <div className="mos-preflight-foot"><span>{preflight.requiredDocuments.length} required document{preflight.requiredDocuments.length === 1 ? "" : "s"} detected</span><span>{preflight.applicationQuestions.length} visible application question{preflight.applicationQuestions.length === 1 ? "" : "s"} detected</span><span>{preflight.confidence}</span></div>
                </div>
              )}
              {applicationQueue.length > 0 && (
                <div className="mos-application-queue">
                  <div><span className="mos-kicker">Saved queue</span><h3>Your active applications</h3></div>
                  <div>{applicationQueue.filter((item) => !["submitted", "withdrawn"].includes(item.application.status)).slice(0, 5).map((item) => <a key={item.application.id} href={item.opportunity.url} target="_blank" rel="noreferrer"><span><strong>{item.opportunity.title}</strong><small>{item.opportunity.organization} · {item.application.status}</small></span><b>{item.opportunity.deadline ? new Date(item.opportunity.deadline).toLocaleDateString() : "No confirmed deadline"} ↗</b></a>)}</div>
                </div>
              )}
            </section>
            {fit ? (
              <>
                <section className="mos-fit-summary" data-reveal>
                  <ReadinessVisual value={fit.score} label={formatBand(fit.readinessBand)} />
                  <div className="mos-fit-copy">
                    <span className="mos-kicker">Directional target readiness</span>
                    <h2>{fit.target}</h2>
                    <p className="mos-positioning">{fit.positioning}</p>
                    <p>{fit.summary}</p>
                    <small>{fit.confidence}</small>
                  </div>
                </section>
                <section className="mos-grid two-one">
                  <article className="mos-card" data-reveal><span className="mos-kicker">Strongest evidence</span><h3>What already supports your case</h3><div className="mos-insight-list">{fit.strengths.map((strength) => <article key={`${strength.claimId}-${strength.title}`}><span>✓</span><div><strong>{strength.title}</strong><p>{strength.reason}</p></div></article>)}</div></article>
                  <article className="mos-card" data-reveal><span className="mos-kicker">Highest-value gaps</span><h3>What to improve next</h3><div className="mos-gap-list">{fit.gaps.map((gap) => <article key={gap.area}><span className={`mos-priority ${gap.priority}`}>{gap.priority}</span><strong>{gap.area}</strong><p>{gap.whyItMatters}</p><small>{gap.action}</small><button className="mos-gap-create" disabled={busy === `gap-${gap.area}`} onClick={() => buildGapArtifact(gap)}>{busy === `gap-${gap.area}` ? "Creating an honest starter…" : "Have MeritOS create a starter →"}</button></article>)}</div></article>
                </section>
                <section className="mos-grid equal">
                  <article className="mos-card" data-reveal><span className="mos-kicker">Missing personal context</span><h3>Questions only you can answer</h3><div className="mos-question-list">{fit.missingContextQuestions.map((question) => <button key={question} onClick={() => openFactForm("Motivation & goals", question)}><span>{question}</span><b>Add answer +</b></button>)}</div></article>
                  <article className="mos-card" data-reveal><span className="mos-kicker">Where to look</span><h3>Targeted opportunity searches</h3><div className="mos-search-leads">{fit.opportunitySearches.map((search) => <a key={search.query} href={`https://www.google.com/search?q=${encodeURIComponent(search.query)}`} target="_blank" rel="noreferrer"><span><strong>{search.label}</strong><small>{search.why}</small></span><b>Search ↗</b></a>)}</div><p className="mos-fine-print">Search leads are not availability claims. Confirm eligibility and deadlines on official program pages.</p></article>
                </section>
              </>
            ) : (
              <section className="mos-empty-state" data-reveal><img src="/meritos-mark-v2.png" alt="" /><h3>No target analysis yet.</h3><p>Enter one clear direction above. MeritOS will show strengths, missing evidence, context questions, story angles, and search leads.</p></section>
            )}
          </div>
        )}

        {view === "stories" && (
          <div className="mos-page">
            <section className="mos-page-intro mos-story-intro" data-reveal>
              <div><span className="mos-kicker">Built automatically from verified evidence</span><h2>Your story bank grows while you build your profile.</h2><p>When you verify experience, project, leadership, research, or community evidence, MeritOS automatically creates an editable Situation–Action–Result–Reflection draft. Use the controls only when you want another angle.</p></div>
              <div className="mos-story-generator">
                <div className="mos-story-control-grid">
                  <label><span>Story angle</span><select value={storyLens} onChange={(event) => setStoryLens(event.target.value)}>{lenses.map((lens) => <option key={lens}>{lens}</option>)}</select><small>Auto-select will not default to leadership.</small></label>
                  <label><span>Experience to use</span><select value={storyFocus} onChange={(event) => setStoryFocus(event.target.value)}>{storyFocusOptions.map((focus) => <option key={focus}>{focus}</option>)}</select><small>Target-analysis recommendations appear here.</small></label>
                  <label><span>Scaffold depth</span><select value={storyDepth} onChange={(event) => setStoryDepth(event.target.value)}>{storyDepths.map((depth) => <option key={depth}>{depth}</option>)}</select></label>
                </div>
                <button className="mos-button dark" disabled={busy === "story"} onClick={generateStory}>{busy === "story" ? "Building…" : "Generate grounded story"}</button>
              </div>
            </section>
            <section className="mos-story-guidance" data-reveal aria-label="How MeritOS selects a story angle">
              <article><b>01</b><div><strong>Target relevance</strong><p>What this program or role is actually asking you to demonstrate.</p></div></article>
              <article><b>02</b><div><strong>Evidence strength</strong><p>Specific actions, outcomes, dates, and metrics that you verified.</p></div></article>
              <article><b>03</b><div><strong>Story completeness</strong><p>Whether the experience supports situation, action, result, and reflection without guessing.</p></div></article>
            </section>
            {storyQuestions.length > 0 && <section className="mos-question-callout" data-reveal><strong>This story needs your context</strong>{storyQuestions.map((question) => <button key={question} onClick={() => openFactForm("Story context", question)}>{question}<span>Add answer +</span></button>)}</section>}
            <section className="mos-story-list">
              {stories.map((story) => (
                <article className="mos-story-card" key={story.id} data-reveal>
                  <div className="mos-story-top"><div><span className={`mos-pill ${story.status === "approved" ? "success" : ""}`}>{story.status}</span><input value={story.title} onChange={(event) => updateStory(story.id, "title", event.target.value)} /></div><small>{story.lens} · {story.sourceClaimIds.length} supporting facts</small></div>
                  <div className="mos-story-fields">
                    {(["situation", "action", "result", "reflection"] as const).map((field) => <label key={field}><span>{field}</span><textarea value={story[field]} onChange={(event) => updateStory(story.id, field, event.target.value)} /></label>)}
                  </div>
                  <div className="mos-story-actions"><button className="mos-button light" disabled={busy === `story-${story.id}`} onClick={() => saveStory(story, "draft")}>Save changes</button><button className="mos-button dark" onClick={() => saveStory(story, "approved")}>Approve for reuse</button></div>
                </article>
              ))}
              {!stories.length && <div className="mos-empty-state"><h3>No story-ready evidence yet.</h3><p>Verify an experience, project, leadership, research, or community fact and MeritOS will build the first grounded story automatically.</p></div>}
            </section>
          </div>
        )}

        {view === "interview" && (
          <div className="mos-page">
            <section className="mos-target-hero compact" data-reveal>
              <div><span className="mos-kicker">Evidence-defense practice</span><h2>Practice for the target you care about.</h2><p>MeritOS creates questions from your target and verified profile, then critiques your answer without inventing a better life story.</p></div>
              <div className="mos-target-form"><textarea value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Program, fellowship, grant, or role" /><button className="mos-button dark" disabled={!target.trim() || busy === "interview"} onClick={generateInterview}>{busy === "interview" ? "Preparing…" : interview ? "New question set" : "Start practice"}</button></div>
            </section>
            {interview && activeQuestion ? (
              <section className="mos-interview-layout">
                <aside className="mos-question-nav" data-reveal>
                  <span className="mos-kicker">{interview.questions.length} practice questions</span>
                  {interview.questions.map((question, index) => <button key={question.id} className={activeQuestion.id === question.id ? "active" : ""} onClick={() => { setActiveQuestionId(question.id); setPracticeAnswer(""); setFeedback(null); }}><b>{String(index + 1).padStart(2, "0")}</b><span>{question.question}</span></button>)}
                </aside>
                <article className="mos-practice-card" data-reveal>
                  <span className={`mos-pill ${activeQuestion.type}`}>{activeQuestion.type}</span>
                  <h2>{activeQuestion.question}</h2>
                  <p>{activeQuestion.whyItIsAsked}</p>
                  <div className="mos-answer-hints"><strong>A strong answer should include</strong>{activeQuestion.strongAnswerNeeds.map((item) => <span key={item}>• {item}</span>)}</div>
                  <label><span>Your practice answer</span><textarea value={practiceAnswer} onChange={(event) => setPracticeAnswer(event.target.value)} placeholder="Answer naturally. Specific beats polished." /></label>
                  <button className="mos-button dark large" disabled={!practiceAnswer.trim() || busy === "feedback"} onClick={evaluateAnswer}>{busy === "feedback" ? "Reviewing…" : "Get evidence-backed feedback"}</button>
                  {feedback && <div className="mos-feedback"><span className="mos-kicker">Coach feedback</span><h3>{feedback.summary}</h3><div className="mos-feedback-columns"><section><strong>Working</strong>{feedback.strengths.map((item) => <p key={item}>✓ {item}</p>)}</section><section><strong>Watch out</strong>{feedback.risks.map((item) => <p key={item}>△ {item}</p>)}</section></div><section><strong>Better outline</strong>{feedback.improvedOutline.map((item, index) => <p key={item}>{index + 1}. {item}</p>)}</section><blockquote>{feedback.followUpQuestion}</blockquote></div>}
                </article>
              </section>
            ) : (
              <section className="mos-empty-state" data-reveal><h3>No practice session yet.</h3><p>Set your target above to generate fit, behavioral, technical, and skeptical follow-up questions.</p></section>
            )}
          </div>
        )}

        {view === "extension" && (
          <div className="mos-page">
            <section className="mos-extension-hero" data-reveal>
              <div><span className="mos-kicker">Accuracy validation</span><h2>Prove your profile works before trusting it on a real application.</h2><p>Connect the extension, open the controlled testing lab, and check factual fields, complex controls, and safety boundaries. A wrong answer is a failed test—not something to quietly submit.</p><div className="mos-action-row"><a className="mos-button pale large" href="/MeritOS-Chrome-Extension.zip">Download extension</a><a className="mos-button text-inverse" href="/test-form" target="_blank">Open testing lab →</a></div></div>
              <img src="/meritos-mark-v2.png" alt="" />
            </section>
            <section className="mos-install-grid">
              <article data-reveal><b>01</b><strong>Download and unzip</strong><p>Download the MeritOS ZIP and choose Extract all.</p></article>
              <article data-reveal><b>02</b><strong>Load it in Chrome</strong><p>At chrome://extensions, enable Developer mode and choose Load unpacked.</p></article>
              <article data-reveal><b>03</b><strong>Connect your profile</strong><p>Press Connect Chrome once. The same verified profile should remain available across tabs.</p></article>
              <article data-reveal><b>04</b><strong>Run the safe test</strong><p>Open the testing lab and compare every suggested answer with your approved profile facts.</p></article>
            </section>
            <section className="mos-card mos-key-card" data-reveal>
              <div><span className="mos-kicker">Private connection</span><h3>Connect this profile to Chrome</h3><p>One click connects every MeritOS side panel in this Chrome profile. Creating a replacement revokes the previous key.</p></div>
              <div>{extensionToken ? <code>{extensionToken}</code> : <span className="mos-key-placeholder">Not connected from this session yet</span>}<button className="mos-button dark" disabled={busy === "extension"} onClick={createExtensionConnection}>{busy === "extension" ? "Connecting…" : extensionToken ? "Reconnect Chrome" : "Connect Chrome"}</button></div>
            </section>
            <section className="mos-validation-suite" data-reveal>
              <header><div><span className="mos-kicker">Three tests decide whether it is useful</span><h2>Pass these before using MeritOS on a real form.</h2></div><button className="mos-button light" onClick={copyValidationTemplate}>Copy test report</button></header>
              <div>
                <article><b>A</b><span><strong>Factual accuracy</strong><p>Name, your email, phone, school, education level, graduation date, and profile link should match your verified profile exactly.</p></span></article>
                <article><b>B</b><span><strong>Form coverage</strong><p>Date pickers, radio buttons, button-style choices, selects, checkboxes, numbers, short answers, and long answers must all be detected.</p></span></article>
                <article><b>C</b><span><strong>Trust boundaries</strong><p>Recommender contact, consent, unsupported motivation, file uploads, and final Submit must remain yours unless truthful evidence explicitly supports an answer.</p></span></article>
              </div>
              <footer><div><strong>Testing order</strong><span>Internship → Research → Scholarship. Stop and report the first wrong answer; one confident false answer matters more than ten correct easy fields.</span></div><a className="mos-button dark large" href="/test-form" target="_blank">Start Test A →</a></footer>
            </section>
            <section className="mos-safety-grid" data-reveal>
              <article><strong>It reads the visible form</strong><p>DOM and accessibility labels first—not hidden browser history.</p></article>
              <article><strong>Inferences stay visible</strong><p>Low-risk guesses show their confidence and assumptions before you approve them.</p></article>
              <article><strong>It never submits</strong><p>The final submission action always remains yours.</p></article>
            </section>
          </div>
        )}
      </section>

      {showImport && renderImportModal()}
      {showContextImport && renderContextImportModal()}
      {applicationPacket && (
        <div className="mos-modal-backdrop" onMouseDown={() => setApplicationPacket(null)}>
          <section className="mos-modal mos-packet-modal" role="dialog" aria-modal="true" aria-labelledby="packet-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="mos-modal-close" onClick={() => setApplicationPacket(null)} aria-label="Close">×</button>
            <span className="mos-kicker">Review before it reaches the form</span><h2 id="packet-title">{applicationPacket.title} packet</h2>
            <p>{applicationPacket.organization} · {applicationPacket.deadlineText || "deadline not confirmed"}</p>
            <div className="mos-packet-summary"><article><strong>{applicationPacket.requiredDocuments.length}</strong><span>documents detected</span></article><article><strong>{applicationPacket.answers.filter((answer) => answer.status === "draft").length}</strong><span>supported drafts</span></article><article><strong>{applicationPacket.missingInputs.length}</strong><span>answers need you</span></article></div>
            <section className="mos-packet-documents"><strong>Document checklist</strong>{applicationPacket.requiredDocuments.length ? applicationPacket.requiredDocuments.map((item) => <label key={item}><input type="checkbox" /> <span>{item}</span></label>) : <p>No documents were explicitly detected. Confirm on the official page.</p>}</section>
            <section className="mos-packet-answers">
              <strong>Detected application questions</strong>
              {applicationPacket.answers.length ? applicationPacket.answers.map((answer, index) => <article key={`${answer.question}-${index}`}><span className={`mos-requirement-status ${answer.status === "draft" ? "supported" : "unclear"}`}>{answer.status === "draft" ? "supported draft" : "needs you"}</span><h3>{answer.question}</h3>{answer.status === "draft" ? <textarea value={answer.draft} onChange={(event) => setApplicationPacket((current) => current ? { ...current, answers: current.answers.map((item, itemIndex) => itemIndex === index ? { ...item, draft: event.target.value } : item) } : current)} /> : <div className="mos-packet-question"><p>{answer.questions.join(" ")}</p><button onClick={() => { setApplicationPacket(null); openFactForm("Motivation & goals", answer.questions[0] || answer.question); }}>Add truthful context →</button></div>}<small>{answer.usedEvidenceIds.length ? `${answer.usedEvidenceIds.length} verified fact${answer.usedEvidenceIds.length === 1 ? "" : "s"} used` : "No profile evidence used"}</small></article>) : <p>No application prompts were visible on the public page. Open the live form with the extension to scan its fields.</p>}
            </section>
            <p className="mos-command-guardrail"><strong>Final approval stays yours.</strong><span>{applicationPacket.safetyNote}</span></p>
            <div className="mos-artifact-actions"><button className="mos-button light" onClick={downloadApplicationPacket}>Download packet</button><a className="mos-button dark" href={applicationPacket.sourceUrl} target="_blank" rel="noreferrer">Open form with MeritOS ↗</a></div>
          </section>
        </div>
      )}
      {gapArtifact && (
        <div className="mos-modal-backdrop" onMouseDown={() => setGapArtifact(null)}>
          <section className="mos-modal mos-artifact-modal" role="dialog" aria-modal="true" aria-labelledby="artifact-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="mos-modal-close" onClick={() => setGapArtifact(null)} aria-label="Close">×</button>
            <span className="mos-kicker">Evidence-bound starter</span><h2 id="artifact-title">{gapArtifact.title}</h2><p>{gapArtifact.purpose}</p>
            {gapArtifact.missingFields.length > 0 && <section className="mos-artifact-inputs"><strong>Finish the highlighted parts</strong>{gapArtifact.missingFields.map((field) => <label key={field.key}><span>{field.label}</span><small>{field.prompt}</small><input value={gapArtifactValues[field.key] || ""} onChange={(event) => setGapArtifactValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder="Needs your truthful input" /></label>)}</section>}
            <pre className="mos-artifact-preview">{completedArtifact()}</pre>
            <p className="mos-fine-print">Generated from verified context. Unfilled placeholders stay visibly marked, and saving adds a draft—not a verified fact.</p>
            <div className="mos-artifact-actions"><button className="mos-button light" onClick={downloadGapArtifact}>Download .md</button><button className="mos-button light" disabled={busy === "save-artifact"} onClick={addArtifactAsContext}>Add as draft context</button><button className="mos-button dark" disabled={busy === "save-artifact"} onClick={() => { downloadGapArtifact(); void addArtifactAsContext(); }}>{busy === "save-artifact" ? "Adding…" : "Download + add draft"}</button></div>
          </section>
        </div>
      )}
      {showFactForm && (
        <div className="mos-modal-backdrop" onMouseDown={() => setShowFactForm(false)}>
          <section className="mos-modal" role="dialog" aria-modal="true" aria-labelledby="fact-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="mos-modal-close" onClick={() => setShowFactForm(false)} aria-label="Close">×</button>
            <span className="mos-kicker">Applicant-confirmed context</span><h2 id="fact-title">Add something MeritOS should know</h2>
            {factPrompt && <blockquote>{factPrompt}</blockquote>}
            <label>Context area<select value={factCategory} onChange={(event) => setFactCategory(event.target.value)}>{[...coverageAreas.map((area) => area.name), "Research", "Professional experience", "Reference context", "Story context", "Other"].map((category) => <option key={category}>{category}</option>)}</select></label>
            <label>Your truthful answer<textarea autoFocus value={factStatement} onChange={(event) => setFactStatement(event.target.value)} placeholder="Write this in your own words. Include exact dates, outcomes, or motivation when relevant." /></label>
            <p className="mos-fine-print">You are marking this as applicant-confirmed. MeritOS may use it for matching questions, drafting, and interview practice.</p>
            <button className="mos-button dark large full" disabled={!factStatement.trim() || busy === "fact"} onClick={saveFact}>{busy === "fact" ? "Saving…" : "Save as verified context"}</button>
          </section>
        </div>
      )}
      <div className={toast ? "mos-toast visible" : "mos-toast"} role="status">{toast}</div>
    </main>
  );

  function renderImportModal() {
    return (
      <div className="mos-modal-backdrop" onMouseDown={closeImport}>
        <section className="mos-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="mos-modal-close" onClick={closeImport} aria-label="Close">×</button>
          <span className="mos-kicker">Evidence import</span><h2 id="import-title">Add a document to your profile</h2>
          <p>MeritOS groups related résumé bullets into candidate facts. Nothing becomes reusable until you verify it.</p>
          {(importStage === "idle" || importStage === "error") && (
            <label className="mos-drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
              <input type="file" accept=".pdf,.docx,.txt" onChange={(event) => chooseFile(event.target.files?.[0])} />
              <img src="/meritos-mark-v2.png" alt="" /><strong>Choose a PDF, DOCX, or TXT</strong><small>or drop it here · 12 MB maximum</small>
            </label>
          )}
          {importStage === "selected" && selectedFile && <div className="mos-selected-file"><span>DOC</span><div><strong>{selectedFile.name}</strong><small>{Math.max(1, Math.round(selectedFile.size / 1024))} KB · ready</small></div><button className="mos-button dark" onClick={importDocument}>Extract facts</button></div>}
          {importStage === "uploading" && <div className="mos-importing"><img src="/meritos-mark-v2.png" alt="" /><h3>Reading structure and grouping evidence…</h3><div><span /></div></div>}
          {importStage === "done" && <div className="mos-import-done"><strong>Import complete</strong><p>{importMessage}</p><button className="mos-button dark" onClick={() => { closeImport(); goTo("review"); }}>Review extracted facts</button></div>}
          {importStage === "error" && <ErrorMessage message={importMessage} />}
        </section>
      </div>
    );
  }

  function renderContextImportModal() {
    return (
      <div className="mos-modal-backdrop" onMouseDown={() => setShowContextImport(false)}>
        <section className="mos-modal" role="dialog" aria-modal="true" aria-labelledby="context-import-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="mos-modal-close" onClick={() => setShowContextImport(false)} aria-label="Close">×</button>
          <span className="mos-kicker">Profile source</span><h2 id="context-import-title">Import a website or LinkedIn profile</h2>
          <p>Public personal websites can be read directly. LinkedIn blocks dependable public imports, so paste your About and Experience text or upload its PDF export.</p>
          <label>Profile URL<input value={contextUrl} onChange={(event) => setContextUrl(event.target.value)} placeholder="https://yourname.com or https://linkedin.com/in/…" /></label>
          <label>Optional profile text<textarea value={contextText} onChange={(event) => setContextText(event.target.value)} placeholder="Paste LinkedIn About, Experience, Projects, or other public profile text here." /></label>
          <p className="mos-fine-print">Imported items remain drafts until you review and verify them. MeritOS will not sign in to LinkedIn or bypass access controls.</p>
          <button className="mos-button dark large full" disabled={!contextUrl.trim() || busy === "context-url"} onClick={importContextSource}>{busy === "context-url" ? "Reading source…" : "Import draft facts"}</button>
        </section>
      </div>
    );
  }
}
