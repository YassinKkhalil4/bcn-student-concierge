# The guide PDF

The PDF is built from HTML, not exported from a design tool, so it is text (selectable,
searchable, accessible) and small, and it can be built in every language the site speaks.

    guide-pdf/pages/NN.html   one A4 page (794 x 1123 px) each, with NN.css for its own styles
    guide-pdf/base.css        styles shared by every page
    guide-pdf/fonts*          the fonts (Archivo, Atkinson Hyperlegible, JetBrains Mono)
    guide-pdf/build.mjs       renders one page at a time with Chromium; fits, translates, reports problems
    guide-pdf/merge.py        joins the pages into one PDF
    guide-pdf/build-all.sh    all six languages + the cover images -> assets/guide/
    guide-pdf/i18n_tool.py    turns a numbered list of translations into src/lib/guide/i18n/pdf-<locale>.json
    guide-pdf/units.js        finds the translatable text units in a rendered page

## How translation works

`node guide-pdf/build.mjs en <dir> --extract` writes `units.json`: every sentence on every page
(an element whose children are all inline, with its formatting). A translation is a dictionary from
that English text to the translated text, in `src/lib/guide/i18n/pdf-<locale>.json`. The build swaps
each unit in and prints `MISSING` for any it cannot find. The same dictionaries feed the web
chapters, so the PDF and the pages say the same thing in the same words.

If you change English text on a page, its unit changes and its translations stop matching: run
`--extract` again, add the new unit to each language, and rebuild. A test fails until you do.

## Pages that do not fit

Pages are a fixed height and a translation is rarely the same length as English. The build
shrinks a page's content just enough to clear the footer (never below 74%) and reports it on the
`FIT` line. Anything near the minimum is a page worth tightening.

## Prices

Part 5 (pages 17, 18, 19) is written from the site's pricing table (`src/lib/pricing.ts`).
`tests/guide-online.test.ts` fails if a price in the pages stops matching it.
