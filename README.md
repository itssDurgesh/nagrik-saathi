# Nagrik Saathi: AMC Civic Complaint Agent

Garbathon 2026 (GDG Ahmedabad), Agents track. Snap a photo of a civic problem. A Gemini agent identifies the issue, finds the AMC ward and department, checks for duplicates, files the complaint with a tracking ID, and answers "what's the status?" in English, Hindi or Gujarati.

## Run

```bash
npm install
cp .env.example .env.local   # add GOOGLE_GENERATIVE_AI_API_KEY (free at aistudio.google.com/apikey)
npm run dev                  # http://localhost:3000
npm test                     # 61 Vitest tests: store, geo, SLA, agent tools, model fallback, API routes
```

**Gemini quota.** Free-tier keys allow only about 20 requests per model per day, and one photo report takes 5-6 agent steps. The agent therefore falls back through several models (`gemini-3.5-flash` → `gemini-3-flash-preview` → `gemini-2.5-flash` → `gemini-3.1-flash-lite`) whenever one is out of quota (429) or overloaded (503). Override the order with `GEMINI_MODEL` and `GEMINI_FALLBACK_MODELS`; see `lib/model.ts`.

The mock AMC system is `data/amc.json` (the seed). Live data goes to `data/db.json`. Use **Agent control → Reset demo data** before a demo.

## Screens

| Route | What it does |
|---|---|
| `/` | Citizen chat: photo upload/camera, location (photo GPS, device, map pin), live step cards, editable approval card, ticket card, agent pipeline, quick controls |
| `/complaints` | My complaints, or the whole city, with a status timeline, SLA countdown, Ask agent and Escalate buttons |
| `/officer` | Mock AMC staff kanban: drag to change status, add notes the agent reads back, city map |
| `/agent` | Autonomy (Ask first / Auto-file), language, tone, per-tool on/off switches, live action log, reset |

## Agent tools (`lib/tools.ts`)

`analyze_photo` → `locate_ward` → `route_department` → `check_duplicates` → `confirm_and_file` (ask mode: the browser shows an editable draft and files only on approve) or `file_complaint` (auto mode). Plus `upvote_complaint`, `get_status`, `list_my_complaints` and `escalate_complaint`.

## 2-minute demo

1. Tap the **Pothole** sample, then **Report**. Watch the step cards, edit the title on the approval card, then **Approve & file**. You get a ticket ID.
2. Tap **Waterlogging** (Paldi). The agent finds open complaint AMC-2026-00031 nearby and adds a +1 instead of filing a duplicate.
3. Tap **Open manhole**. It's marked URGENT with a 24-hour SLA.
4. Tap **Not civic (chai)**. The agent politely declines.
5. On `/officer`, drag the new pothole ticket to *In progress* and add a note.
6. Back on `/`, switch the language to ગુજરાતી and ask "મારી ફરિયાદનું સ્ટેટસ શું છે?". The answer includes the officer's note.
7. Ask "AMC-2026-00038 is overdue. Please escalate it." It gets escalated to the zonal Deputy Commissioner.
8. On `/agent`, switch to **Auto-file**, report the **Streetlight** sample, and it files with no approval step. Show the action log.

Sample photos come from Wikimedia Commons. See `public/samples/CREDITS.md`.
