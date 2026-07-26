"use client";

import { useMemo, useState } from "react";

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
  { id: "overview", label: "Opportunity cockpit", glyph: "⌂" },
  { id: "lifegraph", label: "LifeGraph", glyph: "◫" },
  { id: "applications", label: "Applications", glyph: "▤" },
  { id: "review", label: "Review Room", glyph: "◎" },
  { id: "stories", label: "Story Studio", glyph: "✦" },
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
  const [importStage, setImportStage] = useState<"idle" | "reading" | "done">(
    "idle",
  );
  const [reviewRunning, setReviewRunning] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(true);
  const [approvedFields, setApprovedFields] = useState<string[]>(["name"]);
  const [lens, setLens] = useState("Public service");
  const [toast, setToast] = useState("");

  const selectedApp =
    applications.find((app) => app.id === selectedApplication) ??
    applications[0];

  const verifiedCount = useMemo(
    () => claims.filter((claim) => claim.status === "verified").length,
    [claims],
  );

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function runImport() {
    setImportStage("reading");
    window.setTimeout(() => {
      setImportStage("done");
      setClaims((current) => [
        ...current,
        {
          id: Date.now(),
          title: "Presented research findings to a public audience",
          detail:
            "Candidate claim extracted from the uploaded project portfolio. Review before use.",
          source: "New portfolio.pdf",
          evidence: 1,
          status: "draft",
          themes: ["Communication", "Research"],
        },
      ]);
    }, 1100);
  }

  function closeImport() {
    setShowImport(false);
    setImportStage("idle");
  }

  function toggleClaimStatus(id: number) {
    setClaims((current) =>
      current.map((claim) =>
        claim.id === id
          ? {
              ...claim,
              status:
                claim.status === "verified"
                  ? "restricted"
                  : claim.status === "restricted"
                    ? "draft"
                    : "verified",
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
      announce("Committee review refreshed with current evidence.");
    }, 1300);
  }

  function approveField(id: string) {
    setApprovedFields((current) =>
      current.includes(id)
        ? current.filter((field) => field !== id)
        : [...current, id],
    );
  }

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
              {view === "overview" && "Opportunity cockpit"}
              {view === "lifegraph" && "Your LifeGraph"}
              {view === "applications" && "Application workspace"}
              {view === "review" && "The Review Room"}
              {view === "stories" && "Story Studio"}
            </h1>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              aria-label="Search"
              onClick={() => announce("Search is ready for claims and applications.")}
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
                <StatusPill tone="green">Evidence health · strong</StatusPill>
                <h2>Your strongest truthful case, ready when you are.</h2>
                <p>
                  MeritOS has verified {verifiedCount} core claims and found
                  three high-value actions across your active applications.
                </p>
                <div className="hero-actions">
                  <button
                    className="primary-button"
                    onClick={() => setView("review")}
                  >
                    Open Review Room
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setView("lifegraph")}
                  >
                    Review evidence <span>→</span>
                  </button>
                </div>
              </div>
              <div className="hero-score">
                <ProgressRing value={84} label="readiness" />
                <div className="score-caption">
                  <span className="signal-dot" />
                  Competitive · moderate confidence
                </div>
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
                  View all
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
                  <button className="active">All</button>
                  <button>Verified</button>
                  <button>Needs review</button>
                </div>
              </div>
              <div className="claims-list">
                {claims.map((claim) => (
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
                        announce("Claim permission updated.");
                      }}
                    >
                      Manage
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === "applications" && (
          <div className="content-page application-workspace">
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
                <button
                  className="primary-button"
                  onClick={() => announce("Application review package opened.")}
                >
                  Continue application
                </button>
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
                    <span className="eyebrow">Live overlay preview</span>
                    <h2>Field-level control</h2>
                  </div>
                  <span className="live-badge">
                    <span /> Page understood
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
                    onClick={() => announce("Verified fields filled. No form was submitted.")}
                  >
                    Fill approved fields
                  </button>
                </div>
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
                  Competitive, with one evidence gap the committee will notice.
                </h2>
                <p>
                  This is a transparent simulation based on the public
                  criteria and your approved evidence—not an official decision
                  or an acceptance prediction.
                </p>
              </div>
              <div className="review-actions">
                <StatusPill tone="gold">Moderate confidence</StatusPill>
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
                  {reviewerRows.map((reviewer) => (
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
                      ["Leadership and character", 86, "blue"],
                      ["Commitment to service", 89, "violet"],
                      ["Distinctive contribution", 72, "gold"],
                      ["Evidence strength", 76, "gold"],
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
                    <h2>Do these three things</h2>
                    {[
                      "Add one sentence naming the research decision you personally made.",
                      "Attach a source that corroborates the 32% improvement metric.",
                      "Use the community-health story instead of repeating the mentoring example.",
                    ].map((action, index) => (
                      <div className="improvement-row" key={action}>
                        <span>{index + 1}</span>
                        <p>{action}</p>
                        <button onClick={() => announce("Action added to your workspace.")}>
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

            {importStage === "idle" && (
              <>
                <label className="drop-zone">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={runImport}
                  />
                  <span className="drop-icon">⇧</span>
                  <strong>Choose a document or drop it here</strong>
                  <small>PDF, DOCX, transcript, essay, or portfolio</small>
                </label>
                <div className="privacy-note">
                  <span>◆</span>
                  <p>
                    This MVP processes the selected file as a local simulation
                    and never submits it to an institution.
                  </p>
                </div>
              </>
            )}

            {importStage === "reading" && (
              <div className="import-progress">
                <div className="document-stack">
                  <span /><span /><span />
                </div>
                <h3>Reading structure and extracting candidate claims…</h3>
                <div className="loading-bar"><span /></div>
              </div>
            )}

            {importStage === "done" && (
              <div className="import-result">
                <span className="result-check">✓</span>
                <h3>One new candidate claim found</h3>
                <p>
                  “Presented research findings to a public audience” was added
                  as a draft with one supporting source.
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
