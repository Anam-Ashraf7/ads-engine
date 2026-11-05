# Ads engine mockups (PROTOTYPE)

Clickable mockups of the Ads engine dashboards. Everything is made-up sample data for 200 sites, and buttons only change things in the browser until you reload. The one exception is the **API check** page and the **Live test account** card on Campaigns, which call the real Google Ads API on a *test* account (see below).

Words used on the screens are defined in [CONTEXT.md](CONTEXT.md). Product facts are in [PRODUCT.md](PRODUCT.md).

## Run it

```
npm install
npm run dev
```

Open http://127.0.0.1:5180

## Google Ads test-account wiring

A small local server (`server/gads-server.mjs`, plain Node, no extra packages) sits between the mockup and the Google Ads API v25. It is wired to a Google Ads **test** account: test accounts accept every change but never show ads, so nothing can be spent.

```
npm run dev:live     # Google Ads test server on :5190 + the mockup on :5180
```

Then open http://127.0.0.1:5180/api-check and press **Run all checks**, or use Pause / Restart / Budget on the **Live test account** card at the top of Campaigns. `npm run server` starts only the API server; the mockup proxies `/api/*` to it.

- **Config:** `server/.env.local` (OAuth client file, refresh-token file, `MODE`, manager and client account IDs, port). Copy `server/.env.example` to start. The refresh token lives in `server/.secrets/`. Both are git-ignored and never sent to the browser; replies are scrubbed of secrets.
- **Safety, enforced in code:** the server only starts if both accounts report `test_account = true`, and checks again before every change; daily budgets above $5 are refused; created campaigns are always paused; everything created is named `ae-apitest-…`, and cleanup only removes those.
- **What a test account can't show:** spend, clicks, conversions and Quality Score stay at zero because the ads never run. Real numbers need a real account, which needs Explorer or Basic API access for the Cloud project.
- **Saved login expired?** (`invalid_grant`): run `npm run login`, sign in, then start `npm run dev:live` again.

## Hosting on Render

One web service runs both the dashboard and the API (`render.yaml`). `npm run login` still runs on a laptop: it saves a Google login once, and that file is uploaded to Render.

- **Build:** `npm ci --include=dev && npm run build`. **Start:** `node server/gads-server.mjs`. **Root Directory:** empty.
- **Environment variables:** `NODE_VERSION=22`, `AE_ENV_FILE=/etc/secrets/server.env`, `AE_LOGIN_PASSWORD` (12+ characters), `AE_SESSION_SECRET` (32+ random characters). The server refuses to start on Render without the last two.
- **Secret files:** `server.env` (settings from `server/.env.example`, with `CLIENT_FILE=/etc/secrets/client.json` and `TOKEN_FILE=/etc/secrets/refresh-token`), `client.json`, `refresh-token`.
- **Login:** the name is `admin` (`AE_LOGIN_NAME` changes it). The server checks the password and every `/api` route needs its cookie. Locally, with no password set, there is no login.
- **Live mode needs a paid instance:** free instances sleep after 15 minutes with no visitors, and the spending cap doesn't run while asleep. Logs in `server/logs` are lost on restart without a persistent disk.

## Switching to a real account (live mode)

The same server has a **live mode** for real Google Ads accounts. It touches nothing until you list an account.

**1. Google settings (you)**
1. Cloud Console → project → **Google Auth Platform → Audience → Publish app** ("Testing" → "In production"). While in Testing, Google's saved login expires every 7 days.
2. Cloud Console → **APIs & Services → Google Ads API → Overview**: check the access level. If it says Test, apply for **Explorer** there (automated review). Explorer allows real accounts at 2,880 operations a day but blocks the planning tools (keyword ideas) on them; those need Basic, which needs brand verification first.
3. Get a real Google Ads account: either ask the company account's owner to add your Google user (Standard or Admin access), or create a new one (not a test account). Billing is only needed when ads should actually run.

