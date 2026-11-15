# Data policy

Where the data on this site comes from, what we store, what we deliberately do
not store, and why. This is a good-faith reading by the project's contributors,
**not legal advice**. Checked on 2026-11-15; terms change, so re-read the
sources before relying on this.

## 1. Catalogue data (parts, prices, stock, parameters)

**Source.** The site is generated from the component database that
[yaqwsx/jlcparts](https://github.com/yaqwsx/jlcparts) publishes daily. That
database is in turn built from JLCPCB's parts list. This project does not
crawl jlcpcb.com or lcsc.com at all: the build downloads yaqwsx's published
files and reshapes them (merging categories, normalising parameters).

**What JLCPCB's terms say.** Their
[Terms & Conditions](https://jlcpcb.com/help/article/Terms-%26-Conditions)
(section VI, "Copyright and Ownership") say site content is owned by JLCPCB
and its licensors, that visitors may "view, play, print, and download
documents ... for personal, informational, and noncommercial purposes only",
and that visitors "may not ... copy, distribute, transmit, display, perform,
reproduce, publish, license, create derivative works from, transfer or sell
any information or work contained on the Services". There is no clause
specifically about scraping or automated access, but
[robots.txt](https://jlcpcb.com/robots.txt) disallows `/api`.

**What LCSC's terms say.** Their
[Terms and Conditions](https://www.lcsc.com/help/terms-and-conditions) are
terms of sale. We found nothing in them about automated access or reuse of
catalogue data. They do say LCSC "does not guarantee the currency or accuracy"
of catalogue information. [robots.txt](https://www.lcsc.com/robots.txt) allows
product pages and disallows cart, checkout, account pages and
`/product-detail-v2/`.

**Where that leaves a site like this one.** Read literally, JLCPCB's terms do
not grant permission to republish their catalogue; a public catalogue mirror is
tolerated rather than licensed. The original jlcparts has operated openly on
that footing for years, it is non-commercial, and it sends people to JLCPCB to
buy. We keep to the same footing:

- non-commercial, no ads, no sale of data;
- every part links to its JLCPCB and LCSC page, and prices and stock are shown
  with a reminder to confirm on JLCPCB;
- no JLCPCB or LCSC logos or branding, and a clear "unofficial" notice;
- we do not copy part photos or datasheets; the few images shown are loaded
  from LCSC's own servers and datasheet links point at the original host;
- if JLCPCB or LCSC ask for something to be changed or removed, we will do it.

If you plan to use this data commercially, ask JLCPCB for access to their
official API rather than relying on this project.

## 2. Datasheet-derived data (`datasheet-data/`)

Some parameters that matter for choosing a part exist only in the
manufacturer's datasheet, often only as a graph: how a MOSFET's on-resistance
changes with gate voltage and temperature, its thermal resistance, and so on.
The `datasheet-data/` folder holds such values for individual parts so that the
formula columns can use them, and so that nobody has to extract them twice.

**What a record contains.** Numbers (scalars, and lists of points read off a
curve), the test conditions, the pages they were read from, and a link to the
datasheet. See `datasheet-data/README.md` for the format.

**What we never store or redistribute.**

- datasheet PDFs, in whole or in part;
- images, screenshots or crops of datasheet pages or figures (the charts on
  the site are redrawn from the stored numbers);
- datasheet text beyond a part number and a short test-condition string.

**Why we think that is acceptable.** Datasheets are copyrighted by their
manufacturers, and their terms commonly restrict reproducing the document.
Individual measured values are facts about a product; copyright protects the
way a document expresses information, not the facts themselves. Reporting that
a part is 18 mΩ at 10 V, with a link to where that is stated, is what every
distributor's parametric table, and every engineer's notes, already do. We have
**not** reviewed each manufacturer's datasheet terms individually, and
database rights in some jurisdictions are a separate matter from copyright, so:

- records always carry a link back to the manufacturer's document;
- we take data from the manufacturer's own published datasheet;
- any manufacturer who objects to values from their datasheets appearing here
  can open an issue and they will be removed.

**How PDFs are obtained.** By a person, from the manufacturer's site or from the
datasheet link in a browser. Most datasheet links in the catalogue point at
JLCPCB's file service, which serves browsers only and sits under the `/api`
path that their robots.txt excludes. The extraction tool does not try to get
around that: for those parts you give it a manufacturer URL or a PDF you saved
yourself.

**Accuracy.** Values read from graphs are approximate (typically within a few
percent). Every record is checked for plausibility before it is published, and
the site marks results that rest on a generic model rather than on data with
`≈`. Nothing here replaces reading the datasheet before committing to a design.

## 3. Reading datasheets with Claude

The site and the command-line tool can ask Anthropic's Claude to read a
datasheet PDF and return the values above. When a visitor does this in the
browser, the PDF and their own API key go directly from their browser to
Anthropic; nothing passes through or is stored by this site, and the result is
kept in that browser until they choose to contribute it. Anthropic's handling of
API inputs is described in its own terms and privacy policy.

**Datasheet jobs.** The site can also write a "job file" for a list of parts
that you give to an LLM of your own choosing, together with the datasheets. In
that flow the site sends nothing anywhere: it produces a text file and later
reads back the answer you paste in. What the LLM provider does with the files
you give it is between you and that provider.

## 4. Privacy

The site is static. It has no accounts, no analytics and no server of its own.
Favourites, column choices, formulas, locally extracted datasheet data and (only
if you tick "remember") an Anthropic API key are kept in your browser's storage
and never leave it, except for the API key being sent to Anthropic when you ask
for an extraction. GitHub Pages, which hosts the files, sees ordinary web
requests.

## 5. Takedown

Open an issue on the repository, or contact the repository owner through
GitHub. Requests from JLCPCB, LCSC or a component manufacturer about their own
material will be acted on promptly.
