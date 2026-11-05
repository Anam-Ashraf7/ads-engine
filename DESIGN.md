---
name: Ads engine
description: One calm, dense view of a network of ~200 small sites, judged by money in vs money out, where every number can say where it came from.
colors:
  accent-blue: "#2563eb"
  accent-blue-deep: "#1d4ed8"
  accent-wash: "#eef3ff"
  ok-green: "#15803d"
  ok-wash: "#e8f7ee"
  warn-amber: "#b45309"
  warn-wash: "#fff5e1"
  danger-red: "#dc2626"
  danger-red-deep: "#b91c1c"
  danger-wash: "#fdeeee"
  chart-amber: "#f59e0b"
  chart-emerald: "#10b981"
  chart-violet: "#8b5cf6"
  chart-pink: "#ec4899"
  ground: "#f6f7f9"
  surface: "#ffffff"
  surface-shade: "#f9fafb"
  hover-grey: "#f3f4f6"
  muted-wash: "#f1f2f4"
  border: "#e5e7eb"
  border-strong: "#d1d5db"
  ink: "#111827"
  ink-secondary: "#4b5563"
  ink-tertiary: "#6b7280"
  rail-ink: "#374151"
  tile-stripe-light: "#eef0f3"
  tile-stripe-dark: "#e2e5ea"
  tile-building: "#fafbfc"
  tile-building-line: "#d6dae0"
typography:
  headline:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  figure:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
  title:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 620
    lineHeight: 1.25
  body:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  small:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11.5px"
    fontWeight: 620
    lineHeight: 1.45
  axis:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "10.5px"
    fontWeight: 400
    fontFeature: "'tnum' 1"
  mono:
    fontFamily: "ui-monospace, Cascadia Mono, SF Mono, Menlo, Consolas, monospace"
    fontSize: "12px"
rounded:
  swatch: "3px"
  sm: "6px"
  md: "10px"
  capsule: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  button-default-hover:
    backgroundColor: "{colors.hover-grey}"
  button-primary:
    backgroundColor: "{colors.accent-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  button-danger:
    backgroundColor: "{colors.danger-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  button-ghost:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  button-small:
    rounded: "{rounded.sm}"
    padding: "0 9px"
    height: "26px"
  segmented-option-on:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-blue}"
    padding: "0 11px"
    height: "30px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  filter-set:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-blue}"
    rounded: "{rounded.sm}"
    height: "32px"
  nav-item:
    textColor: "{colors.rail-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  nav-item-active:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-blue-deep}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  kpi-cell:
    backgroundColor: "{colors.surface}"
    typography: "{typography.figure}"
    padding: "14px 16px"
  table-header:
    backgroundColor: "{colors.surface-shade}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    padding: "8px 10px"
  table-row-selected:
    backgroundColor: "{colors.accent-wash}"
  pill-ok:
    backgroundColor: "{colors.ok-wash}"
    textColor: "{colors.ok-green}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "20px"
  pill-warn:
    backgroundColor: "{colors.warn-wash}"
    textColor: "{colors.warn-amber}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "20px"
  pill-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger-red}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "20px"
  pill-info:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-blue-deep}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "20px"
  pill-muted:
    backgroundColor: "{colors.muted-wash}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "20px"
  freshness-strip:
    backgroundColor: "{colors.surface-shade}"
    typography: "{typography.small}"
    padding: "5px 24px"
  freshness-source:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.capsule}"
    padding: "0 8px"
    height: "24px"
  number-popover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
    width: "360px"
  pause-banner:
    backgroundColor: "{colors.danger-red}"
    textColor: "{colors.surface}"
    padding: "9px 24px"
  tile-paused:
    backgroundColor: "{colors.tile-stripe-light}"
  tile-building:
    backgroundColor: "{colors.tile-building}"
  tile-retired:
    backgroundColor: "{colors.hover-grey}"
    textColor: "{colors.ink-tertiary}"
  tile-deep-gain:
    backgroundColor: "{colors.ok-green}"
    textColor: "{colors.surface}"
  tile-deep-loss:
    backgroundColor: "{colors.danger-red-deep}"
    textColor: "{colors.surface}"
---

# Design System: Ads engine

## Overview

**Creative North Star: "The Clear Ledger"**

