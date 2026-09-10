# Government form templates (EX-17 / EX-18)

## The templates are not fillable PDFs

This is the single most important fact about this subsystem, and it is not what
you would assume.

The official EX-17 and EX-18 published by the Ministerio de Inclusión are **flat
print documents**. They contain:

- no AcroForm
- no XFA
- no widget annotations
- no text layer worth speaking of (EX-17 page 1 yields 48 stray glyphs)

Page 1 of EX-17 is composed of **38 bitmap image XObjects**. It is artwork with
dotted rules meant to be filled in by hand.

Verified with:

```bash
npm run forms:inspect -- templates/forms/EX-17-official.pdf   # → 0 fields
```

and by decompressing every object stream in both files (1.0 MB and 5.5 MB
respectively) and searching for `/AcroForm`, `/XFA`, `/Widget`, `/Tx`, `/Btn`.
Nothing.

**Consequence:** values cannot be written into named fields. The engine draws
them at absolute coordinates instead — see `src/lib/forms/layout.ts`.

## Why the templates are not in this repository

They are published by the ministry, revised periodically, and not
redistributable. A stale copy is worse than none: a form on a superseded
revision is refused at the counter and the applicant loses their appointment.

Download the current versions and place them here:

```
templates/forms/EX-17-official.pdf   # TIE — non-EU nationals
templates/forms/EX-18-official.pdf   # CUE — EU/EEA/Swiss nationals
```

PDF-rendering tests skip automatically when they are absent, so a fresh clone
does not fail. The layout-validation tests run regardless.

## EX-17 vs EX-18 — one or the other, never both

| Applicant | Form | Produces |
|---|---|---|
| Non-EU/EEA/Swiss national | **EX-17** | Tarjeta de Identidad de Extranjero |
| EU/EEA/Swiss national | **EX-18** | Certificado de Registro de Ciudadano de la UE |

`selectForm()` routes on nationality. A student has no reliable way to
self-select this, so the engine decides.

Both forms are calibrated. They are **separate layouts, not variants of one**:
EX-18 carries a four-line header where EX-17 has three, which pushes every
Section 1 row 2-5pt lower, and its section box extends ~5pt further right.

| Row | EX-17 baseline | EX-18 baseline |
|---|---|---|
| pasaporte / nie | 645 | 640 |
| apellidos | 625 | 623 |
| nombre / sexo | 607 | 605 |
| fecha / lugar / país | 588 | 585 |
| nacionalidad / estado civil | 570 | 567 |
| padre / madre | 550 | 549 |
| domicilio / nº / piso | 532 | 530 |
| localidad / cp / provincia | 513 | 512 |
| teléfono / email | 494 | 495 |

`tests/pdf.test.ts` asserts these never become identical — if they do, someone
has copied one layout onto the other. A separate test asserts both layouts map
the **same field set**, so a field added to one form cannot be silently missing
from the other.

---

## Calibration workflow

This is how coordinates are produced. **Do not hand-edit `layout.ts` without
repeating it.**

### 1. Render a measurement grid

```bash
npm run forms:grid -- templates/forms/EX-17-official.pdf
```

Writes `EX-17-official-GRID.pdf`: a 10pt grid labelled every 50pt, in PDF
points. Origin is **bottom-left**, y increasing upward — values read off the
grid paste straight into the map.

### 2. Write positions into `layout.ts`

`y` is the text **baseline**, sitting just above the printed dotted rule.

### 3. Prove every position

```bash
npm run forms:proof -- templates/forms/EX-17-official.pdf --proof
npm run forms:proof -- templates/forms/EX-18-official.pdf --proof
```

Writes `<name>-PROOF.pdf` with every mapped position boxed and labelled — red
for text fields, blue for checkbox marks. Misplacement is visible at a glance.
The form is chosen from the filename, so run it against each template.

### 4. Magnify anything ambiguous

