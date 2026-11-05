# Ads engine

A network of websites that we grow with paid ads and earn from through sponsors and ad revenue. These mockups show the screens a user works in to run the network.

## Language

### The network

**Site**:
One website in the network. It is the "product" we invest in and earn from.
_Avoid_: Product, property, domain, website (in labels)

**Network**:
All sites together. The mockup data has 200 sites.
_Avoid_: Portfolio (except in "portfolio contribution" until that is defined)

**Site state**:
Where a site is in its life: Building (not live yet), Live (ads running), Paused (site up, ads off) or Retired (closed). "Start/stop" moves a site between Live and Paused.

**Contribution**:
The money a site adds after its costs. The exact formula is not agreed yet, so it shows as a placeholder.

### Grouping sites

**Site kind**:
What a site is about at the highest level. The list is open; today it is:
- **Local**: one town or city (MedfordVoices.com). Every Local site has a **size**, Town or City.
- **Region**: an area bigger than a town, such as Cape Cod or the Algarve.
- **Topic**: an interest or hobby, such as guitar, fishing or concerts.
- **Person**: a well-known person, such as Elon Musk.
- **Institution**: a university, sports team, hospital or museum, such as MIT.
- **Event**: a recurring event, such as Glastonbury or the Boston Marathon.
_Avoid_: Site type, local market

**Group**:
A second level under the kind, for Topic, Person, Institution and Event sites: Music or Outdoors for a topic, Sports or Tech for a person, University or Sports team for an institution. Local and Region sites have no group.
_Avoid_: Vertical, category, niche

**Domain type**:
How a site's web address is built: Voices name (the subject plus "Voices", such as guitarvoices.com), exact-match (the address is the search phrase, such as whatsonmedford.com), brand name, or country ending (such as sintra-hoje.pt). Voices name is the most common, but only one style among several.

**Country**:
The country a site serves.
_Avoid_: Geo, market (on its own)

