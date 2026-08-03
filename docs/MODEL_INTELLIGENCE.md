# MeritOS model intelligence

MeritOS uses a layered system rather than asking one model to guess everything:

1. A deterministic parser always preserves name, email, phone, links, institution, grade level, and graduation year from uploaded resumes.
2. The extraction model groups supported experiences across employment, entrepreneurship, nonprofits, education, research, service, trades, athletics, and creative work.
3. The form router identifies the question type and retrieves matching profile evidence.
4. The drafting model turns only the selected evidence into a field-specific answer.

`gpt-5.6-sol` is the default quality model for extraction and drafting. OpenAI does not currently support fine-tuning GPT-5.6 Sol, so the optional fine-tuned extractor uses a supported student model and can be selected with `OPENAI_EXTRACTION_FINE_TUNED_MODEL`.

## Benchmarks

Run the synthetic regression suites:

```powershell
npm run test:resume-corpus
```

This evaluates 10,000 synthetic resumes and 70,000 form-field mappings without storing real people's personal information.

## Build fine-tuning files

```powershell
npm run training:build
```

This writes two ignored local files under `training/`:

- `resume-extraction-10000.jsonl`
- `form-answering-10000.jsonl`

Review the files before uploading them. Synthetic benchmark success is not the same as real-world accuracy; use a held-out, consented evaluation set before promoting a fine-tuned model.

## Start an extraction fine-tune

Set `OPENAI_API_KEY`, then run:

```powershell
npm run training:start -- --confirm-cost
```

The command uploads the extraction dataset and creates a fine-tuning job using `gpt-4o-mini-2024-07-18` by default. It prints the job ID. Once OpenAI reports success, copy its `fine_tuned_model` ID into `OPENAI_EXTRACTION_FINE_TUNED_MODEL` in Vercel and redeploy.

The cost confirmation flag is required deliberately. Do not start a paid job without reviewing dataset quality and current API pricing.
