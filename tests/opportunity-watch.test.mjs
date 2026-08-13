import assert from "node:assert/strict";
import test from "node:test";
import { opportunityQuerySignals, parseOpportunityRows, scoreOpportunity } from "../lib/opportunity-watch-core.js";

test("parses matching public-board rows without turning them into eligibility claims", () => {
  const markdown = `| Company | Role | Location | Apply |\n| --- | --- | --- | --- |\n| Meridian Lab | Computational Biology Intern | Phoenix, AZ | [Apply](https://example.org/apply) |\n| Other Co | Marketing Intern | Remote | [Apply](https://example.org/other) |`;
  const rows = parseOpportunityRows(markdown, "computational biology", { name: "Fixture board", repo: "example/board" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Computational Biology Intern");
  assert.equal(rows[0].url, "https://example.org/apply");
  assert.equal(rows[0].repository, "https://github.com/example/board");
});

test("parses HTML-table repositories and prefers the employer application URL", () => {
  const html = `<table><tr><td><a href="https://simplify.jobs/c/Meridian">Meridian Lab</a></td><td>Software Engineering Intern</td><td>Phoenix, AZ</td><td><a href="https://jobs.example.org/meridian-intern">Apply</a><a href="https://simplify.jobs/p/abc">Simplify</a></td></tr></table>`;
  const rows = parseOpportunityRows(html, "software engineering", { name: "HTML board", repo: "example/html-board" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].url, "https://jobs.example.org/meridian-intern");
});

test("treats applicant level as a separate search constraint", () => {
  const query = "computational biology internships for high school students";
  const accepted = scoreOpportunity({ title: "High School Bioinformatics Research Internship", company: "Genome Lab", location: "Boston" }, query);
  const rejected = scoreOpportunity({ title: "Computational Genomics Internship", company: "Genome Lab", location: "Boston", searchText: "Computational genomics internship. Applicants must be currently enrolled in a university; college students only." }, query);
  assert.equal(accepted.eligible, true);
  assert.equal(accepted.audienceFit, "confirmed");
  assert.equal(rejected.eligible, false);
  assert.equal(rejected.audienceFit, "conflict");
});

test("expands computational biology without turning generic software into a match", () => {
  const signals = opportunityQuerySignals("computational biology internship for a high schooler");
  assert.ok(signals.fieldTerms.includes("bioinformatics"));
  assert.ok(signals.fieldTerms.includes("genomics"));
  assert.equal(scoreOpportunity({ title: "Backend Software Engineer", company: "Borderline", location: "Remote" }, "computational biology internship for a high schooler").eligible, false);
});

test("keeps applicant-level-unknown matches but labels them for confirmation", () => {
  const result = scoreOpportunity({ title: "Bioinformatics Summer Research Program", company: "Genome Institute", location: "Remote" }, "bioinformatics internship for high school students");
  assert.equal(result.eligible, true);
  assert.equal(result.audienceFit, "unconfirmed");
  assert.match(result.matchReasons.join(" "), /needs confirmation/i);
});
