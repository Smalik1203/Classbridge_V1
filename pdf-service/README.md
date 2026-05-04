# ClassBridge PDF Service

Renders pixel-perfect A4 PDF report cards using Puppeteer. Deploys to Railway.

## What it does

Single endpoint: `POST /render-report-card`

```
{ "termReportId": "uuid", "studentId": "uuid" }
```

The service:
1. Validates the user's Supabase JWT (forwarded via `Authorization: Bearer <token>`)
2. Re-fetches all report data server-side (RLS scopes by school_code)
3. Detects whether the term_report is "annual" (sources are themselves term_reports)
4. Renders the right Handlebars template (term layout vs St George annual layout)
5. Puppeteer prints to A4 PDF
6. Returns `application/pdf`

## Local development

```bash
npm install

# Required env vars
export SUPABASE_URL="https://YOURPROJECT.supabase.co"
export SUPABASE_ANON_KEY="..."
export ALLOWED_ORIGIN="http://localhost:5173"  # your frontend dev origin

npm run dev
```

The service binds to `:3000` by default.

## Test with curl

```bash
TOKEN="$(...your supabase JWT...)"

curl -v -X POST http://localhost:3000/render-report-card \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"termReportId":"<uuid>","studentId":"<uuid>"}' \
  --output report.pdf
```

## Docker build

```bash
docker build -t classbridge-pdf .
docker run --rm -p 3000:3000 \
  -e SUPABASE_URL=... \
  -e SUPABASE_ANON_KEY=... \
  -e ALLOWED_ORIGIN="*" \
  classbridge-pdf
```

## Railway deploy

1. Create a new Railway service.
2. Set the **Service Source** to this repository.
3. Under **Settings → Build**, set **Root Directory** to `pdf-service`. Railway will pick up `Dockerfile` and `railway.toml` automatically.
4. Add env vars under **Variables**:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `ALLOWED_ORIGIN` (your frontend URL, e.g. `https://app.yourschool.com`)
5. Deploy. Railway gives you a public URL like `https://pdf-service-XXXX.up.railway.app`.
6. Add `/health` to the URL to verify (`{"ok": true, ...}`).

## Frontend integration

In the React app, set:
```
VITE_PDF_SERVICE_URL=https://pdf-service-XXXX.up.railway.app
```

The `Download PDF` button posts to `${VITE_PDF_SERVICE_URL}/render-report-card`
with the user's Supabase JWT and a JSON body.

## Cost

Railway Starter is ~$5/mo. Each PDF render takes ~500ms warm, ~1.5s cold. Container
idles at ~150MB RAM, peaks at ~700MB during render. Single instance handles
~10 concurrent renders comfortably.

## What's not included (yet)

- CCA grades, attendance days, height/weight — currently render as empty cells in the annual template (matches St George template behavior). Wire these once we have data tables.
- Caching of generated PDFs — every request re-renders. Easy to add a Supabase Storage cache keyed by `(term_report_id, student_id, published_at)` if needed.
- Watermark — easy to add via CSS `::before` on `.page` if the school has a crest image.