**2. Edit `server/.env.local`**
```
MODE=live
LIVE_CUSTOMER_IDS=123-456-7890        # the real account(s), comma-separated; everything else is refused
LIVE_LOGIN_CUSTOMER_ID=               # only if you reach them through a manager account
MAX_DAILY_BUDGET=10                   # in the account's currency
MONTHLY_CAP=20                        # per account, per month
```
Leave the test lines (`MANAGER_ID`, `CUSTOMER_ID`) as they are; set `MODE=test` to go back.

**3. Start**
```
npm run login        # once more after publishing the app, signed in as the user with access
npm run dev:live
```
The terminal prints each allowed account and whether it's a real or a test account. Every page then shows a red **LIVE ACCOUNT · real money** strip.

**4. Test in this order**
1. **Read only:** API check → *Run read + paused checks*. Reads campaigns, spend, ads, keywords, conversions; dry-runs the cap. Free.
2. **Paused changes:** the same run creates one paused `ae-live-…` campaign and changes its budget. Check it in Google Ads. Still free.
3. **Small spend:** on Campaigns → Live account, *Restart* a campaign at 3–5 a day. You must type its name to confirm. Watch *Last cap check* and `server/logs/cap-YYYY-MM.jsonl`.

**What live mode enforces (in the server, not the screen):** only the listed accounts; new campaigns always paused; switching on or scheduling an experiment needs a typed confirmation and is refused once the monthly cap is reached; budgets above `MAX_DAILY_BUDGET` refused; clean up and every remove disabled (403). The monthly cap runs on its own every `CAP_EVERY_HOURS` (default 2): it keeps the running campaigns' daily budgets at or below remaining ÷ (days left + 1), leaving room for a day of Google's 2× overspend, and pauses every running campaign at the cap. Each decision is logged to `server/logs/`.

## Meta ads (ready, switched off)

The Meta connection is built and off. While `META_ENABLED` is unset, the server exposes only a "not connected" status and the Campaigns screen looks as before. Code: `server/meta.mjs`, `src/live/MetaCampaigns.tsx`. Tests: `npm run test:meta`. **It has only run against a fake Meta; nothing has been sent to the real one yet.**

**1. Meta settings (you)**
1. Create an app at developers.facebook.com and add the Marketing API use case ("Create & manage ads"). For your own ad accounts, standard access to `ads_read` and `ads_management` is enough.
2. **Test first with a sandbox account:** app dashboard → Quickstart → Create an Ad Campaign → **Create Sandbox Ad Account**. It needs no payment method and its ads never run. Generate its token in the same place (valid 2 months).
3. Save the token, alone, in `server/.secrets/meta-token`.

**2. Edit `server/.env.local`**
```
META_ENABLED=true
META_MODE=sandbox
META_AD_ACCOUNT_IDS=act_123456789     # everything else is refused
META_TOKEN_FILE=.secrets/meta-token
META_PAGE_ID=123456789                # the Facebook Page ads run under; needed to create an ad
META_MAX_DAILY_BUDGET=10
META_MONTHLY_CAP=20
```
Then `npm run dev:live`. Campaigns shows a **Meta ad account** box: *New paused campaign*, *Switch on*, *Pause*, *Budget*, *Run cap check now*.

**3. Going live**
1. List the real ad account and set `META_MODE=live`. Meta has no field saying an account is a sandbox, so the server can't tell: the allowlist is the guard.
2. Use a system-user token (Business Manager): built for servers, 60-day or non-expiring.
3. Apply for the **Full** Marketing API tier (App Review). The default Limited tier is "for development only", not for production apps running for live advertisers.

