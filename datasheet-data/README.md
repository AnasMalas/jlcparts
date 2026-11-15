# Datasheet-derived data

One JSON file per part: `datasheet-data/<recipe>/<LCSC code>.json`. The build
validates every file and publishes the valid ones with the site, where they
feed the formula functions (`rds_on()`, `rth_jc()`, `curve()`, `ds()`) and the
"From the datasheet" section of the part details.

Read [docs/DATA-POLICY.md](../docs/DATA-POLICY.md) first: numbers and a source
link only, never PDFs or images of datasheet pages.

## Format

```json
{
  "lcsc": "C99124",
  "mfr": "AOD4184A",
  "recipe": "mosfet",
  "source": {
    "url": "https://www.aosmd.com/pdfs/datasheet/AOD4184A.pdf",
    "retrieved": "2026-11-15",
    "method": "read by hand",
    "pages": "1, 2, 3",
    "notes": "anything a reviewer should know"
  },
  "scalars": { "rth_jc": 3, "tj_max": 175 },
  "curves": {
    "rds_on_vs_vgs": {
      "cond": { "Id": "20 A", "Tj": "25 °C", "figure": "Fig. 5" },
      "points": [[4, 0.009], [4.5, 0.0076], [6, 0.0064], [10, 0.0058]]
    }
  }
}
```

- Everything is in SI base units: Ω, V, A, C, °C, °C/W. So 5.8 mΩ is `0.0058`.
- Curve points are `[x, y]` with x strictly increasing. 6 to 14 points is
  plenty; put them where the curve bends.
- For P-channel parts, give voltages and currents as positive magnitudes.
- Leave out anything the datasheet does not state. A missing value just means
  the site falls back to an estimate; a wrong one misleads people.

Which scalars and curves exist for each recipe, with their units, is defined in
[`shared/recipes.js`](../shared/recipes.js). Today there is one recipe:

| Recipe | Curves | Scalars |
|---|---|---|
| `mosfet` | `rds_on_vs_vgs` (typ, 25 °C), `rds_on_norm_vs_tj` | `rth_jc`, `rth_ja`, `tj_max`, `rds_on_typ`, `rds_on_max`, `rds_on_vgs`, `qg_typ`, `qgd_typ`, `vgs_th_typ` |

## Adding a part

**In the browser.** Open the part, scroll to "From the datasheet", choose "Add
datasheet data". Either type the values in, or let Claude read the PDF with
your own Anthropic API key. Save, check the charts look like the datasheet's,
then press "Contribute" to open a pre-filled issue.

**From the command line** (needs `ANTHROPIC_API_KEY` and a built catalogue):

```bash
npm run data
```

```bash
npm run extract -- C99124 --url https://www.aosmd.com/pdfs/datasheet/AOD4184A.pdf
```

Then review the new file against the datasheet, run `npm test`, and open a pull
request. The tests load every record and reject implausible ones (resistance
rising with gate voltage, an un-normalised temperature curve, swapped thermal
resistances, and so on).
