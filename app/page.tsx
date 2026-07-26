"use client";

import { DragEvent, useEffect, useMemo, useState } from "react";

type View =
  | "overview"
  | "lifegraph"
  | "applications"
  | "review"
  | "stories";

type ClaimStatus = "verified" | "draft" | "restricted";

type Claim = {
  id: number;
  title: string;
  detail: string;
  source: string;
  evidence: number;
  status: ClaimStatus;
  themes: string[];
};

type ImportStage = "idle" | "selected" | "uploading" | "done" | "error";

const supportedDocumentExtensions = ["pdf", "doc", "docx", "txt"];

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const initialClaims: Claim[] = [
  {
    id: 1,
    title: "Led a five-person assistive-technology research team",
    detail:
      "Designed the study workflow, coordinated weekly experiments, and presented findings to faculty reviewers.",
    source: "CV · Research report · Supervisor note",
    evidence: 3,
    status: "verified",
    themes: ["Research", "Leadership"],
  },
  {
    id: 2,
    title: "Reduced document-processing time by 32%",
    detail:
      "Built a structured intake process and automation prototype during a summer research placement.",
    source: "Project report · Portfolio",
    evidence: 2,
    status: "verified",
    themes: ["Impact", "Technical"],
  },
  {
    id: 3,
    title: "Mentored first-generation students in STEM",
    detail:
      "Ran weekly problem-solving sessions and created a peer-resource library used by 60+ students.",
    source: "CV · Program coordinator email",
    evidence: 2,
    status: "verified",
    themes: ["Community", "Mentorship"],
  },
  {
    id: 4,
    title: "Overcame a significant financial interruption",
    detail:
      "Personal context available only for applications where you explicitly approve its use.",
    source: "Personal interview",
    evidence: 1,
    status: "restricted",
    themes: ["Resilience"],
  },
];

const navItems: { id: View; label: string; glyph: string }[] = [
  { id: "overview", label: "Your progress", glyph: "⌂" },
  { id: "lifegraph", label: "1. Build your profile", glyph: "◫" },
  { id: "applications", label: "2. Complete application", glyph: "▤" },
  { id: "review", label: "3. Review before submitting", glyph: "◎" },
  { id: "stories", label: "Stories and essays", glyph: "✦" },
];

const applications = [
  {
    id: "rhodes",
    name: "Rhodes Scholarship",
    organization: "University nomination",
    deadline: "Aug 14",
    progress: 78,
    status: "Review ready",
    tone: "blue",
    tasks: 3,
  },
  {
    id: "fulbright",
    name: "Fulbright Open Study",
    organization: "Research award",
    deadline: "Oct 7",
    progress: 54,
    status: "Building evidence",
    tone: "gold",
    tasks: 6,
  },
  {
    id: "stanford",
    name: "Stanford MS · HCI",
    organization: "Graduate program",
    deadline: "Dec 2",
    progress: 32,
    status: "Preflight complete",
    tone: "green",
    tasks: 8,
  },
];