**What the server enforces:** only listed accounts, including campaigns reached by ID; everything created paused; switching on needs a typed confirmation and is refused at the cap; budgets above the maximum refused; no delete step. The monthly cap is ours, as we found no monthly limit field at Meta: every 2 hours it reads this month's spend and keeps running daily budgets at or below what's left ÷ (1.75 × days left), and pauses at the cap. If Meta refuses a lower budget, that campaign is paused instead. The 1.75 is the worst figure Meta publishes: its [pricing page](https://www.facebook.com/business/ads/pricing) says up to 75% over a daily budget, its [developer docs](https://developers.facebook.com/docs/marketing-api/bidding/overview/budgets) say 25%. Decisions are logged to `server/logs/meta-cap-YYYY-MM.jsonl`. If the token expires, the cap check fails and logs an error, but it can't pause anything, so pause in Ads Manager and renew the token.

**To confirm on the first sandbox run** (the docs don't settle these): that `spend` in Insights is in whole currency units, not cents; that Meta accepts `is_adset_budget_sharing_enabled=false` on the campaign as sent; Meta's minimum daily budget; whether sandbox insights return mock numbers through the same fields.

**Sources:** [authorization and tiers](https://developers.facebook.com/docs/marketing-api/get-started/authorization) · [campaigns](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/) · [ad sets](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/) · [creatives](https://developers.facebook.com/docs/marketing-api/get-started/basic-ad-creation/create-an-ad-creative/) · [ads](https://developers.facebook.com/docs/marketing-api/get-started/basic-ad-creation/create-an-ad/) · [ad accounts](https://developers.facebook.com/docs/marketing-api/reference/ad-account/) · [insights](https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/) · [currencies](https://developers.facebook.com/docs/marketing-api/currencies) · [sandbox accounts](https://developers.facebook.com/documentation/development/create-an-app/marketing-api-use-cases) · [system-user tokens](https://developers.facebook.com/docs/marketing-api/system-users/install-apps-and-generate-tokens/) · [errors](https://developers.facebook.com/docs/graph-api/guides/error-handling/) · [rate limits](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/) · [versions](https://developers.facebook.com/docs/graph-api/changelog/)

## Look

One look: **Standard**, a clean, conventional analytics dashboard. (The earlier "Survey" land-plan look was dropped on 2026-10-23.)

Layout A of the Network screen opens with **Sites at a glance**: every site is a tile, its size is ad spend, its colour is money earned or lost per €1 spent, and its pattern shows its state (striped = paused, outlined = building, struck through = retired). The card has a **Hide** button; the choice is remembered in the browser.

## Sample sites

The 200 sites use real places, interests, people and institutions in Portugal, Spain, Italy, the UK and the US: 100 Local (75 towns, 25 cities, including MedfordVoices.com), 10 Region, 45 Topic, 20 Person, 15 Institution and 10 Event. Most addresses are Voices names (guitarvoices.com); the rest are exact-match, brand or country-ending addresses. Kinds, groups and regions are defined in [CONTEXT.md](CONTEXT.md).

## Screens

| Screen | Address |
|---|---|
| Network, 3 layouts to compare | `/?variant=A` (site tiles + table), `/?variant=B` (peer groups), `/?variant=C` (exceptions first). Flip with the orange bar or the arrow keys. |
| One site | Click any site or tile. On a site, J / K jump to the next / previous site. |
| Campaigns | `/campaigns` |
| Sponsors and revenue | `/sponsors`: pipeline, placement delivery, lead evidence, and inventory (reserve a spot) |
| API check (test tool) | `/api-check`: runs every Google Ads operation against the test account. `?run=all` starts a full run on load. Needs `npm run dev:live`. |

**Where numbers come from.** The line under the top bar shows how fresh each data source is (green up to date, amber late, red last sync failed); click a source to see its recent syncs. Underlined numbers open a small panel with what the number means, its source, period, last update and, for calculated numbers, the formula with the actual values. Each site page ends with its **Activity** log (data / people / system); changes you make in the mockup appear there as "You · just now". Sync times and delays are sample values. For screenshots, `?explain=contribution` opens a number's panel and `?source=invoicing` a source's panel on load.

The top bar also has the date range (7/30/90 days), a **Role** switcher (Viewer, Operator, Manager, Admin) showing which buttons each role can use, and the Admin-only global pause.

## Open points

- "Contribution" is a placeholder (revenue minus ad spend) until the formula is agreed.
- Qualified visits, alert rules and the backend (DBviewer) are decided later.
