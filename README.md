# crm-voz

Voice CRM built with Next.js 15 (App Router), Tailwind CSS, shadcn/ui, Supabase, and Groq (Whisper + chat).

## Stack

- **Next.js 15** App Router + TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** — auth, Postgres, storage-ready schema, realtime
- **Groq** — Whisper transcription + structured note extraction

## Setup

1. Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

2. Apply SQL in `supabase/migrations/` to your Supabase project.

3. Install and run:

```bash
npm install
npm run dev
```

## Key routes

| Path | Purpose |
|------|---------|
| `/login`, `/register` | Supabase email/password auth |
| `/dashboard` | Pipeline board + voice recorder + tasks |
| `/contact/[id]` | Contact detail |
| `/api/transcribe` | Groq Whisper (stub without `GROQ_API_KEY`) |
| `/api/process-note` | Extract CRM JSON; create task when `due_date` present |

## Pipeline stages

`cold_lead` → `contacted` → `meeting` → `negotiation` → `won` / `lost`

## Repository

https://github.com/lockerslab/CRM-Voz
