# NutriSnap

Photograph your meals; see calories, macros, vitamins and minerals add up through the day; get practical
suggestions (portion changes, swaps that fit your diet, budget and tastes, and when to eat). Web, iOS and Android,
deployed automatically from GitHub.

```
apps/web         Next.js web app (static, talks directly to Supabase)
apps/mobile      Expo / React Native app for iOS and Android
packages/shared  Targets, aggregation, suggestion engine, typed data API (used by both apps)
supabase/        Postgres schema + row-level security, private photo storage, edge functions
scripts/         Database security test (runs in CI)
.github/         CI on every PR; deploy on push to main / version tag
```

## How it works

1. **Photo.** The app resizes the photo to ≤1600 px and re-encodes it as JPEG, which strips EXIF metadata including GPS.
   It's uploaded to a private bucket under `<user_id>/`.
2. **Analysis.** The `analyze-meal` edge function sends the photo to Claude (vision). Claude identifies each food,
   estimates the portion in grams and estimates its nutrients.
3. **Nutrient data.** Each food is looked up in USDA FoodData Central and scaled to the portion. If the database match
   disagrees wildly with what's on the plate (common for mixed regional dishes), Claude's estimate is kept. Every item shows its
   source (*USDA data* or *AI estimate*), and users can correct any portion; nutrients rescale automatically.
4. **Targets.** Mifflin–St Jeor resting energy × activity, ±goal (never below resting energy), protein 1.2–1.6 g/kg,
   micronutrients from the US/Canada Dietary Reference Intakes by age and sex. Sodium, sugar and saturated fat are ceilings.
5. **Suggestions.** A rule engine in `packages/shared/src/suggestions.ts` runs instantly on every change:
   calorie pacing for the time of day, cut the dominant item's portion, protein gaps, carb overshoot, swaps for specific
   foods (filtered by diet, budget, tastes and "never suggest" list), sodium/sugar/sat-fat limits, evening micronutrient
   gaps (with a vitamin D note for northern latitudes) and meal timing (late heavy meals, long gaps, evening-loaded days).

## Coach chat

The **Coach** tab (web and mobile) is a chat for in-the-moment decisions: "I feel like a cappuccino",
"I'm getting cookies at Tim Hortons", "what should I have for dinner?".

