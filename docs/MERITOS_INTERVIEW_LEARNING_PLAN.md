# Learn MeritOS Like the Back of Your Hand

Goal: explain the product, trace any button into code, debug a failed workflow, and defend the safety decisions without memorizing the entire repository.

## Seven-session plan

Each session is 60–90 minutes. End every session by explaining the topic aloud without notes.

### Session 1 — Tell the product story

Read:

- The one-sentence explanation and architecture diagram in `docs/MERITOS_SYSTEM_GUIDE.md`.
- `db/schema.ts` table names only.

Practice:

1. Give a 30-second pitch.
2. Give a two-minute end-to-end walkthrough.
3. Draw: Web app → API → Neon/Blob/OpenAI → Chrome worker → side panel → external form.

Pass when: you can explain why MeritOS needs both a web app and a Chrome extension.

### Session 2 — Profile and evidence pipeline

Trace these handlers in `app/page.tsx`:

- `finishOnboarding()`
- `importDocument()`
- `changeClaimStatus()`
- `importContextSource()`

Then open:

- `app/api/documents/route.ts`
- `lib/document-facts.ts`
- `app/api/claims/[id]/route.ts`
- the `claims` and `documents` tables in `db/schema.ts`

Practice question: “Why can’t an uploaded résumé sentence immediately autofill a form?”

Strong answer: extraction creates candidate facts; the evidence ledger separates drafts, verified claims, inferences, restrictions, and sources before reuse.

### Session 3 — Opportunity search and preparation

Trace:

- `scanOpportunityBoards()` → `/api/opportunity-watch`
- `scoreOpportunity()` in `lib/opportunity-watch-core.js`
- `scanLiveWebOpportunities()`
- `analyzeOpportunityPage()` → `/api/opportunity-preflight`
- `buildApplicationPacket()` → `/api/application-packet`

Practice question: “How do you stop a high-school query from returning college internships?”

Strong answer: field relevance and audience eligibility are separate signals; explicit conflicts are excluded, while unknown audience eligibility is clearly marked for confirmation.

### Session 4 — Website-to-extension connection

Trace the literal message `MERITOS_CONNECT_PROFILE` across:

1. `createExtensionConnection()` in `app/page.tsx`
2. `extension/content.js`
3. `extension/background.js`
4. `chrome.storage.local`
5. the startup and `chrome.storage.onChanged` logic in `extension/sidepanel.js`

Practice question: “Why use a connection token instead of sharing the website login with every application site?”

Strong answer: the token is scoped to the extension API, its hash is stored server-side, and arbitrary third-party pages never receive the Clerk session.

### Session 5 — Form intelligence

Trace:

- `scan()`, `scanStable()`, `controlFor()`, and `setField()` in `extension/content.js`
- `suggest()` in `extension/intelligence.js`
- `generateDrafts()` in `extension/sidepanel.js`
- `/api/extension/draft`
- `draftApplicationFields()` in `lib/ai-drafting.ts`

Practice with these deployed fixtures:

- `/extension-navigation-test.html` for landing-page guidance.
- `/extension-login-fixture.html` for account-step guidance.
- `/extension-form-fixture.html` for scanning and filling controls.

1. Name/email.
2. Date/month control.
3. Radio/select/checkbox.
4. Narrative answer.
5. Missing required context.

Pass when: you can say which layer owns scanning, deterministic mapping, AI drafting, filling, and review highlighting.

### Session 6 — Autopilot navigation and safety

Trace:

- `classifyPage()` and `chooseApplicationLink()` in `extension/navigation-core.js`
- `pageState()`, `showGuidance()`, and `detectAndLaunch()` in `extension/content.js`
- `MERITOS_APPLICATION_ENTRY_DETECTED` in `extension/background.js`
- `executeApplicationRun()` in `extension/sidepanel.js`

Practice five page states:

1. Landing page with Apply link.
2. Sign-up/login page.
3. CAPTCHA.
4. Actual form.
5. Final review/Submit page.

Pass when: you can explain why navigation may continue automatically but CAPTCHA and final submission do not.

### Session 7 — Debugging drill and mock interview

Pick three failures:

- “The extension is disconnected in a second tab.”
- “A select/radio answer did not fill.”
- “Search returned the wrong applicant level.”

For each, say:

1. What state is involved?
2. What message/API call should fire?
3. Which file receives it?
4. What evidence or log would prove the failure?
5. Which test should prevent regression?

Then answer the mock interview questions below.

## Mock interview questions

1. What is the hardest technical part of MeritOS?
2. Why did you build a browser extension instead of placing forms inside your app?
3. How does cross-tab state persistence work?
4. How do you constrain AI hallucination?
5. How do you handle third-party email, legal, demographic, and consent questions?
6. How does the system find the direct application form from a landing page?
7. What happens when a site requires an account or CAPTCHA?
8. Why separate canonical claims from generated answers?
9. What is stored in Neon versus Vercel Blob versus Chrome storage?
10. How would you measure whether MeritOS is actually valuable?
11. What currently does not work universally?
12. What would you build next with another month?

## Two-hour emergency version

If the interview is tomorrow:

- 20 min: memorize the one-sentence explanation and draw the architecture.
- 30 min: trace upload → claims → verification.
- 30 min: trace search → preflight → application packet → Chrome queue.
- 25 min: trace scan → deterministic suggestion → AI draft → fill → review.
- 15 min: rehearse limits and safeguards.

## Your interview demo script

1. Sign in and show the verified evidence ledger.
2. Upload a small test résumé and explain why extracted facts start as drafts.
3. Verify one fact.
4. Search for a narrowly specified opportunity including applicant level.
5. Prepare one application and show exceptions.
6. Connect Chrome once.
7. Start the application in Chrome.
8. Show the Apply/login guidance highlight.
9. Open the test form and show automatic scan, editable suggestions, an alternative, and one-click fill.
10. End on the visible safeguard: MeritOS stops before final submission.

## The answer structure to use in the interview

For any technical question, answer in this order:

1. **User outcome** — what problem the feature solves.
2. **Flow** — the components/messages/routes involved.
3. **Trust rule** — what the system refuses to assume or automate.
4. **Evidence** — the test or observable result proving it works.
5. **Next improvement** — one honest limitation and how you would address it.