```bash
npm run forms:zoom -- templates/forms/EX-17-official-PROOF.pdf 390 555 175 65 6
#                     <pdf>                                     x   y   w   h  scale
```

Checkbox marks are only a few points wide. At full-page scale a 4pt error is
invisible, and 4pt is enough to put an "X" outside its box.

### 5. Fill with real data and inspect the result

Generate a sample, then zoom Section 1 and confirm every value sits on its rule
and clear of its printed label.

---

## ⚠️ Sign-off required before live use

Both layouts were calibrated on screen and are visually correct, but neither has
been checked against a **physical printout**. Do this per form before the engine
touches a real application:

1. Print a filled sample at **100% scale, no page scaling**.
2. Confirm every value sits within its printed box and none clips a rule.
3. Confirm the gender and marital-status marks are unambiguously inside their
   squares.
4. Confirm Section 2, Section 3 and the DEHú box are completely empty.
5. Have someone who has filed this form in person review it.

Printer margins can shift output by a few points relative to on-screen
rendering. That margin of error matters here.

---

## Fragility — read before swapping in a new template

Coordinates are far more brittle than field names were. A re-issued template
that shifts the layout by a few points will **silently** print data outside its
box; a larger revision can put a value in the **wrong box** on a legal document.

Nothing detects this automatically. There is no equivalent of the old
"unknown field name" error, because there are no names to check.

**Any template change requires re-running the full calibration and reviewing the
proof render field by field.** Treat a new template revision as a code change
requiring review, not a file swap.

---

## Rules the engine enforces

Encoded in `src/lib/forms/pdf.ts`, covered by `tests/pdf.test.ts`.

**1. Missing optional fields produce no output at all.**
No `N/A`, no `-`, no empty string. An officer reading "N/A" in the
second-surname box treats it as a declared surname, and the mismatch against the
passport can invalidate the file. Applies to second surname, pre-assigned NIE
and floor/door.

**2. Section 2, Section 3 and the DEHú box are structurally unreachable.**
They have **no coordinates in the layout**. This is stronger than the previous
runtime assertion: there is nowhere for the engine to write, so no future
refactor can accidentally start filling them.

- Section 2 (representative) would declare that we act as the applicant's legal
  representative, triggering a power-of-attorney requirement we do not hold.
- The DEHú box would opt the student into binding notification deadlines in a
  mailbox requiring a Spanish digital certificate they do not have.

**3. Over-long values shrink instead of overflowing.**
A long street name running past its rule collides with the "Nº" box and makes
both unreadable. Text shrinks to a floor of 5.5pt; below that it would be
illegible in print, so `FieldOverflowError` is raised rather than emitting an
unreadable form. `shrunkFields` reports what was scaled.

**4. There is nothing to flatten.**
The output has no form fields, so it is non-interactive by construction — no
blue highlight, no text shifting on print. That was the original purpose of the
`flatten()` step, now achieved structurally. `NeedAppearances` is meaningless
without fields and is not set.

**5. The birth date is split across three printed boxes.**
`fecha_nacimiento_dia` / `_mes` / `_anio` are positioned individually, clear of
the printed `/` separators between them. Measured rules:

| | EX-17 | EX-18 |
|---|---|---|
| day | 135.8–150.4 | 136.0–149.8 |
| month | 162.6–178.1 | 162.1–176.3 |
| year | 191.0–224.5 | 190.0–226.0 |

**6. A short printed rule may be overrun when whitespace follows it.**
The `Nº` rule is only ~13pt wide, but ~21pt of blank space follows before the
"Piso" label. A three-digit street number uses that space rather than being
shrunk to 6pt — overflowing a short rule into adjacent whitespace is far more
legible than an unreadably small value, and it stays clear of the next label.
`Piso` has no such slack (the section border follows immediately), so a long
floor/door is shrunk instead.

### Known refinement: the N.I.E. field is segmented

