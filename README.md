![Logo](web/public/favicon.svg)

# JLC Parts — parametric search for the JLCPCB assembly library

A fast, Digi-Key-style parametric search for the parts
[JLCPCB](https://jlcpcb.com/parts) can assemble for you.

**Live site:** https://anasmalas.github.io/jlcparts/

## Built on two people's work

This project exists because of:

- **[Jan Mrázek (yaqwsx)](https://github.com/yaqwsx)**, who created
  [jlcparts](https://github.com/yaqwsx/jlcparts) and still builds and publishes
  the component database this site is generated from every day.
  Original site: https://yaqwsx.github.io/jlcparts/
- **[dougy83](https://github.com/dougy83)**, whose
  [enhanced fork](https://github.com/dougy83/jlcparts) this repository was
  forked from: single-file database, much faster search and updates,
  favourites, Basic-part filtering, CSV export.
  His site: https://dougy83.github.io/jlcparts/

If this saves you time, **please support Jan** — the donate buttons on the site
and on this repository go to him, not to this fork:
[GitHub Sponsors](https://github.com/sponsors/yaqwsx) ·
[Ko-fi](https://ko-fi.com/E1E2181LU)

This is an unofficial community tool, not affiliated with JLCPCB or LCSC.

## What is different in this version

- **Filters only offer what is still available.** Pick P-channel and every
  other filter shrinks to the values P-channel parts actually have, each with a
  live part count. Options that would give zero results disappear.
- **Min / max boxes for numbers.** Type `10m`, `4k7`, `100n`, `2.2u`, `30`. A
  small histogram shows where the parts are. An exact-value list is one click
  away when you want it.
- **Selections add up.** Clicking a second option adds it; no Shift or Ctrl.
- **Part counts everywhere**: per category on the home page, per option in
  every filter.
- **Merged categories and parameters.** The ~690 upstream categories become
  ~300 ("MOSFET" and "MOSFETs", "Fuseholders" and "Fuse Holders", "Logic" and
  "Logic ICs" are each one list), and parameters that were the same thing under
  different names are one column. Nothing is dropped: an "Original Category"
  filter keeps the distinction where it existed.
- **Typed parameters.** Tolerances are `±1%`, temperature ranges are ranges you
  can ask to *cover* −40…85 °C, multi-value parameters (features, topologies)
  can match any or all.
- **Formula columns** you can sort and filter by, including ones that solve
  for themselves (junction temperature ↔ on-resistance), and values read from
  datasheet graphs. See below.
- **Loads only what you open.** The home page is ~100 KB; a category is fetched
  when you open it (MOSFETs: 1.5 MB). The original downloads the whole database
  first.
- **Shareable searches.** The whole state is in the URL.
- Favourites, CSV export, column chooser, light / dark theme, keyboard `/` to
  search.

## Formula columns

Open a category, press **Formulas**, and define values per part. Lines can use
catalogue parameters, functions and each other:

```
Rds_hot = rds_on(12V, 70C)
```

gives the on-resistance at 12 V gate drive and 70 °C junction for every MOSFET.
Definitions may also be circular, which is what a thermal problem is:

```
I   = 10A
Rds = rds_on(12V, Tj)
P   = I^2 * Rds
Tj  = 40C + P * (rth_jc() + 1)
```

Here `Tj` depends on `P`, which depends on `Rds`, which depends on `Tj`. The
loop is solved for each part; a part that cannot reach a stable temperature is
reported as running away instead of getting a number. Every ticked line becomes
a column and a min/max filter, so "junction below 100 °C on a 1 °C/W heatsink
at 10 A" is one filter box.

Numbers take SI prefixes and decorative units (`10m`, `4.7k`, `12V`, `70C`);
everything is in base units internally. The editor lists the parameter names
and functions available in the category you are in.

**Where the numbers come from.** `rds_on(vgs, tj)` uses digitised datasheet
curves when a part has them (see `datasheet-data/`). Otherwise it uses the
catalogue's rating at the nearest rated gate drive at or below the one you
asked for, and a generic temperature model chosen by voltage class and
technology. Results that rest on the generic model are marked `≈`. Treat those
as a way to build a shortlist, then read the datasheet.

## Datasheet jobs: real curves for a whole shortlist

Only a few parts ship with digitised datasheet curves, and the catalogue has
blanks. Instead of reading datasheets one at a time, press **Datasheet job** in
a category:

- The site writes a compact job file for your shortlist: the parts, your
  formulas (so it asks only for what they use), your filter requirements (so
  parts that turn out not to fit are discarded early), and the exact answer
  format.
- You hand that file to any LLM along with the datasheets, or to one that can
  browse for them.
- You import its answer. Each record is validated; your formulas then use the
  real curves, and blanks in the catalogue are filled (marked <sup>d</sup>).

You can include "under-labelled" parts: ones that are not known to fail a
filter, the catalogue just has no value there. The job tells the model which
value to look up first for each of those.

The site sends nothing anywhere in this flow and needs no API key. Imported
records live in your browser until you contribute them (one download, one
command, one pull request), after which every visitor has them.

## Datasheet data

Values that only exist in datasheets (curves, thermal resistance) live in
[`datasheet-data/`](datasheet-data/README.md) as small JSON files with a link
to the source, so each part only has to be read once for everybody. Only a
handful of parts have records so far. Besides datasheet jobs, you can add a
single part in the browser (type it in, or let Claude read the PDF with your
own Anthropic API key) or from the command line.

What may and may not be stored, and the reasoning, is in
[docs/DATA-POLICY.md](docs/DATA-POLICY.md).

## How it works

```
yaqwsx's daily database ──▶ pipeline/build.mjs ──▶ web/public/data/ ──▶ static site
                              merge categories        index.json
datasheet-data/*.json ──────▶ normalise parameters    c/<category>.json.gz
                              validate records        ds/<category>.json
                                                      search.json.gz
```

- `pipeline/` — Node scripts. `taxonomy.mjs` is the curated category map,
  `attributes.mjs` the parameter aliases and per-category clean-ups,
  `build.mjs` turns every upstream parameter into a typed column.
  New upstream categories are placed automatically and reported by the build.
- `shared/` — code used by both the pipeline and the site (units, datasheet
  recipes, the extraction prompt).
- `web/` — the site: Vite + React + TypeScript, no backend. Filtering runs in
  the browser on typed arrays; a 64,000-part category refilters in a few
  milliseconds.
- `tools/extract-datasheet.mjs` — reads a datasheet PDF with Claude and writes
  a `datasheet-data` record. `tools/import-records.mjs` turns a bundle of
  records (a job answer, or a download from the site) into files.

## Running it yourself

Needs Node 22 or newer.

```bash
npm install
```

```bash
npm --prefix web install
```

```bash
npm run data
```

```bash
npm run dev
```

`npm run data` downloads the upstream database (about 35 MB, cached in
`.cache/`) and builds `web/public/data/`. `npm test` runs the unit tests;
`npm run build` makes the production site in `web/dist/`.

## Deploying your own copy

The workflow in `.github/workflows/deploy.yml` rebuilds the database and
publishes the site to GitHub Pages on every push to `main` and once a day.
In a fork, three switches have to be flipped once:

1. **Settings → General → Default branch → `main`.** GitHub only runs
   scheduled workflows from the default branch, and by default only lets the
   default branch deploy to Pages.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Actions tab** → enable workflows, if GitHub shows the prompt (it disables
   them in new forks).

Then run "Build and deploy" from the Actions tab, or push to `main`.

## Licence

MIT, as the original. See [LICENSE](LICENSE). Catalogue data belongs to
JLCPCB / LCSC; datasheet-derived values are facts taken from the
manufacturers' documents, stored with a link to the source.
