"use client";
/* eslint-disable @next/next/no-img-element */

import { DragEvent, useEffect, useMemo, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

type View = "overview" | "profile" | "review" | "fit" | "stories" | "interview" | "extension";
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

const navigation: Array<{ id: View; label: string; index: string }> = [
  { id: "overview", label: "Home", index: "00" },
  { id: "profile", label: "Build profile", index: "01" },
  { id: "review", label: "Review profile", index: "02" },
  { id: "fit", label: "Target & opportunities", index: "03" },
  { id: "stories", label: "Story bank", index: "04" },
  { id: "interview", label: "Interview practice", index: "05" },
  { id: "extension", label: "Chrome extension", index: "06" },
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
  const [accountLoading, setAccountLoading] = useState(true);
  const [profile, setProfile] = useState<Profile>({ displayName: "", headline: "", onboardingComplete: false });
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
    ])
      .then(async (responses) => {
        if (responses.some((response) => !response.ok)) throw new Error("Your workspace could not be loaded.");
        const [profileData, claimsData, fitData, storiesData, interviewData] =
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
        setTarget(fitData.analysis?.target || interviewData.session?.target || "");
        setActiveQuestionId(interviewData.session?.questions?.[0]?.id || "");
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Your workspace could not be loaded."))
      .finally(() => !cancelled && setAccountLoading(false));
    return () => { cancelled = true; };
  }, [isSignedIn, user?.fullName]);

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
      const data = await readJson(await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, onboardingComplete: true }),
      }));
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
      announce(status === "verified" ? "Fact verified and available to MeritOS." : "Fact moved out of automatic use.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The fact could not be updated.");
    } finally {
      setBusy("");
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
      await navigator.clipboard?.writeText(data.token);
      announce("New connection key copied.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Connection key could not be created.");
    } finally {
      setBusy("");
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
              MeritOS turns your résumé and personal context into verified facts, helps you strengthen
              your fit, then fills legitimate application forms through a Chrome side panel you control.
            </p>
            <div className="mos-action-row">
              <SignUpButton mode="modal"><button className="mos-button dark large">Build my profile</button></SignUpButton>
              <a className="mos-button light large" href="/install">Get the extension</a>
            </div>
            <div className="mos-trust-row">
              <span>Evidence linked</span><span>User approved</span><span>Never auto-submitted</span>
            </div>
          </div>
          <div className="mos-landing-visual" data-reveal>
            <div className="mos-profile-stack">
              <article><small>VERIFIED PROFILE</small><strong>Research experience</strong><span>Résumé · approved by you</span></article>
              <article><small>LIVE FORM</small><strong>Suggested answer</strong><span>2 supporting facts · review first</span></article>
              <article><small>TARGET FIT</small><strong>Evidence gap found</strong><span>Add outcome + motivation</span></article>
            </div>
            <img src="/meritos-mark-v2.png" alt="" />
          </div>
        </section>
        <section className="mos-flow" id="how-it-works" aria-label="How MeritOS works">
          <article><b>01</b><strong>Build your profile</strong><p>Upload documents and add context a résumé cannot capture.</p></article>
          <article><b>02</b><strong>Verify every fact</strong><p>Control what is true, sensitive, or safe to reuse.</p></article>
          <article><b>03</b><strong>Strengthen your fit</strong><p>Choose a target and get specific evidence gaps and next actions.</p></article>
          <article><b>04</b><strong>Use it on real forms</strong><p>Approve answers in Chrome. MeritOS never presses submit.</p></article>
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
            <article><b>02</b><span><strong>Target scan</strong><small>Compare your verified profile with one specific direction.</small></span></article>
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
            <div className="mos-action-row"><button className="mos-button light" onClick={() => openFactForm("Links & profiles", "Paste your LinkedIn, GitHub, portfolio, or personal website URL. Add a short note describing what it contains.")}>Add a link</button><button className="mos-button light" onClick={() => openFactForm("Contact details")}>Add contact</button></div>
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
            disabled={!profile.displayName.trim() || verifiedClaims.length === 0 || busy === "onboarding"}
            onClick={finishOnboarding}
          >
            {busy === "onboarding" ? "Saving…" : "Finish profile setup"}
          </button>
          {verifiedClaims.length === 0 && <small className="mos-helper">Verify at least one real fact to continue.</small>}
        </section>
        {showImport && renderImportModal()}
      </main>
    );
  }

  const pageTitle = navigation.find((item) => item.id === view)?.label || "Home";

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
                <span className="mos-pill inverse">{fit ? "Target-aware workspace" : "Verified profile workspace"}</span>
                <h2>{fit ? `Build a stronger case for ${fit.target}.` : "Build the context MeritOS needs to answer well."}</h2>
                <p>{fit?.summary || "Add your evidence, motivations, goals, and real outcomes once. MeritOS will use only approved facts when it helps on external forms."}</p>
                <div className="mos-action-row">
                  <button className="mos-button pale" onClick={() => goTo(fit ? "fit" : "profile")}>{fit ? "Open target analysis" : "Continue my profile"}</button>
                  <button className="mos-button text-inverse" onClick={() => goTo("extension")}>Use on a real form →</button>
                </div>
              </div>
              <ReadinessVisual value={readinessValue} label={fit ? formatBand(fit.readinessBand) : "profile coverage"} />
            </section>

            <section className="mos-metric-strip" data-reveal>
              <article><small>Verified facts</small><strong>{verifiedClaims.length}</strong><span>safe for supported answers</span></article>
              <article><small>Needs your review</small><strong>{reviewClaims.length}</strong><span>excluded from autofill</span></article>
              <article><small>Context coverage</small><strong>{coveredAreas.length}/{coverageAreas.length}</strong><span>areas represented</span></article>
              <article><small>Reusable stories</small><strong>{stories.length}</strong><span>{stories.filter((story) => story.status === "approved").length} approved</span></article>
            </section>

            <section className="mos-grid two-one">
              <article className="mos-card" data-reveal>
                <div className="mos-card-head"><div><span className="mos-kicker">Next best actions</span><h3>Make MeritOS more accurate</h3></div></div>
                <div className="mos-action-list">
                  {reviewClaims.length > 0 && <button onClick={() => goTo("review")}><b>01</b><span><strong>Review {reviewClaims.length} extracted facts</strong><small>Unverified information cannot enter forms.</small></span><i>→</i></button>}
                  {coverageAreas.length < coverageAreas.length && <button onClick={() => openFactForm(coverageAreas.find((area) => !coveredAreas.includes(area))?.name)}><b>02</b><span><strong>Fill a missing context area</strong><small>Your résumé does not explain everything that matters.</small></span><i>→</i></button>}
                  <button onClick={() => goTo("fit")}><b>03</b><span><strong>{fit ? "Refresh target fit" : "Tell MeritOS what you are targeting"}</strong><small>Turn your profile into a specific improvement plan.</small></span><i>→</i></button>
                  <button onClick={() => goTo("extension")}><b>04</b><span><strong>Install or reconnect the Chrome side panel</strong><small>Use approved profile facts on legitimate external forms.</small></span><i>→</i></button>
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
              <div><span className="mos-kicker">External forms only</span><h3>MeritOS works beside the website where you are actually applying.</h3><p>The extension scans visible fields, shows evidence-backed suggestions, lets you approve them together, and never submits.</p></div>
              <button className="mos-button dark" onClick={() => goTo("extension")}>Set up extension</button>
            </section>
          </div>
        )}

        {view === "profile" && (
          <div className="mos-page">
            <section className="mos-page-intro" data-reveal>
              <div><span className="mos-kicker">Your source of truth</span><h2>Build the fullest truthful picture of you.</h2><p>Documents provide evidence. Direct context captures goals, motivations, preferences, and details that never make it onto a résumé.</p></div>
              <div className="mos-action-row"><button className="mos-button light" onClick={() => openFactForm("Links & profiles", "Paste your LinkedIn, GitHub, portfolio, or personal website URL. Add a short note describing what it contains.")}>Add link</button><button className="mos-button light" onClick={() => openFactForm()}>Add context</button><button className="mos-button dark" onClick={() => setShowImport(true)}>Upload document</button></div>
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
                    <div><small>{claim.category} · {evidenceSource(claim.evidence)}</small><strong>{claim.statement}</strong><p>{claim.status === "verified" ? "Available for supported answers" : claim.status === "restricted" ? "Sensitive and excluded unless you approve it" : "Excluded until you verify it"}</p></div>
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

        {view === "fit" && (
          <div className="mos-page">
            <section className="mos-target-hero" data-reveal>
              <div><span className="mos-kicker">Target-aware profile scan</span><h2>What are you trying to apply for?</h2><p>Be specific: include the program, field, award type, or role. MeritOS compares only your verified profile and returns a preparation score—not fake acceptance odds.</p></div>
              <div className="mos-target-form">
                <textarea value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Example: undergraduate computational biology summer research programs focused on genomics and health equity" />
                <button className="mos-button dark large" disabled={!target.trim() || busy === "fit"} onClick={runFitAnalysis}>{busy === "fit" ? "Scanning profile…" : fit ? "Refresh my analysis" : "Analyze my fit"}</button>
              </div>
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
                  <article className="mos-card" data-reveal><span className="mos-kicker">Highest-value gaps</span><h3>What to improve next</h3><div className="mos-gap-list">{fit.gaps.map((gap) => <article key={gap.area}><span className={`mos-priority ${gap.priority}`}>{gap.priority}</span><strong>{gap.area}</strong><p>{gap.whyItMatters}</p><small>{gap.action}</small></article>)}</div></article>
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
            <section className="mos-page-intro" data-reveal>
              <div><span className="mos-kicker">Reusable truth, not canned essays</span><h2>Choose the strongest story for the application—not the loudest title.</h2><p>Story Studio compares your target, selected experience, and verified evidence before creating an editable Situation–Action–Result–Reflection scaffold.</p></div>
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
              {!stories.length && <div className="mos-empty-state"><h3>Your story bank is empty.</h3><p>Choose a lens and generate a scaffold. MeritOS will never fill missing outcomes with guesses.</p></div>}
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
              <div><span className="mos-kicker">The actual application workflow</span><h2>Your profile lives here. Autofill happens on the external form.</h2><p>Install the Chrome extension, connect it once, then open a legitimate grant, scholarship, program, or job form. MeritOS detects fields and opens beside the page.</p><div className="mos-action-row"><a className="mos-button pale large" href="/MeritOS-Chrome-Extension.zip">Download extension</a><a className="mos-button text-inverse" href="/test-form" target="_blank">Open form testing lab →</a></div></div>
              <img src="/meritos-mark-v2.png" alt="" />
            </section>
            <section className="mos-install-grid">
              <article data-reveal><b>01</b><strong>Download and unzip</strong><p>Download the MeritOS ZIP and choose Extract all.</p></article>
              <article data-reveal><b>02</b><strong>Load it in Chrome</strong><p>At chrome://extensions, enable Developer mode and choose Load unpacked.</p></article>
              <article data-reveal><b>03</b><strong>Connect your profile</strong><p>Create a one-time key below and paste it into the side panel.</p></article>
              <article data-reveal><b>04</b><strong>Open a real form</strong><p>Approve supported suggestions together. Review narratives one by one.</p></article>
            </section>
            <section className="mos-card mos-key-card" data-reveal>
              <div><span className="mos-kicker">Private connection</span><h3>Connect this profile to Chrome</h3><p>Creating a new key revokes the previous key. MeritOS shows it only once.</p></div>
              <div>{extensionToken ? <code>{extensionToken}</code> : <span className="mos-key-placeholder">No new key shown</span>}<button className="mos-button dark" disabled={busy === "extension"} onClick={createExtensionConnection}>{busy === "extension" ? "Creating…" : extensionToken ? "Replace connection key" : "Create connection key"}</button></div>
            </section>
            <section className="mos-safety-grid" data-reveal>
              <article><strong>It reads the visible form</strong><p>DOM and accessibility labels first—not hidden browser history.</p></article>
              <article><strong>You approve suggestions</strong><p>Verified factual fields can be reviewed together; narratives stay individual.</p></article>
              <article><strong>It never submits</strong><p>The final submission action always remains yours.</p></article>
            </section>
          </div>
        )}
      </section>

      {showImport && renderImportModal()}
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
}
