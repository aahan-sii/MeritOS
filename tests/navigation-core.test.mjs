import assert from "node:assert/strict";
import test from "node:test";

await import("../extension/navigation-core.js");
const navigation = globalThis.MeritOSNavigationCore;

test("recognizes major applicant tracking systems", () => {
  assert.equal(navigation.atsName("https://boards.greenhouse.io/acme/jobs/123"), "Greenhouse");
  assert.equal(navigation.atsName("https://acme.wd5.myworkdayjobs.com/en-US/jobs/job/123"), "Workday");
  assert.equal(navigation.atsName("https://jobs.ashbyhq.com/acme/123"), "Ashby");
});

test("prefers a direct ATS application link over generic job-page actions", () => {
  const selected = navigation.chooseApplicationLink([
    { label: "Learn more", url: "/company", clickable: true },
    { label: "View all jobs", url: "/careers", clickable: true },
    { label: "Apply now", url: "https://jobs.lever.co/acme/abc", clickable: true },
  ], "https://acme.example/jobs/software-intern");
  assert.equal(selected.url, "https://jobs.lever.co/acme/abc");
  assert.equal(selected.score > 100, true);
});

test("recognizes common direct-application action labels", () => {
  for (const label of ["Apply here", "Apply on company site", "Go to application", "Open application"]) {
    const selected = navigation.chooseApplicationLink([
      { label: "View all jobs", url: "/careers", clickable: true },
      { label, url: "https://jobs.ashbyhq.com/acme/role", clickable: true },
    ], "https://acme.example/internships/role");
    assert.equal(selected?.url, "https://jobs.ashbyhq.com/acme/role");
  }
});

test("rejects login, save, and unrelated navigation controls", () => {
  assert.equal(navigation.chooseApplicationLink([
    { label: "Sign in", url: "/login", clickable: true },
    { label: "Save job", url: "/save", clickable: true },
    { label: "Read more", url: "/about", clickable: true },
  ], "https://example.com/job"), null);
});

test("classifies forms, landing pages, ATS waits, login walls, and CAPTCHAs", () => {
  assert.equal(navigation.classifyPage({ fieldCount: 4, url: "https://example.com/apply" }), "form");
  assert.equal(navigation.classifyPage({ fieldCount: 0, applicationLink: { url: "https://jobs.lever.co/a/b" } }), "landing");
  assert.equal(navigation.classifyPage({ fieldCount: 0, url: "https://boards.greenhouse.io/a/jobs/1" }), "ats_waiting");
  assert.equal(navigation.classifyPage({ title: "Sign in to apply", bodyText: "Create an account to apply" }), "login");
  assert.equal(navigation.classifyPage({ title: "Security check", bodyText: "Verify you are human CAPTCHA" }), "captcha");
  assert.equal(navigation.classifyPage({ fieldCount: 3, url: "https://jobs.lever.co/a", hasPasswordInput: true, actions: { login: { found: true } } }), "login");
  assert.equal(navigation.classifyPage({ fieldCount: 2, url: "https://example.org/account", title: "Applicant portal", actions: { signup: { found: true } } }), "login");
});

test("only accepts HTTP application destinations", () => {
  assert.equal(navigation.safeUrl("javascript:alert(1)", "https://example.com"), "");
  assert.equal(navigation.safeUrl("/apply", "https://example.com/jobs/1"), "https://example.com/apply");
});

test("keeps account pages out of form filling even when they contain inputs", () => {
  const kind = navigation.classifyPage({
    fieldCount: 2,
    url: "https://example.org/applicant/sign-in",
    title: "Applicant portal account test",
    bodyText: "Create an account or sign in before continuing to the application.",
    hasPasswordInput: true,
    actions: { login: { found: true, label: "Sign in and continue" } },
  });
  assert.equal(kind, "login");
});
