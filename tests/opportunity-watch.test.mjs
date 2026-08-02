import assert from "node:assert/strict";
import test from "node:test";
import { parseOpportunityRows } from "../lib/opportunity-watch-core.js";

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