- The app sends a compact summary of today with each message (eaten vs. target, macros, low nutrients, meals so far,
  the rule engine's notes); see `buildCoachContext()` in `packages/shared/src/coach.ts`. Diet, budget, tastes and
  foods to avoid are read from the database by the `coach-chat` function.
- Claude replies with a short message, 2–5 **option cards** (as usually ordered, a lighter version, a swap, a
  healthy pick) with approximate calories and macros, and a "next time" tip. **Log this** adds an option to today
  as an AI-estimate item.
- The last 16 turns are sent as conversation memory. Users can clear the chat any time; it's included in data export and
  deleted with the account.
- Guardrails in the system prompt: no shaming, no medical advice, no compensatory restriction, and a supportive response
  with the NEDIC helpline if someone describes disordered eating. It stays on food topics.
- Cost control: `COACH_DAILY_LIMIT` messages per user per 24 h (default 60). `COACH_MODEL` can point the coach at a
  cheaper model than photo analysis.

Chain-menu calories come from the model's knowledge and are labelled as estimates. Adding a nutrition database for
Canadian chains would make them exact.

## Privacy and security

| Concern | What's in place |
|---|---|
| Users seeing each other's data | Row-level security on every table, view and the photo bucket. `pnpm test:db` proves it on every PR. |
| Photo location data | Stripped on device before upload (web: canvas re-encode; mobile: expo-image-manipulator). |
| Photo access | Private bucket; photos are only served through signed URLs that expire after 10 minutes. |
| Data residency | Supabase project in **Canada (Central), `ca-central-1`**. The web host only serves static files; no user data passes through it. |
| Third-party processing | Each photo and each coach message (with today's intake summary) is sent to Anthropic's Claude API (outside Canada). Users are told this at onboarding and on the Profile page. USDA lookups send only a generic food name. |
| Coach history | Readable and deletable only by its owner; only the server can write turns, so a client can't inject fake coach replies. |
| Tokens on phones | Stored in iOS Keychain / Android Keystore (`expo-secure-store`), not plain storage. |
| Web hardening | CSP, HSTS, `X-Frame-Options: DENY`, no third-party scripts or fonts. |
| Access and deletion (PIPEDA) | *Download my data* exports everything as JSON; *Delete my account* removes the account, all rows (cascade) and all photos. |
| Minors | Database rejects profiles under 18. |

Before launch, write a privacy policy (required by both app stores) that covers the points above.

## One-time setup

You'll need accounts with: **GitHub**, **Supabase**, **Vercel**, **Expo**, **Anthropic** (API key),
**data.gov** (free USDA key), **Apple Developer** and **Google Play Console**.

### 1. Supabase
1. Create a project and choose region **Canada (Central)**.
2. Under Authentication → URL configuration, add your web URL and `nutrisnap://auth-callback`.
3. Note the project ref, URL, anon key, and database password, and create an access token (Account → Access tokens).

### 2. Vercel
1. Import the repo, set **Root directory** to `apps/web`, framework Next.js.
2. Add env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production).
3. Run `vercel link` locally once to get the org and project IDs (in `.vercel/project.json`), and create a token.

### 3. Expo / EAS
```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init                      # prints the project ID
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR.supabase.co --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_ANON_KEY --visibility plaintext
npx eas-cli env:create --environment production --name EAS_PROJECT_ID --value YOUR_PROJECT_ID --visibility plaintext
npx eas-cli credentials               # lets EAS manage iOS certificates and the Android keystore
```
Set your own `IOS_BUNDLE_ID` / `ANDROID_PACKAGE` (EAS env vars) if you don't want `com.nutrisnap.app`.
For store submission, connect your App Store Connect API key and a Google Play service-account key in EAS (`eas credentials`).
Do the first Play Store upload by hand. Google requires it before API submissions work.

### 4. GitHub secrets
Settings → Environments → create `production`, then add:

| Secret | From |
|---|---|
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | Supabase |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase → API settings |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `USDA_API_KEY` | api.data.gov/signup |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Vercel |
| `EXPO_TOKEN`, `EAS_PROJECT_ID` | expo.dev → Access tokens; `eas init` |

## Deploying

| You do | What happens |
|---|---|
| Open a pull request | Unit tests, database security checks, typecheck, web build, iOS + Android bundle, edge-function typecheck |
| Merge to `main` | Same checks → DB migrations + edge functions → web to Vercel → over-the-air update to installed apps |
| Push a tag, e.g. `git tag v0.2.0 && git push --tags` | All of the above + new iOS/Android binaries built on EAS and submitted to App Store / Play (internal track) |

Changing native config (permissions, new native packages, app icon) needs a tagged release; plain JavaScript/UI
changes reach phones through the over-the-air update.

## Local development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local       # fill in Supabase URL + anon key
cp apps/mobile/.env.example apps/mobile/.env
pnpm dev:web                                       # http://localhost:3000
pnpm dev:mobile                                    # scan the QR with a development build
pnpm test && pnpm test:db && pnpm typecheck
```
Local Supabase (optional): `supabase start`, then `supabase functions serve --env-file supabase/.env`.
The camera and image manipulator need a development build (`eas build --profile development`), not Expo Go.

## Running costs (rough, CAD)

| Item | Approx. |
|---|---|
| Claude Sonnet 5.5 per photo (~2.5k tokens in, ~600 out) | ~$0.015 per photo, so ~$1.80 per active user per month at 4 photos/day |
| Claude Sonnet 5.5 per coach message (~2k tokens in, ~500 out) | ~$0.013 per message, so ~$1.20 per active user per month at 3 messages/day |
| Supabase Pro (needed beyond the free tier's limits) | ~$35/month |
| Vercel Pro (Hobby is non-commercial only) | ~$28/month per seat |
| Apple Developer Program | ~$137/year |
| Google Play developer account | ~$35 one-time |

Converted from USD at roughly 1.38. Check each provider's current pricing before budgeting.
To cut photo cost, set `ANTHROPIC_MODEL=claude-haiku-5-5` on the edge function and compare accuracy on your own meals.

## Known limits and next steps

- **Canadian Nutrient File** lookup isn't wired in yet; USDA plus Claude's estimate covers it for now. Add it in
  `supabase/functions/analyze-meal` as a first lookup for users in Canada.
- Portion estimates from a single photo are approximate (typically ±20–30%). The "Anything the photo won't show?" note
  and editable grams are the correction path.
- Barcode scanning, manual food search, reminders/push notifications, and an AI-written weekly review are natural next features.
- Targets are general-population guidance for adults, not medical advice; people with medical conditions or who are
  pregnant should get targets from a clinician.
