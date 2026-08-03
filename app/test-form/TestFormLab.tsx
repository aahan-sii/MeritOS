"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./test-form.module.css";

const scenarios = {
  internship: { label: "Internship", title: "Summer Internship Application", organization: "Northstar Technology Lab", longPrompt: "Describe a project that best demonstrates your fit for this internship.", shortPrompt: "What technical skill would you bring to this team?" },
  research: { label: "Research", title: "Student Research Fellowship", organization: "Meridian Biomedical Institute", longPrompt: "Describe your most relevant research experience and your individual contribution.", shortPrompt: "Which research area interests you most?" },
  scholarship: { label: "Scholarship", title: "Community Scholars Award", organization: "Civic Futures Foundation", longPrompt: "How have you contributed to your community, and what changed because of your work?", shortPrompt: "List your strongest award or distinction." },
  grant: { label: "Grant", title: "Youth Innovation Microgrant", organization: "Open Horizons Fund", longPrompt: "Describe the project, the need it addresses, and the impact you expect to measure.", shortPrompt: "What amount of funding are you requesting?" },
  nonprofit: { label: "Nonprofit", title: "Volunteer Leadership Program", organization: "Community Bridge Network", longPrompt: "Give an example of service, leadership, or initiative relevant to this program.", shortPrompt: "What community issue matters most to you?" },
} as const;

type ScenarioKey = keyof typeof scenarios;

export default function TestFormLab() {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("internship");
  const [gradeLevel, setGradeLevel] = useState("");
  const [reviewStep, setReviewStep] = useState(false);
  const scenario = scenarios[scenarioKey];
  return (
    <main className={styles.page}>
      <header className={styles.header}><Link href="/">← Back to MeritOS</Link><span>Safe form testing lab</span></header>
      <section className={styles.intro}>
        <span>Practice only · nothing is submitted</span><h1>{scenario.title}</h1><p>Switch between realistic form types, open the MeritOS side panel, and test question detection, AI analysis, selection controls, and batch fill.</p>
        <nav className={styles.scenarios} aria-label="Choose a test form">{Object.entries(scenarios).map(([key, item]) => <button type="button" key={key} className={scenarioKey === key ? styles.active : ""} onClick={() => { setScenarioKey(key as ScenarioKey); setReviewStep(false); }}>{item.label}</button>)}</nav>
      </section>
      <form className={styles.form} key={scenarioKey}>
        <div className={styles.formHeading}><span>{scenario.organization}</span><strong>{scenario.title}</strong><small>Required questions are marked with an asterisk.</small></div>
        <div className={styles.twoColumns}>
          <label>Full legal name *<input name="applicant_full_name" autoComplete="name" required /></label>
          <label>Your email address *<input name="applicant_email" type="email" autoComplete="email" required /></label>
          <label>Phone number<input name="applicant_phone" type="tel" autoComplete="tel" /></label>
          <label>LinkedIn or personal website<input name="applicant_profile_url" type="url" inputMode="url" /></label>
          <label>Current school or organization *<input name="current_institution" required /></label>
          <label>Expected graduation date<input name="graduation_date" type="date" /></label>
        </div>
        <label>{scenario.shortPrompt}<input name="scenario_short_answer" maxLength={240} /></label>
        <label>{scenario.longPrompt} *<textarea name="scenario_long_answer" rows={7} maxLength={1800} required /><small>Maximum 1,800 characters</small></label>
        <fieldset><legend>Current education level *</legend>{["High school", "Undergraduate", "Graduate student", "Other"].map((option) => <label className={styles.choice} key={option}><input type="radio" name="education_level" value={option} required />{option}</label>)}</fieldset>
        <div className={styles.buttonQuestion} role="radiogroup" aria-labelledby="grade-level-label">
          <strong id="grade-level-label">Current grade level (button-style control)</strong>
          <div>{["9th grade", "10th grade", "11th grade", "12th grade"].map((option) => <button key={option} type="button" role="radio" aria-checked={gradeLevel === option} onClick={() => setGradeLevel(option)}>{option}</button>)}</div>
        </div>
        <label>Preferred participation format<select name="participation_format" defaultValue=""><option value="" disabled>Choose one</option><option>In person</option><option>Remote</option><option>Hybrid</option><option>No preference</option></select></label>
        <fieldset><legend>Areas of experience</legend>{["Research", "Software development", "Community service", "Leadership", "Data analysis"].map((option) => <label className={styles.choice} key={option}><input type="checkbox" name="experience_areas" value={option} />{option}</label>)}</fieldset>
        {scenarioKey === "grant" && <label>Funding requested in USD<input name="funding_requested" type="number" min="0" step="100" /></label>}
        <label>Teacher, recommender, or supervisor email<input name="reference_email" type="email" /><small>MeritOS should never insert your own email here.</small></label>
        <label>Why are you applying to this specific opportunity? *<textarea name="specific_motivation" rows={5} maxLength={1200} required /><small>This should remain blank unless you added opportunity-specific motivation context.</small></label>
        <fieldset><legend>Can we contact you about this practice application?</legend><label className={styles.choice}><input type="radio" name="contact_consent" value="Yes" />Yes</label><label className={styles.choice}><input type="radio" name="contact_consent" value="No" />No</label></fieldset>
        {reviewStep ? (
          <div className={styles.finalReview}><strong>Final review reached</strong><p>Application Run should stop here, highlight anything missing above, and leave this final action entirely to you.</p><button type="button" className={styles.disabledButton}>Submit application</button></div>
        ) : (
          <button type="button" className={styles.reviewButton} onClick={() => setReviewStep(true)}>Review application</button>
        )}
      </form>
    </main>
  );
}
