import Link from "next/link";
import styles from "./test-form.module.css";

export const metadata = {
  title: "MeritOS Extension Test Form",
  description: "A safe application-style form for testing the MeritOS Chrome side panel.",
};

export default function TestFormPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/">← Back to MeritOS</Link>
        <span>Safe extension test</span>
      </header>

      <section className={styles.intro}>
        <span>MeritOS Practice Fellowship</span>
        <h1>Application test form</h1>
        <p>
          This form does not submit or store anything. Open the MeritOS Chrome
          side panel here to test scanning, answer approval, and autofill.
        </p>
      </section>

      <form className={styles.form}>
        <label>
          Full name
          <input name="fullName" autoComplete="name" />
        </label>

        <label>
          Email address
          <input name="email" type="email" autoComplete="email" />
        </label>

        <label>
          Current school, institution, or organization
          <input name="institution" />
        </label>

        <label>
          Describe your most relevant research experience.
          <textarea name="researchExperience" rows={5} maxLength={1200} />
          <small>Maximum 1,200 characters</small>
        </label>

        <label>
          Give an example of leadership or initiative.
          <textarea name="leadership" rows={5} maxLength={1200} />
          <small>Maximum 1,200 characters</small>
        </label>

        <label>
          Describe a project and the impact it created.
          <textarea name="projectImpact" rows={5} maxLength={1200} />
          <small>Maximum 1,200 characters</small>
        </label>

        <label>
          How have you contributed to your community?
          <textarea name="communityContribution" rows={5} maxLength={1200} />
          <small>Maximum 1,200 characters</small>
        </label>

        <label>
          List an award, achievement, or distinction.
          <textarea name="achievement" rows={4} maxLength={700} />
        </label>

        <label>
          Why are you applying for this fellowship?
          <textarea name="motivation" rows={6} maxLength={1500} />
          <small>
            MeritOS should leave this unsupported unless your verified profile
            contains relevant motivation evidence.
          </small>
        </label>

        <button type="button" className={styles.disabledButton}>
          Practice form — submission disabled
        </button>
      </form>
    </main>
  );
}