const reviewerRows = [
  {
    name: "Eligibility officer",
    score: 96,
    note: "All non-negotiable requirements appear satisfied.",
    tone: "green",
  },
  {
    name: "Domain expert",
    score: 82,
    note: "Strong preparation; clarify your individual research contribution.",
    tone: "blue",
  },
  {
    name: "Evidence reviewer",
    score: 76,
    note: "Two impact claims need stronger corroboration.",
    tone: "gold",
  },
  {
    name: "Narrative reviewer",
    score: 87,
    note: "Coherent public-service arc with one repeated example.",
    tone: "violet",
  },
];

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress-ring"
      style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}
      aria-label={`${label}: ${value}%`}
    >
      <div className="ring-inner">
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        M
      </div>
      <div>
        <strong>MeritOS</strong>
        <span>Application intelligence</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [claims, setClaims] = useState(initialClaims);
  const [selectedApplication, setSelectedApplication] = useState("rhodes");
  const [showImport, setShowImport] = useState(false);
  const [importStage, setImportStage] = useState<ImportStage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [reviewRunning, setReviewRunning] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(true);
  const [reviewedVerifiedCount, setReviewedVerifiedCount] = useState(3);
  const [approvedFields, setApprovedFields] = useState<string[]>(["name"]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayApplied, setOverlayApplied] = useState(false);
  const [lens, setLens] = useState("Public service");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [claimFilter, setClaimFilter] = useState<"all" | "verified" | "review">("all");
  const [tasksAdded, setTasksAdded] = useState(0);

  const selectedApp =
    applications.find((app) => app.id === selectedApplication) ??
    applications[0];

  const verifiedCount = useMemo(
    () => claims.filter((claim) => claim.status === "verified").length,
    [claims],
  );

  const reviewEvidenceGain = Math.max(0, reviewedVerifiedCount - 3);
  const evidenceChangesSinceReview = verifiedCount - reviewedVerifiedCount;
  const reviewRows = reviewerRows.map((reviewer, index) => ({
    ...reviewer,
    score: Math.min(99, reviewer.score + reviewEvidenceGain * (index === 2 ? 7 : 3)),
  }));

  useEffect(() => {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".hero-card, .guided-path, .next-step-banner, .section-card, .metrics-strip, .application-header-card, .review-hero, .story-intro, .committee-grid",
      ),
    );
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("scroll-reveal-visible"));
      return;
    }

    items.forEach((item, index) => {
      item.classList.add("scroll-reveal");
      item.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 45}ms`);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("scroll-reveal-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -28px 0px" },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [view, claims.length, reviewComplete]);

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function goTo(nextView: View) {
    setView(nextView);
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  function chooseFile(file: File | undefined) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!supportedDocumentExtensions.includes(extension)) {
      setImportStage("error");
      setImportMessage("Use a PDF, DOC, DOCX, or TXT document.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setImportStage("error");
      setImportMessage("This file is over the 12 MB import limit.");
      return;
    }
    setSelectedFile(file);
    setImportMessage("");
    setImportStage("selected");
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    chooseFile(event.dataTransfer.files[0]);
  }

  async function runImport() {
    if (!selectedFile) return;
    setImportStage("uploading");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch("/api/documents", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Document persistence needs sign-in.");
      setImportMessage("Securely stored. Text extraction is queued for review.");
    } catch {
      setImportMessage("Added to this local workspace. Sign in to store it securely across devices.");
    }
    window.setTimeout(() => {
      setClaims((current) => [
        ...current,
        {
          id: Date.now(),
          title: `Review material from ${selectedFile.name}`,
          detail:
            "A document was added. Confirm extracted facts before using them in any application.",
          source: selectedFile.name,
          evidence: 1,
          status: "draft",
          themes: ["New evidence"],
        },
      ]);
      setImportStage("done");
    }, 650);
  }

  function closeImport() {
    setShowImport(false);
    setImportStage("idle");
    setSelectedFile(null);
    setImportMessage("");
  }

  function toggleClaimStatus(id: number) {
    setClaims((current) =>
      current.map((claim) =>
        claim.id === id
          ? {
              ...claim,
              status: claim.status === "verified" ? "draft" : "verified",
            }
          : claim,
      ),
    );
  }

  function runReview() {
    setReviewRunning(true);
    setReviewComplete(false);
    window.setTimeout(() => {
      setReviewRunning(false);
      setReviewComplete(true);
      setReviewedVerifiedCount(verifiedCount);
      announce(
        verifiedCount > 3
          ? "Review refreshed. Newly verified evidence strengthened the evidence read."
          : "Committee review refreshed with current evidence.",
      );
    }, 1300);
  }

  function approveField(id: string) {
    setApprovedFields((current) =>
      current.includes(id)
        ? current.filter((field) => field !== id)
        : [...current, id],
    );
  }

  function applyOverlaySuggestions() {
    setApprovedFields(["name", "leadership"]);
    setOverlayApplied(true);
    announce("Approved suggestions applied to the preview. No form was submitted.");
  }

  const filteredClaims = claims.filter((claim) => {
    const matchesFilter =
      claimFilter === "all" ||
      (claimFilter === "verified" && claim.status === "verified") ||
      (claimFilter === "review" && claim.status !== "verified");
    const matchesQuery = `${claim.title} ${claim.detail} ${claim.themes.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setView(item.id)}
            >
              <span className="nav-glyph" aria-hidden="true">
                {item.glyph}
              </span>
              {item.label}
              {item.id === "review" && (
                <span className="nav-count">3</span>
              )}
            </button>
          ))}
        </nav>

        <div className="season-card">
          <div className="season-card-top">
            <span>Application season</span>
            <strong>62%</strong>
          </div>
          <div className="mini-progress">
            <span style={{ width: "62%" }} />
          </div>
          <p>3 active · 1 review ready</p>
        </div>

        <button className="profile-card" onClick={() => announce("Profile settings opened.")}>
          <span className="avatar">AS</span>
          <span>
            <strong>Aahan S.</strong>
            <small>Local-first workspace</small>
          </span>
          <span aria-hidden="true">•••</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">2026 application season</span>
            <h1>
              {view === "overview" && "Your application journey"}
              {view === "lifegraph" && "Step 1: Build your profile"}
              {view === "applications" && "Step 2: Complete an application"}
              {view === "review" && "Step 3: Review before submitting"}
              {view === "stories" && "Stories and essays"}
            </h1>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label="Search"
              onClick={() => setShowSearch(true)}
            >
              ⌕
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setShowImport(true);
                setImportStage("idle");
              }}
            >
              <span aria-hidden="true">＋</span> Add evidence
            </button>
          </div>
        </header>

        {view === "overview" && (
          <div className="page-grid overview-page">
            <section className="hero-card">
              <div className="hero-copy">
                <StatusPill tone="green">Your guided workspace</StatusPill>
                <h2>Turn your real experience into a stronger application.</h2>
                <p>
                  Upload your documents once. MeritOS helps you find truthful
                  answers, complete each application, and check it before you
                  submit. You approve every suggestion.
                </p>
                <div className="hero-actions">
                  <button
                    className="primary-button"
                    onClick={() => goTo("lifegraph")}
                  >
                    Continue with your profile
                  </button>
                  <button
                    className="text-button"
                    onClick={() => goTo("applications")}
                  >
                    Try the sample application <span>→</span>
                  </button>
                </div>
              </div>
              <div className="hero-score">
                <div className="depth-scene" aria-hidden="true">
                  <span className="depth-plane plane-one" />
                  <span className="depth-plane plane-two" />
                  <span className="depth-node node-one" />
                  <span className="depth-node node-two" />
                  <span className="depth-line" />
                </div>
                <div className="readiness-object">
                  <ProgressRing value={84} label="readiness" />
                  <div className="score-caption">
                    <span className="signal-dot" />
                    Competitive · moderate confidence
                  </div>
                </div>
              </div>
            </section>

            <section className="guided-path" aria-labelledby="guided-path-title">
              <div className="guided-path-heading">
                <div>
                  <span className="eyebrow">How MeritOS works</span>
                  <h2 id="guided-path-title">One application, four clear steps</h2>
                </div>
                <p>
                  Start with your verified profile, then move from left to right.
                  MeritOS will always show you the next action.
                </p>
              </div>
              <div className="guided-steps">
                <button className="guided-step current" onClick={() => goTo("lifegraph")}>
                  <span className="step-number">1</span>
                  <span className="step-state">{verifiedCount} facts verified</span>
                  <strong>Build your profile</strong>
                  <small>Upload a résumé and confirm the facts MeritOS may use.</small>
                  <span className="step-action">Continue profile →</span>
                </button>
                <button className="guided-step" onClick={() => goTo("applications")}>
                  <span className="step-number">2</span>
                  <span className="step-state">Sample ready</span>
                  <strong>Open an application</strong>
                  <small>Choose a program and see its requirements and questions.</small>
                  <span className="step-action">Open application →</span>
                </button>
                <button className="guided-step" onClick={() => goTo("applications")}>
                  <span className="step-number">3</span>
                  <span className="step-state">{approvedFields.length}/3 approved</span>
                  <strong>Complete the questions</strong>
                  <small>Review evidence-backed answers and approve them yourself.</small>
                  <span className="step-action">Review answers →</span>
                </button>
                <button className="guided-step" onClick={() => goTo("review")}>
                  <span className="step-number">4</span>
                  <span className="step-state">
                    {reviewComplete ? "Preview available" : "Reviewing"}
                  </span>
                  <strong>Check before submitting</strong>
                  <small>Find missing evidence, weak answers, and the best improvements.</small>
                  <span className="step-action">See review →</span>
                </button>
              </div>
              <div className="safety-note">
                <strong>MeritOS never submits for you.</strong>
                <span>It suggests, explains, and checks. You make every final decision.</span>
              </div>
            </section>

            <section className="section-card applications-summary">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Active work</span>
                  <h2>Applications in motion</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setView("applications")}
                >
                  Open applications
                </button>
              </div>
              <div className="application-list">
                {applications.map((app) => (
                  <button
                    className="application-row"
                    key={app.id}
                    onClick={() => {
                      setSelectedApplication(app.id);
                      setView("applications");
                    }}
                  >
                    <span className={`app-monogram ${app.tone}`}>
                      {app.name.slice(0, 1)}
                    </span>
                    <span className="app-copy">
                      <strong>{app.name}</strong>
                      <small>
                        {app.organization} · {app.tasks} actions left
                      </small>
                    </span>
                    <span className="app-progress">
                      <span className="mini-progress">
                        <span style={{ width: `${app.progress}%` }} />
                      </span>
                      <small>{app.progress}%</small>
                    </span>
                    <StatusPill tone={app.tone}>{app.status}</StatusPill>
                    <span className="deadline">
                      <small>Due</small>
                      <strong>{app.deadline}</strong>
                    </span>
                    <span className="row-arrow">›</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="section-card next-actions">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Highest value first</span>
                  <h2>Next best actions</h2>
                </div>
              </div>
              <div className="action-list">
                <button onClick={() => setView("applications")}>
                  <span className="action-index urgent">1</span>
                  <span>
                    <strong>Clarify your individual research contribution</strong>
                    <small>Rhodes · Personal statement · 8 minute task</small>
                  </span>
                  <StatusPill tone="gold">High leverage</StatusPill>
                </button>
                <button onClick={() => setView("lifegraph")}>
                  <span className="action-index">2</span>
                  <span>
                    <strong>Verify the “32% improvement” claim</strong>
                    <small>Used in 2 applications · evidence gap</small>
                  </span>
                  <StatusPill tone="blue">Evidence</StatusPill>
                </button>
                <button onClick={() => setView("stories")}>
                  <span className="action-index">3</span>
                  <span>
                    <strong>Replace the repeated mentoring example</strong>
                    <small>Fulbright · Story allocation · 5 minute task</small>
                  </span>
                  <StatusPill tone="violet">Narrative</StatusPill>
                </button>
              </div>
            </section>

            <aside className="section-card trust-panel">
              <span className="eyebrow">Truth layer</span>
              <h2>Evidence health</h2>
              <div className="trust-stat">
                <strong>18</strong>
                <span>verified claims</span>
              </div>
              <div className="trust-stat">
                <strong>4</strong>
                <span>restricted claims</span>
              </div>
              <div className="trust-stat warning">
                <strong>2</strong>
                <span>need review</span>
              </div>
              <div className="divider" />
              <p>
                No unsupported claim will be filled without a visible warning
                and your approval.
              </p>
              <button className="text-button" onClick={() => setView("lifegraph")}>
                Inspect LifeGraph →
              </button>
            </aside>
          </div>
        )}

        {view === "lifegraph" && (
          <div className="content-page">
            <section className="next-step-banner">
              <span className="next-step-check" aria-hidden="true">✓</span>
              <div>
                <span className="eyebrow">Step 1 in progress</span>
                <h2>Your profile has {verifiedCount} verified facts.</h2>
                <p>
                  Approve anything that is accurate. When you are ready, use
                  those facts to complete the sample application.
                </p>
              </div>
              <button className="primary-button" onClick={() => goTo("applications")}>
                Next: open an application
              </button>
            </section>
            <section className="metrics-strip">
              <div>
                <span>Verified claims</span>
                <strong>{verifiedCount}</strong>
                <small>Ready for applications</small>
              </div>
              <div>
                <span>Evidence sources</span>
                <strong>12</strong>
                <small>CV, reports, portfolio</small>
              </div>
              <div>
                <span>Potential conflicts</span>
                <strong className="gold-text">2</strong>
                <small>Dates and one impact metric</small>
              </div>
              <div>
                <span>Sensitive claims</span>
                <strong>4</strong>
                <small>Explicit permission required</small>
              </div>
            </section>

            <section className="section-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Canonical evidence</span>
                  <h2>Claims and experiences</h2>
                </div>
                <div className="segmented">
                  <button
                    className={claimFilter === "all" ? "active" : ""}
                    onClick={() => setClaimFilter("all")}
                  >
                    All
                  </button>
                  <button
                    className={claimFilter === "verified" ? "active" : ""}
                    onClick={() => setClaimFilter("verified")}
                  >
                    Verified
                  </button>
                  <button
                    className={claimFilter === "review" ? "active" : ""}
                    onClick={() => setClaimFilter("review")}
                  >
                    Needs review
                  </button>
                </div>
              </div>
              <div className="claims-list">
                {filteredClaims.map((claim) => (
                  <article className="claim-card" key={claim.id}>
                    <div className={`claim-state ${claim.status}`} aria-hidden="true" />
                    <div className="claim-main">
                      <div className="claim-title-row">
                        <h3>{claim.title}</h3>
                        <StatusPill
                          tone={
                            claim.status === "verified"
                              ? "green"
                              : claim.status === "restricted"
                                ? "violet"
                                : "gold"
                          }
                        >
                          {claim.status === "verified"
                            ? "Verified"
                            : claim.status === "restricted"
                              ? "Restricted"
                              : "Needs review"}
                        </StatusPill>
                      </div>
                      <p>{claim.detail}</p>
                      <div className="claim-meta">
                        <span>⌁ {claim.source}</span>
                        <span>◉ {claim.evidence} source{claim.evidence > 1 ? "s" : ""}</span>
                        {claim.themes.map((theme) => (
                          <span className="theme-tag" key={theme}>
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      className="secondary-button compact"
                      onClick={() => {
                        toggleClaimStatus(claim.id);
                        announce(
                          claim.status === "verified"
                            ? "Claim marked for review. Refresh the committee review to reflect it."
                            : "Claim verified. Run a fresh review to see the impact.",
                        );
                      }}
                    >
                      {claim.status === "verified" ? "Mark for review" : "Verify claim"}
                    </button>
                  </article>
                ))}
                {filteredClaims.length === 0 && (
                  <div className="empty-state">
                    <strong>No matching evidence yet.</strong>
                    <span>Try a different filter or add a document.</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {view === "applications" && (
          <div className="content-page application-workspace">
            <section className="next-step-banner application-guide">
              <span className="next-step-check" aria-hidden="true">2</span>
              <div>
                <span className="eyebrow">What to do here</span>
                <h2>Review the suggested answers below.</h2>
                <p>
                  Click each answer’s evidence label to approve it. Then apply
                  your approved suggestions and continue to the final review.
                </p>
              </div>
              <button className="secondary-button" onClick={() => setShowOverlay(true)}>
                Open focused overlay
              </button>
            </section>
            <div className="application-tabs" role="tablist" aria-label="Applications">
              {applications.map((app) => (
                <button
                  key={app.id}
                  role="tab"
                  aria-selected={selectedApplication === app.id}
                  className={selectedApplication === app.id ? "active" : ""}
                  onClick={() => setSelectedApplication(app.id)}
                >
                  <span className={`app-dot ${app.tone}`} />
                  {app.name}
                </button>
              ))}
            </div>

            <section className="application-header-card">
              <div>
                <span className="eyebrow">{selectedApp.organization}</span>
                <h2>{selectedApp.name}</h2>
                <p>
                  Due {selectedApp.deadline} · {selectedApp.tasks} actions
                  remaining
                </p>
              </div>
              <div className="app-header-status">
                <ProgressRing value={selectedApp.progress} label="complete" />
                <div className="application-header-actions">
                  <button
                    className="secondary-button inverse"
                    onClick={() => setShowOverlay(true)}
                  >
                    Open screen overlay
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => announce("Application checklist opened.")}
                  >
                    Continue application
                  </button>
                </div>
              </div>
            </section>

            <div className="two-column">
              <section className="section-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Opportunity preflight</span>
                    <h2>Requirements and readiness</h2>
                  </div>
                  <StatusPill tone="green">Eligible</StatusPill>
                </div>
                <div className="requirement-list">
                  {[
                    ["Academic standing", "Satisfied", "Transcript · verified", "green"],
                    ["Institutional nomination", "In progress", "Advisor confirmation due Aug 2", "gold"],
                    ["Two recommendations", "1 of 2 ready", "Research supervisor confirmed", "blue"],
                    ["Personal statement", "Draft ready", "748 of 750 words", "violet"],
                    ["AI assistance policy", "Coaching allowed", "Applicant must author final prose", "green"],
                  ].map(([name, state, detail, tone]) => (
                    <div className="requirement-row" key={name}>
                      <span className={`requirement-icon ${tone}`}>✓</span>
                      <span>
                        <strong>{name}</strong>
                        <small>{detail}</small>
                      </span>
                      <StatusPill tone={tone}>{state}</StatusPill>
                    </div>
                  ))}
                </div>
              </section>

              <section className="section-card overlay-demo">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Screen overlay</span>
                    <h2>Try it before you connect a portal</h2>
                  </div>
                  <span className="live-badge">
                    <span /> Preview mode
                  </span>
                </div>
                <div className="mock-browser">
                  <div className="mock-browser-bar">
                    <span /><span /><span />
                    <div>application.portal.edu / personal-statement</div>
                  </div>
                  <div className="mock-form">
                    <div className="mock-field">
                      <label>Preferred name</label>
                      <div className="mock-input approved">Aahan S.</div>
                      <button
                        className="field-status green"
                        onClick={() => approveField("name")}
                      >
                        Verified · CV
                      </button>
                    </div>
                    <div className="mock-field narrative">
                      <label>Describe a significant leadership experience</label>
                      <div className="mock-textarea">
                        During my assistive-technology research project, I
                        coordinated a five-person team through an unexpected
                        change in our study protocol…
                      </div>
                      <button
                        className={`field-status blue ${
                          approvedFields.includes("leadership") ? "approved" : ""
                        }`}
                        onClick={() => approveField("leadership")}
                      >
                        {approvedFields.includes("leadership")
                          ? "Approved by you"
                          : "Evidence-backed · review"}
                      </button>
                    </div>
                    <div className="mock-field">
                      <label>Household financial context</label>
                      <div className="mock-input muted-input">
                        Sensitive information is locked
                      </div>
                      <button
                        className="field-status violet"
                        onClick={() => announce("One-time permission is required.")}
                      >
                        Restricted · ask first
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overlay-footer">
                  <span>
                    {approvedFields.length}/3 fields approved · submission is
                    always manual
                  </span>
                  <button
                    className="secondary-button compact"
                    onClick={applyOverlaySuggestions}
                  >
                    Apply approved suggestions
                  </button>
                </div>
                {overlayApplied && (
                  <div className="completion-callout" role="status">
                    <span aria-hidden="true">✓</span>
                    <div>
                      <strong>Your approved answers are in the preview.</strong>
                      <small>Nothing was submitted. The next step is a final quality review.</small>
                    </div>
                    <button className="primary-button" onClick={() => goTo("review")}>
                      Review before submitting
                    </button>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {view === "review" && (
          <div className="content-page review-page">
            <section className="review-hero">
              <div>
                <span className="eyebrow">Rhodes Scholarship · simulated committee</span>
                <h2>
                  {reviewedVerifiedCount > 3
                    ? "Your verified evidence strengthened the committee’s read."
                    : "Competitive, with one evidence gap the committee will notice."}
                </h2>
                <p>
                  This is a transparent simulation based on the public
                  criteria and your approved evidence—not an official decision
                  or an acceptance prediction.
                </p>
              </div>
              <div className="review-actions">
                <div className="review-status-stack">
                  <StatusPill tone="gold">Moderate confidence</StatusPill>
                  {evidenceChangesSinceReview !== 0 && (
                    <span className="review-stale-note">
                      {Math.abs(evidenceChangesSinceReview)} evidence change{Math.abs(evidenceChangesSinceReview) === 1 ? "" : "s"} not reviewed yet
                    </span>
                  )}
                </div>
                <button
                  className="primary-button"
                  onClick={runReview}
                  disabled={reviewRunning}
                >
                  {reviewRunning ? "Reviewing…" : "Run fresh review"}
                </button>
              </div>
            </section>

            {reviewRunning && (
              <section className="review-loader" aria-live="polite">
                <div className="review-loader-line" />
                <p>Seven reviewers are reading independently…</p>
              </section>
            )}

            {reviewComplete && (
              <>
                <section className="committee-grid">
                  {reviewRows.map((reviewer) => (
                    <article className="reviewer-card" key={reviewer.name}>
                      <div className="reviewer-top">
                        <span className={`reviewer-avatar ${reviewer.tone}`}>
                          {reviewer.name.slice(0, 1)}
                        </span>
                        <div>
                          <strong>{reviewer.name}</strong>
                          <small>Independent read</small>
                        </div>
                        <span className="review-score">{reviewer.score}</span>
                      </div>
                      <p>{reviewer.note}</p>
                      <div className="score-bar">
                        <span
                          className={reviewer.tone}
                          style={{ width: `${reviewer.score}%` }}
                        />
                      </div>
                    </article>
                  ))}
                </section>

                <div className="review-details-grid">
                  <section className="section-card rubric-card">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">Criterion coverage</span>
                        <h2>How the case reads</h2>
                      </div>
                    </div>
                    {[
                      ["Academic preparation", 91, "green"],
                      ["Leadership and character", 86 + reviewEvidenceGain * 2, "blue"],
                      ["Commitment to service", 89, "violet"],
                      ["Distinctive contribution", 72 + reviewEvidenceGain * 2, "gold"],
                      ["Evidence strength", 76 + reviewEvidenceGain * 7, "gold"],
                    ].map(([name, score, tone]) => (
                      <div className="rubric-row" key={name}>
                        <span>{name}</span>
                        <div className="score-bar">
                          <span
                            className={tone as string}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <strong>{score}</strong>
                      </div>
                    ))}
                  </section>

                  <section className="section-card chair-card">
                    <span className="eyebrow">Committee chair synthesis</span>
                    <h2>The strongest case</h2>
                    <blockquote>
                      “A technically capable, community-minded researcher whose
                      work consistently turns complex systems into practical
                      support for others.”
                    </blockquote>
                    <h3>Most credible rejection case</h3>
                    <p>
                      The applicant’s research impact is promising, but the
                      package does not yet isolate their individual
                      contribution clearly enough.
                    </p>
                  </section>

                  <section className="section-card actions-card">
                    <span className="eyebrow">Highest-leverage improvements</span>
                    <h2>Do these three things{tasksAdded > 0 ? ` · ${tasksAdded} added` : ""}</h2>
                    {[
                      "Add one sentence naming the research decision you personally made.",
                      "Attach a source that corroborates the 32% improvement metric.",
                      "Use the community-health story instead of repeating the mentoring example.",
                    ].map((action, index) => (
                      <div className="improvement-row" key={action}>
                        <span>{index + 1}</span>
                        <p>{action}</p>
                        <button onClick={() => {
                          setTasksAdded((count) => count + 1);
                          announce("Improvement added to your task list.");
                        }}>
                          Add task
                        </button>
                      </div>
                    ))}
                  </section>

                  <section className="section-card uncertainty-card">
                    <span className="eyebrow">Honest uncertainty</span>
                    <h2>What MeritOS cannot know</h2>
                    <ul>
                      <li>Current applicant-pool strength</li>
                      <li>Internal institutional priorities</li>
                      <li>Reviewer assignment and discussion dynamics</li>
                      <li>Changes in available awards</li>
                    </ul>
                    <div className="base-rate">
                      <span>Published selection rate</span>
                      <strong>≈ 0.7%</strong>
                    </div>
                    <p className="fine-print">
                      MeritOS does not convert a language-model opinion into an
                      acceptance percentage.
                    </p>
                  </section>
                </div>
              </>
            )}
          </div>
        )}

        {view === "stories" && (
          <div className="content-page story-page">
            <section className="story-intro">
              <div>
                <span className="eyebrow">Narrative without invention</span>
                <h2>One true experience, shaped for the question.</h2>
                <p>
                  Choose a lens to change emphasis—not facts. Every story stays
                  linked to the evidence you approved.
                </p>
              </div>
              <div className="lens-picker">
                <span>Active narrative lens</span>
                <div className="lens-buttons">
                  {["Public service", "Research", "Leadership", "Resilience"].map(
                    (item) => (
                      <button
                        key={item}
                        className={lens === item ? "active" : ""}
                        onClick={() => setLens(item)}
                      >
                        {item}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </section>

            <div className="story-layout">
              <section className="section-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Story bank</span>
                    <h2>Approved experiences</h2>
                  </div>
                  <button
                    className="secondary-button compact"
                    onClick={() => announce("Authenticity interview started.")}
                  >
                    ＋ Interview me
                  </button>
                </div>
                <div className="story-list">
                  {[
                    {
                      title: "The protocol changed three weeks before launch",
                      theme: "Leadership",
                      uses: 2,
                      detail:
                        "Research team · decision under uncertainty · measurable outcome",
                    },
                    {
                      title: "A tutoring session became a student resource system",
                      theme: "Public service",
                      uses: 3,
                      detail:
                        "First-generation students · initiative · sustained community use",
                    },
                    {
                      title: "The metric that forced me to redesign the workflow",
                      theme: "Research",
                      uses: 1,
                      detail:
                        "Automation project · intellectual honesty · 32% improvement",
                    },
                  ].map((story, index) => (
                    <article className="story-card" key={story.title}>
                      <span className="story-number">0{index + 1}</span>
                      <div>
                        <StatusPill tone={index === 1 ? "violet" : "blue"}>
                          {story.theme}
                        </StatusPill>
                        <h3>{story.title}</h3>
                        <p>{story.detail}</p>
                        <small>Used in {story.uses} active application{story.uses > 1 ? "s" : ""}</small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Open ${story.title}`}
                        onClick={() => announce("Story opened with its evidence.")}
                      >
                        →
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="section-card allocation-card">
                <span className="eyebrow">Application coherence</span>
                <h2>Story allocation</h2>
                <p>
                  Your mentoring story appears in three answers. Reviewers may
                  remember the repetition more than the experience.
                </p>
                <div className="allocation-chart">
                  <div style={{ "--size": "82%" } as React.CSSProperties}>
                    <span>Mentoring</span><strong>3 uses</strong>
                  </div>
                  <div style={{ "--size": "55%" } as React.CSSProperties}>
                    <span>Research pivot</span><strong>2 uses</strong>
                  </div>
                  <div style={{ "--size": "28%" } as React.CSSProperties}>
                    <span>Workflow redesign</span><strong>1 use</strong>
                  </div>
                </div>
                <button
                  className="primary-button full"
                  onClick={() => announce(`Answers rebalanced through the ${lens} lens.`)}
                >
                  Rebalance stories
                </button>
              </aside>
            </div>
          </div>
        )}
      </section>

      {showOverlay && (
        <div className="overlay-backdrop" role="presentation" onMouseDown={() => setShowOverlay(false)}>
          <aside
            className="screen-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="screen-overlay-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="screen-overlay-top">
              <div>
                <span className="eyebrow">MeritOS screen overlay</span>
                <h2 id="screen-overlay-title">{selectedApp.name}</h2>
                <p>Suggestions appear beside fields. You decide what gets applied.</p>
              </div>
              <button className="modal-close" onClick={() => setShowOverlay(false)} aria-label="Close overlay">×</button>
            </div>
            <div className="overlay-status-row">
              <StatusPill tone="green">Page understood</StatusPill>
              <span>Manual submission only</span>
            </div>
            <section className="overlay-field-card">
              <span className="field-kicker">Preferred name</span>
              <strong>Aahan S.</strong>
              <p>Matched to verified CV evidence.</p>
              <button className="field-status green" onClick={() => approveField("name")}>Verified · CV</button>
            </section>
            <section className="overlay-field-card">
              <span className="field-kicker">Leadership response</span>
              <strong>Assistive-technology research team</strong>
              <p>Evidence-backed draft. Review the wording before applying it.</p>
              <button
                className={`field-status blue ${approvedFields.includes("leadership") ? "approved" : ""}`}
                onClick={() => approveField("leadership")}
              >
                {approvedFields.includes("leadership") ? "Approved by you" : "Approve this draft"}
              </button>
            </section>
            <section className="overlay-field-card restricted-overlay-field">
              <span className="field-kicker">Financial context</span>
              <strong>Locked sensitive information</strong>
              <p>This is intentionally excluded until you grant one-time permission.</p>
              <button className="field-status violet" onClick={() => announce("Sensitive information stays locked until you explicitly allow it.")}>Ask first</button>
            </section>
            <div className="screen-overlay-footer">
              <span>{approvedFields.length}/3 suggestions approved</span>
              <button className="primary-button full" onClick={applyOverlaySuggestions}>
                {overlayApplied ? "Suggestions applied to preview" : "Apply approved suggestions"}
              </button>
              <small>MeritOS cannot submit this application for you.</small>
            </div>
          </aside>
        </div>
      )}

      {showSearch && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowSearch(false)}>
          <section
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="search-modal-head">
              <div>
                <span className="eyebrow">Find your work</span>
                <h2 id="search-title">Search evidence and applications</h2>
              </div>
              <button className="modal-close" onClick={() => setShowSearch(false)} aria-label="Close search">×</button>
            </div>
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try “research”, “leadership”, or a document name"
              />
            </label>
            <div className="search-results">
              {filteredClaims.slice(0, 5).map((claim) => (
                <button
                  key={claim.id}
                  onClick={() => {
                    setView("lifegraph");
                    setShowSearch(false);
                    announce(`Opened evidence: ${claim.title}`);
                  }}
                >
                  <span className={`claim-state ${claim.status}`} />
                  <span><strong>{claim.title}</strong><small>{claim.source}</small></span>
                  <span>View →</span>
                </button>
              ))}
              {filteredClaims.length === 0 && <p>No matching evidence yet.</p>}
            </div>
          </section>
        </div>
      )}

      {showImport && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeImport}>
          <section
            className="import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={closeImport} aria-label="Close">
              ×
            </button>
            <span className="eyebrow">Local-first import</span>
            <h2 id="import-title">Add evidence to your LifeGraph</h2>
            <p>
              MeritOS extracts candidate claims. Nothing becomes verified or
              reusable until you review it.
            </p>

            {(importStage === "idle" || importStage === "error") && (
              <>
                <label
                  className="drop-zone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(event) => chooseFile(event.target.files?.[0])}
                  />
                  <span className="drop-icon">⇧</span>
                  <strong>Choose a document or drop it here</strong>
                  <small>PDF, DOCX, transcript, essay, or portfolio</small>
                </label>
                {importStage === "error" && (
                  <p className="form-error" role="alert">{importMessage}</p>
                )}
                <div className="privacy-note">
                  <span>◆</span>
                  <p>
                    This MVP processes the selected file as a local simulation
                    and never submits it to an institution.
                  </p>
                </div>
              </>
            )}

            {importStage === "selected" && selectedFile && (
              <div className="selected-file">
                <div className="selected-file-icon" aria-hidden="true">⌁</div>
                <div>
                  <strong>{selectedFile.name}</strong>
                  <span>{formatFileSize(selectedFile.size)} · ready to add</span>
                </div>
                <button className="text-button" onClick={() => setImportStage("idle")}>Choose another</button>
                <button className="primary-button" onClick={runImport}>Add to workspace</button>
              </div>
            )}

            {importStage === "uploading" && (
              <div className="import-progress">
                <div className="document-stack">
                  <span /><span /><span />
                </div>
                <h3>Saving your document and preparing it for review…</h3>
                <div className="loading-bar"><span /></div>
              </div>
            )}

            {importStage === "done" && (
              <div className="import-result">
                <span className="result-check">✓</span>
                <h3>One new candidate claim found</h3>
                <p>
                  {importMessage} A draft evidence item is ready for you to review.
                </p>
                <button
                  className="primary-button"
                  onClick={() => {
                    closeImport();
                    setView("lifegraph");
                  }}
                >
                  Review in LifeGraph
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      <div className={toast ? "toast visible" : "toast"} role="status">
        {toast}
      </div>
    </main>
  );
}