A plain, well-kept operations ledger for a network of about 200 sites. White cards on a cool light-grey ground, one blue accent, Inter throughout, and a dense 13px body so a whole network fits in one scroll. Nothing is ornamental: colour is spent on money (green for gain, red for loss), on state, and on selection, and almost everywhere else the screen is grey ink on white.

The system's character comes from accountability rather than decoration. Every important figure can be clicked to show its formula, inputs, period and sources; a freshness strip under the top bar shows how old each data source is; a site's activity log shows who and what changed it. Underlined numbers, health dots and the log are the visual signature, more than any colour or shape.

One look ships. The tokens on `:root[data-skin='standard']` in `src/styles.css` are the system and the app pins `data-skin="standard"` at start-up. (Historical note: an earlier "Survey" look, a drafting-film estate plan in Archivo, was retired in October 2026; its CSS remains in the stylesheet but nothing can reach it.)

**Key Characteristics:**
- Light-grey ground (ground), white cards (surface) with a soft two-layer shadow, 10px card corners and 6px control corners.
- A single blue accent for action, selection, focus and links; status colours never stand in for selection.
- Green and red carry money: positive and negative changes, gain and loss tiles, contribution totals.
- Inter Variable at 13px body; tabular figures on every number, right-aligned in tables.
- Click-a-number provenance: dotted-underlined figures open a details popover with formula, period and sources.
- Responsive by reflow, not by hiding data: the rail becomes a scrolling row, filters fold, tables become labelled cards on phones.

## Colors

A neutral grey ladder on white, one blue for intent, and a green/amber/red status set, each paired with a pale wash.

### Primary
- **Action Blue** (accent-blue): primary buttons, the on state of tabs (text and 2px underline), sort arrows, focus outline (2px, 2px offset), links, text selection, checkbox accent, the set state of filters, the popover's open-number underline and the bars inside popover breakdowns. The brand mark's four rects fill with it at 100/45/75/45% opacity.
- **Deep Action Blue** (accent-blue-deep): active rail item text and info pills.
- **Accent Wash** (accent-wash): active rail item, the on option of a segmented switch, selected table rows, selected funnel step, set filters, info pills.

### Secondary
- **Gain Green** (ok-green): positive changes, contribution above zero, the "Live" and "Low risk" states, healthy source dots, the deepest gain tile. Paired with **Ok Wash** (ok-wash) for pills and sold sponsor spots.
- **Loss Red** (danger-red): negative changes, losses, critical alerts, the rail's alert count, failed syncs, the global pause action and banner. Paired with **Danger Wash** (danger-wash) for pills.
- **Deep Loss Red** (danger-red-deep): the solid fill for tiles losing €0.75 or more per €1 spent.

### Tertiary
- **Warning Amber** (warn-amber on warn-wash): warnings, "Paused" pills, late sources, the "formula to be agreed" pill, the "Mockup · sample data" tag.
- **Chart series** (accent-blue, chart-amber, chart-emerald, chart-violet, chart-pink): the five series colours `--c1`…`--c5`, used only inside charts and sparks. chart-violet also marks System entries in the activity log.

### Neutral
- **Ground** (ground): the page behind everything.
- **Surface** (surface): cards, top bar, rail, inputs, popover, modal; also the ink on accent, danger and deep tile fills.
- **Surface Shade** (surface-shade): table headers, the freshness strip, the tile readout strip, sub-rows, funnel steps.
- **Hover Grey** (hover-grey): row and button hover; also the zero point of the tile wash and the retired tile fill.
- **Muted Wash** (muted-wash): tags, meter and bar tracks, muted pills, popover close hover.
- **Border / Border Strong** (border, border-strong): card and row dividers / control borders, scrollbar thumb, open popover border.
- **Ink ladder** (ink, ink-secondary, ink-tertiary): text, labels and column heads, metadata and placeholders. rail-ink is the rail's link colour.
- **Tile patterns** (tile-stripe-light, tile-stripe-dark, tile-building, tile-building-line): the paused stripes and the building outline on site tiles and their legend swatches.

### Named Rules
**The One Blue Rule.** Blue means "you can act here" or "this is selected". Action, focus, selection and set filters all speak in it; nothing decorative is blue.

**The Money Colour Rule.** Green and red are reserved for gain and loss (and their status meanings: healthy, critical). Tile wash intensity follows contribution per €1 on the steps −1, −0.5, −0.2, 0, +0.2, +0.5, +1, and the legend shows those same steps.

## Typography