**Region**:
The state, county or region inside a country, such as Massachusetts or Lombardy. Local, Region, Institution and Event sites have one; Topic and Person sites serve the whole country and have none.
_Avoid_: Area, state (on its own; "state" is a site's life stage)

**Launch cohort**:
The quarter a site went live, such as "2026 Q1". This is the only meaning of "cohort".
_Avoid_: Cohort (for any other grouping)

**Peer group**:
The sites that share a site's tags (site kind, group, domain type, country, region), used as its comparison baseline.
_Avoid_: Cohort, segment

### Money in and out

**Ad platform**:
A service we buy ads on. Google Ads is live; Meta is planned and shows sample data for now.

**Campaign type**:
Google Ads' own campaign kinds: Search, Performance Max, Display or Demand Gen. A site has one to three campaigns.
_Avoid_: Medium, channel (for this meaning)

**Ads on**:
Which ad platforms are running on a site right now: Both, Google Ads only, Meta only or No ads. A platform counts only if at least one of its campaigns is running.

**Ad set**:
Meta's level between a campaign and its ads. It holds the audience, schedule and bidding, and usually the budget. Google Ads has no direct equal.
_Avoid_: Ad group (that's Google Ads)

**Learning**:
Meta's period of working out who to show an ad set to, until it gets about 50 results in the week after its last major edit. An ad set unlikely to get there is **learning limited**.
_Avoid_: Calibration

**Major edit**:
A change that can restart learning: pausing an ad set, or changing its goal, audience or ads. A large budget or bid change can count too.
_Avoid_: Significant edit (in labels)

**Frequency**:
How many times the average person saw an ad. A high number suggests the ad may be wearing out.

**Ad template**:
One Meta ad layout per site kind, filled in with each site's details.
_Avoid_: Creative (for the template itself)

**Result**:
What an ad platform counts as success. Each platform counts its own, so results are shown side by side and never added together. Meta's goal isn't decided; visits stand in for now.

**Sponsor**:
A business that pays a fixed monthly fee for a spot on a site.
_Avoid_: Advertiser, partner, client

**Spot**:
A place on a site that can be sold to a sponsor: Homepage banner, Featured listing, Sidebar spot or Newsletter mention. A site's unsold spots are its **inventory**.
_Avoid_: Placement (except in "placement delivery"), slot

**Hold**:
A spot taken off the market for one named sponsor until a set date, so nobody sells it twice while that sponsor decides. When the date passes the spot is free again. Placing a hold is "reserving" the spot.
_Avoid_: Reservation, booking, option

**Placement delivery**:
Whether a sold spot actually ran as the deal promised over a period: the days it was live, what it delivered (impressions, newsletter sends or days listed) against what was promised, and the proof kept. A spot that delivered under 95% of the promise is **under-delivered**; one with no proof yet is **not checked**. "Placement delivery" is the only place the word placement is used.
_Avoid_: Fulfilment

**Lead evidence**:
The proof we sent a sponsor customers: clicks on the sponsor's tracked link, calls to the sponsor's tracking number and enquiry forms passed on. A **lead** is a call or a form; a click alone is not a lead. A **lead report** is the summary we send the sponsor.
_Avoid_: Conversions (that word belongs to Google Ads)

**Sponsor funnel**:
The stages a sponsor deal moves through: Prospect, Contacted, Offer sent, Negotiating, Signed, Active, Up for renewal.
_Avoid_: Pipeline (except in "sponsor pipeline" on a site)

**Budget move**:
A suggestion from the system to shift budget from a weaker campaign to a stronger one on the same site. A user approves or rejects each one.
_Avoid_: Bandit action (in labels)

**Test**:
A controlled change to one thing on one site (budget, landing page or ad text), with a start date, end date and result.
_Avoid_: Experiment (in labels)

**AdSense revenue**:
Money earned from Google ads shown on our sites. Sponsors and AdSense are the only revenue sources for now.

**Qualified visits**:
Site visits that are worth something, not bots or instant exits. The exact rule is decided later with the backend.
_Avoid_: Qualified traffic, sessions

All money is shown in EUR.

### Trusting the numbers

**Event provenance**:
Where a number came from: which data source, for which period, when it was last updated, and how it was calculated if it is not read directly. Shown by clicking the number itself, not on a separate page.
_Avoid_: Lineage, audit trail

**Data source**:
A system we read numbers from: Google Ads, Google Analytics, AdSense, Search Console or invoicing. Proof checks and tracked links also feed some sponsor numbers.

**Sync**:
One run that reads new data from a data source. A sync can succeed, bring nothing new, or fail.

**Freshness**:
How recently a data source last brought data. A source is *late* when that is longer ago than usual for it, and *failed* when its last sync did not work; the numbers then still show the last good data.

**Activity log**:
The history of one site: syncs (including failures), what people did (paused a campaign, changed the cap, reserved a spot, approved a discount, sent a lead report) and what the system suggested and who approved or declined it.
_Avoid_: Audit log, history

**Test account**:
A Google Ads account that accepts every change but never shows ads, so it can't spend money. Used to check that the dashboard's actions work before connecting a real account.
_Avoid_: Sandbox, demo account

**API check**:
A test run of every Google Ads action the dashboard needs, showing what Google answered for each one. On a live account it only reads and makes paused changes.

**Live mode**:
The dashboard connected to real Google Ads accounts, where a running campaign spends real money. Only accounts on an approved list are touched, and switching a campaign on needs a typed confirmation.
_Avoid_: Production mode, real mode

**Monthly cap**:
The most an account may spend in a calendar month. The dashboard enforces it itself. On Google Ads it lowers daily budgets as spend nears the cap and pauses campaigns when it is reached. On Meta it warns first and pauses only at the cap, so ordinary days don't cause major edits.

**Site cap**:
The most one site may spend in a month across all ad platforms. On a site with Meta, part of it is set aside as Meta's limit and Google Ads can use the rest.
_Avoid_: Budget (that's per day)

### People

**User**:
Anyone using the dashboard. What they may do depends on their role.
_Avoid_: Operator (for a person)

**Role**:
The permission level a user has: Viewer, Operator, Manager or Admin. This is a first draft and may change.

- **Viewer**: sees everything, changes nothing.
- **Operator**: pauses or restarts a campaign, retires a creative, creates a sales task, approves sponsor discounts up to 10%.
- **Manager**: everything an Operator can do, plus changes caps, starts tests, approves system budget moves, approves discounts up to 25%, starts or stops outreach.
- **Admin**: everything, plus the global pause.