The printed N.I.E. area on both forms is three segments —
`[prefix] -- [digits] - [letter]` — but is filled as a single value, so a full
NIE runs across the `--` separator. Legible, and consistent between the two
forms. Splitting it would mean changing `buildFieldValues()` and both layouts
together; doing it for one form only would be worse than the current state.

## Character encoding

The engine embeds WinAnsi Helvetica, covering the Latin-1 range these forms use.
A name outside that range (Cyrillic, CJK, some diacritics) throws on encode.

That is deliberate: the problem surfaces at generation time instead of printing
mojibake onto a legal document. Supply the transliteration from the passport's
machine-readable zone, which is what the authorities expect on the form anyway.

## Submission is in person only

EX-17 carries this notice:

> LA PRESENTACIÓN DE ESTE FORMULARIO SOLAMENTE PUEDE REALIZARSE DE FORMA
> PERSONAL ANTE LA UNIDAD COMPETENTE DE POLICÍA NACIONAL. NO ESTA ADMITIDA SU
> PRESENTACIÓN POR MEDIOS TELEMÁTICOS O REGISTROS PÚBLICOS.

The applicant must appear personally; there is no telematic route. This matches
the service's stated scope — we prepare the file, the client submits it in their
own name — and should be stated plainly to clients rather than discovered on the
day.

---

## Barcelona Padrón authorisation (`Autoritzaciodomicili_cat.pdf`)

The City of Barcelona's *Autorització d'inscripció al Padró municipal
d'habitants*, used when a student lives in a flat that is not in their name.
Generated by `src/lib/forms/padron-authorization.ts`, downloaded from the
student portal's Padrón wizard.

**Unlike EX-17/EX-18, this PDF is a real fillable form** (27 AcroForm fields),
so it is filled by field name — no coordinate calibration. The field names are
generic (`Texto1`…`Texto24`), so they were mapped to the printed labels by
position:

| Field | Printed label |
|---|---|
| `Texto1` / `Texto2` | Persona que autoritza — name / DNI-NIE |
| `Texto3` / `Texto4` | Company represented / its NIF (optional) |
| `Texto5`–`Texto8` | Carrer / Núm. / Escala / Pis i porta |
| `RC` | Referència cadastral (optional) |
| `Group1` | Relationship: `Opción1` owner, `Opción2` usufruct, `Opción3` tenant (`Opción4`, parent of a minor, unused) |
| `Texto9` / `Texto10` | Owner's name / NIF — **required when the signer is the tenant** |
| `Texto11` / `Texto12` | The student: name / ID document |
| `Texto13`–`Texto24` | Further people to register — left blank |
| `Data` | **Left blank on purpose** — the signer dates it by hand; the authorisation is valid for three months from that date |

`tests/padron.test.ts` asserts this mapping value by value. If the city
re-issues the form, run `npm run forms:inspect -- templates/forms/Autoritzaciodomicili_cat.pdf`
and re-check it against the table before shipping.

Rules the filler enforces:

- **Barcelona addresses only.** Every municipality has its own form; an address
  in L'Hospitalet or Sant Cugat is refused with a message rather than printed
  on the wrong city's paper.
- **Owner details only in the tenant row.** Given for an owner, they are ignored.
- **DNI, NIE and CIF check characters are validated** (`src/lib/spanish-ids.ts`)
  before anything prints. A passport is accepted for the signer, as the city's
  own document checklist allows.
- **Unicode text via Noto Sans**, so names like "Łukasz Wiśniewski" print; text
  the font cannot draw (e.g. Chinese) is refused with a request for the Latin
  spelling on the ID, instead of printing blank boxes.
- **Nothing about the signer is stored.** The form is filled in memory and
  streamed to the student.
- The output is **flattened**, so it prints identically everywhere and cannot be
  edited after download.

The residence path (*Autorització d'empadronament de domicili col·lectiu*,
`Domicilicolectiu_cat.pdf`) is not pre-filled: the residence completes, signs
and stamps it. The portal gives the student a Spanish request to send to
reception, with the link to the city's form.