**Font:** Inter Variable (with system-ui, -apple-system, Segoe UI, sans-serif), loaded through `@fontsource-variable/inter`.
**Mono Font:** ui-monospace, Cascadia Mono, SF Mono, Menlo, Consolas (IDs and codes only).

**Character:** One neutral grotesque at in-between variable weights (550, 580, 620, 650) rather than the usual 500/600/700 steps, which keeps a dense screen even and calm.

### Hierarchy
- **Headline** (650, 22px, 1.25, −0.015em): the page title, one per screen.
- **Figure** (650, 22px, −0.01em, tabular): KPI values. Funnel counts use 20px / 650.
- **Title** (620, 14px): card heads and modal titles. The "Sites at a glance" head sets 15px / 600.
- **Body** (400, 13px, 1.45): running text and table cells. Buttons and selects set 580; rail links 550.
- **Small** (12px): page subtitles, filter labels, the freshness strip, table footers, legends.
- **Label** (620, 11.5px): table column heads, pill text; at 400 weight the same size carries metadata, KPI subs and secondary lines under a value.
- **Axis** (10.5px, tabular): chart ticks.

### Named Rules
**The Tabular Figure Rule.** Every figure (table numbers, KPI values, axis ticks, formula values, log times, source ages, tile values) is set with tabular numerals and, in tables, right-aligned and unwrapped. Running text keeps proportional figures.

**The Sentence Case Rule.** Heads, labels, column heads, buttons and pills are sentence case with no tracking. Hierarchy comes from size and weight.

## Layout

An app shell: a 220px sticky white rail and a fluid main column. The top bar is sticky (10px 24px) and carries the sample-data tag, the data date, the range switch, the role select and the global pause control. The freshness strip sits directly beneath it. Content pads 22px 24px 96px in a 16px vertical stack; grids are 2-up, 3-up or main plus a 340px side column.

Spacing rhythm is 4, 8, 12, 16 and 24px. Cards pad 16px; KPI cells 14px 16px; table cells 8px 10px (dense tables 8px 6px with 16px at the outer edges); list items 11px 16px.

Breakpoints, as built:
- **1100px:** 2-up, 3-up and side grids collapse to one column; the sponsor funnel goes 4-up.
- **860px:** the rail becomes two rows (brand, then a sideways-scrolling nav) and its footer hides; KPI rows go two-up; content pads 16px; the freshness strip scrolls sideways and drops its hint; the activity log drops its kind column; network filters fold behind a "Filters" button; layout switch labels shorten; the tile map grows to 520px tall.
- **640px:** tables marked for it become labelled cards; the funnel goes 2-up.
- **600px:** the number popover becomes a bottom sheet (8px insets, up to 75vh).

## Elevation & Depth

