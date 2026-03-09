# AiLA — DSAR Redaction Review (Prototype)

Split-screen redaction review UI prototype. Built with Vite + React.

## Deploy to Vercel

1. Push this folder to a new GitHub repo
2. Connect repo to Vercel (vercel.com → Add New Project)
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy

Suggest hosting at: `dsar-review.trustaila.com`

## Local development

```
npm install
npm run dev
```

## What this demonstrates

- Split-screen layout: source document (left) + decision cards (right)
- PII entities highlighted in document with colour-coded decisions
- Click any highlight → jumps to card; click card → highlights in document
- Decisions: Redact / Include / Partial / Withhold
- Progress tracking and pending count
- Two source tabs: Original Request / Email Archive
- Summary footer showing decision counts
- All mock data — no backend required

## What the real implementation needs from Daniel

One additional API endpoint:
`GET ?handler=DsarSourceText&dsarRequestId={id}`

Returns the source text(s) for the DSAR. The entity offsets
already stored in MongoDB map directly onto this text to
place highlights. No other backend changes required.