A soft, low-contrast lift. Cards and KPI rows sit on the ground with a faint two-layer shadow; everything that floats (modal, toast, number popover) takes a larger diffuse shadow. Inside cards, depth is tonal: surface-shade headers and strips under white rows.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 2px rgb(16 24 40 / 0.05), 0 1px 3px rgb(16 24 40 / 0.07)`): cards, KPI rows, the tile map panel.
- **Overlay pop** (`box-shadow: 0 12px 32px rgb(16 24 40 / 0.16), 0 2px 6px rgb(16 24 40 / 0.08)`): modal and toast.
- **Popover** (`box-shadow: 0 12px 32px rgb(15 23 42 / 0.16)`): the number details popover.
- **Tile ring** (`box-shadow: inset 0 0 0 2px` ink): hovered, focused or read tile.

### Named Rules
**The Lift Means Float Rule.** Resting surfaces get only the card-rest shadow. A larger shadow means the element floats over the page and will close.

## Shapes

Gently rounded and rectangular. Controls, tags, nav items, tabs' container and tile groups use 6px (sm); cards, KPI rows, the modal, the popover and pills use 10px (md), which makes 20px pills fully round. Freshness source capsules are 12px on 24px height. Legend swatches are 3px. Dots (risk, health, alert, log kind) are circles of 7–8px; severity markers are 8px squares at 2px.

Tables and the tile map are square inside their rounded cards. Tiles meet with a 1px white inset gap so a country reads as one block.

## Components

### Buttons
Compact and quiet.
- **Shape:** 6px corners, 32px tall, 12px side padding, 580 weight, 6px icon gap.
- **Default:** white with a border-strong border; hover to hover grey. 120ms background and border transition.
- **Primary:** action blue fill and border, white text; hover mixes 12% black in.
- **Danger:** loss red fill, white text, same hover darkening. Used for global pause and destructive confirms.
- **Ghost:** no border or fill, secondary ink.
- **Small:** 26px tall, 9px padding, 12px text.
- **Disabled:** 50% opacity, not-allowed cursor. Role-blocked actions show a 12px lock icon and say why in the title.

### Segmented switches
Range (7 / 30 / 90 days), network layout, and the activity log's kind filter. border-strong outline, 30px options divided by a 1px border; the on option is accent wash with blue text.

### Filters
A select joined to its muted 12px label inside one bordered 32px capsule. A set filter turns its border blue and its fill accent wash; a ghost small "Clear n filters" appears when any are set. On the network page below 860px the search stays visible and the selects fold behind a "Filters" button (blue, with a count, when any are set); opened, each filter takes a full row.

### KPI row
One white card divided into cells by 1px borders, auto-fit at 128px minimum. Each cell: 12px secondary-ink label (ellipsis), 22px / 650 figure, then an 11.5px sub line whose leading change is green or red by whether the direction is good. Two-up under 860px; a fixed two-up variant exists. Figures with provenance are click-a-number buttons with a resting border-strong underline.

### Tables
Flush cards holding a sticky surface-shade header row in label type; sortable heads show a blue chevron. Rows divide on the border, hover to hover grey, select to accent wash. Figures are right-aligned; a secondary line sits under a value at 11.5px tertiary ink. Long text clips at 230px. A table foot (12px, tertiary) carries counts and "Show all". Inline: sparks, 64×6px meters with a percentage, tags and state pills.

**Phone card mode** (below 640px, tables marked for it): the header hides and each row becomes a block (10px 14px, bottom border). Cells stack with their column name drawn from `data-label` as a 104px tertiary label in a left gutter; title, action and full-width cells drop the gutter. Hide-on-phone cells disappear; sub lines go inline.

### Sites at a glance (signature)
A flat two-level treemap in a card: countries sized by total ad spend, sites as tiles sized by spend (sites with no spend get a floor tile so they stay on the map). Each country has a 22px label line (name, site count when wide enough, contribution in green or red) over a 6px-rounded body.
- **Fill:** contribution per €1 spent, mixed from hover grey toward green or red; at |ratio| ≥ 0.75 a live tile goes solid (gain green or deep loss red) with white text.
- **State:** paused tiles are 135° stripes of tile-stripe-light and tile-stripe-dark (5px each); building tiles are near-white with a tile-building-line inner outline; retired tiles are hover grey with struck-through tertiary text.
- **Alert:** a 7px loss-red dot with a 2px white ring in the top-right corner marks a critical alert.
- **Labels:** short name (11.5px / 600) when the tile is wider than 58px and taller than 26px; value (11px, tabular, secondary ink) when wider than 46px and taller than 40px.
- **Legend:** the seven-step ramp, a square sized to a round euro amount, and Paused / Building / Retired swatches.
- **Readout:** a surface-shade strip under the map reads out the hovered tile's numbers in a polite live region. With a mouse a click opens the site; on touch (`hover: none`) the first tap reads the tile and the readout carries an "Open site" button.
- **Hide:** a small "Hide" button collapses the panel to its head ("Hidden. The site table below has the same numbers.") with a "Show" button; the choice persists in localStorage.
- **Motion:** countries fade in over 360ms ease-out, 40ms stagger, on load and on range change.

### Freshness strip
A full-width surface-shade line under the top bar: a tertiary "Sources" label, then one 24px capsule per source with a 7px health dot (green ok, amber late, red failed), name and age. Late ages turn amber, failed ages read "sync failed" in red at 600. Capsules gain a white fill and border on hover or when open, and open a popover with the recent sync table. A right-aligned hint explains underlined numbers on wide screens.

### Click-a-number details (Num)
Any figure with provenance is a button that keeps the number's own styling and adds a 1px dotted underline: always on in KPI cells, on row hover in tables, solid blue while open. It opens a 360px popover (10px corners, border-strong border, popover shadow, 12.5px text, focus moved in, closes on outside click, Escape, scroll or resize): title at 13.5px / 620 with an optional "formula to be agreed" warn pill; a one-line plain description; a bordered formula block of operator, label and tabular value rows ending in a ruled total; optional breakdown rows with 6px blue bars; a facts list of period and sources with health dots; and a tertiary note. Below 600px it docks as a bottom sheet.

### Activity log
A flush card with a segmented kind filter (All, Data, People, System with counts). Rows are a four-column grid (96px time, 72px kind, text, who) at 12.5px with 1px dividers. Kind dots: blue for People, violet for System, tertiary for Data (imports). Bad entries set their text red, warnings their detail amber, and the user's own changes show "just now" in green. Nine rows show by default with a "Show all" foot. Under 860px the kind column hides and the text drops to its own line.

### Tabs
Text tabs (580 weight, 9px 12px) on a 1px border; the on tab is blue with a 2px blue underline. Counts sit beside the label at 11px tertiary. The strip scrolls sideways without a scrollbar when it overflows.

### Pills
20px tall, 8px padding, 11.5px / 620, fully rounded, a wash with matching ink: ok, warn, danger, info, muted, accent. Site state maps Live→ok, Paused→warn, Building→info, Retired→muted. Risk is shown not as a pill but as an 8px dot with coloured text (Low ok, Medium warn, High danger). Tags (11px on muted wash, 6px corners) label groups inside cells.

### Global pause states
- **Off, Admin:** a danger "Global pause" button with a pause icon in the top bar opens a danger confirm modal ("Pause everything").
- **Off, other roles:** the control stays visible as a disabled ghost button with a lock icon reading "Global pause · Admin only".
- **On:** a full-width loss-red banner above the top bar (white 600 text, pause icon, `role="alert"`) states that every campaign is paused, with a small "Lift pause" button for Admins. Every campaign action across the app is disabled with the title "Global pause is on"; owner and sales-task actions stay available.

### Charts
Hand-built SVG drawn at real pixel width so axis text keeps its size on phones. Line charts: 2px series strokes, dashed (5 4) for projections and forecasts, a faint band for likely ranges, border-coloured grid lines, 10.5px tabular axis ticks, a tertiary zero line when values go negative and a dashed marker for "today". Hover draws a border-strong guide with 3.5px dots and the legend shows that day's values. Stacked bars use the same frame. Sparks are 84×22 with a 1.5px line and 12% fill, on a shared scale when compared. Series colours come only from the five chart tokens, plus loss red for a falling spark.

### Cards, modal and toast
Cards: white, 1px border, 10px corners, card-rest shadow, 16px padding; flush cards hold tables edge to edge with a 14px 16px head. Modal: 460px max, 20px padding, 10px corners, overlay pop over a 42% ink scrim, Cancel plus a primary or danger confirm. Toasts: ink background with white text, 6px corners, bottom right, entering over 260ms cubic-bezier(0.16, 1, 0.3, 1), static under reduced motion.

### Navigation
White rail with 550-weight links (8px 10px, 6px corners, 16px stroke icon, 10px gap). Hover and active fill with accent wash and switch to deep action blue. The Network link carries the critical alert count in a red 18px badge. The brand mark is four unequal blue rects. Below 860px the nav becomes a sideways-scrolling row under the brand.

### Icons
One stroke set on a 24px grid at 1.8 stroke, round caps and joins, inheriting currentColor. Default 16px; chevrons and lock 12–14px.

## Do's and Don'ts

### Do:
- **Do** build new surfaces from the shared tokens and classes in `src/styles.css` under the standard tokens.
- **Do** make every headline figure a click-a-number with its formula, period and sources.
- **Do** show money as green or red only, and wherever a contribution wash appears, show the −1 to +1 per €1 legend.
- **Do** set every figure with tabular numerals, right-aligned and unwrapped in tables.
- **Do** keep blocked actions visible: disabled, with a lock icon and a reason, not hidden.
- **Do** give every wide table a phone card mode (`cards-sm` with `data-label`) before adding columns.
- **Do** mark state in pattern as well as colour on tiles: striped paused, outlined building, struck retired.
- **Do** label invented numbers with the amber "Mockup · sample data" tag.

### Don't:
- **Don't** use blue for anything that is not action, selection, focus or a link.
- **Don't** use green or red decoratively; they mean gain and loss, healthy and critical.
- **Don't** add shadows heavier than card rest to resting surfaces; larger shadows mean the element floats.
- **Don't** use uppercase tracked labels or eyebrow lines above headings; hierarchy is size and weight in sentence case.
- **Don't** use text glyphs as icons; draw from the stroke set.
- **Don't** add chart colours outside the five series tokens.
