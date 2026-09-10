# Government form templates (EX-17 / EX-18)

## Why the templates are not in this repository

The official PDFs are published by the Ministerio de Inclusión, Seguridad Social
y Migraciones. They are not redistributed here: they are revised periodically,
and shipping a stale copy is worse than shipping none — a form on a superseded
revision is refused at the counter, and the applicant loses the appointment.

Download the current versions from the ministry's *Modelos de solicitud* page and
place them in `templates/forms/`:

```
templates/forms/EX-17.pdf   # TIE — non-EU nationals
templates/forms/EX-18.pdf   # CUE — EU/EEA/Swiss nationals
```

## EX-17 vs EX-18 — one or the other, never both

| Applicant | Form | Produces |
|---|---|---|
| Non-EU/EEA/Swiss national | **EX-17** | Tarjeta de Identidad de Extranjero (physical card) |
| EU/EEA/Swiss national | **EX-18** | Certificado de Registro de Ciudadano de la UE (green certificate) |

`selectForm()` in `src/lib/forms/field-map.ts` routes on nationality
automatically. A student has no reliable way to self-select this correctly, so
the engine decides rather than asking.

## Updating the field map after a template revision

The internal AcroForm field names are an implementation detail of whatever tool
produced the PDF. They are **not a published contract** and change between
revisions.

```bash
# 1. Drop the new template into templates/forms/
# 2. Dump its field names:
npm run forms:inspect -- templates/forms/EX-17.pdf

# 3. Update TEMPLATES + buildFieldValues in src/lib/forms/field-map.ts
# 4. Verify:
npm test
```

`fillFormStrict()` — which production uses — **refuses to emit a PDF** when the
map references fields the template does not contain. It fails loudly rather than
quietly producing a half-empty form that gets rejected at the police station.
`fillForm()` is the lenient variant, used only for staff preview.

## Rules the engine enforces

These are encoded in `src/lib/forms/pdf.ts` and covered by tests in
`tests/pdf.test.ts`.

**1. Missing optional fields stay genuinely empty.**
No `N/A`, no `-`, no empty-but-modified field. An officer reading "N/A" in the
second-surname box treats it as a declared surname, and the mismatch against the
passport can invalidate the file. This applies to second surname, pre-assigned
NIE, and floor/door.

**2. Section 2 (Representative) stays blank — and is asserted, not just skipped.**
If a future revision ships with prefilled representative data, the job throws.
Populating that section declares that the agency legally represents the
applicant, which triggers a power-of-attorney requirement the agency neither
holds nor claims.

**3. The DEHú electronic-notification box stays unchecked.**
Opting in starts legally binding notification deadlines delivered to a
government mailbox that requires a Spanish digital certificate to open. A newly
arrived student does not have one, and a missed notification can close a file.
This is one of the most damaging defaults on the form.

**4. `NeedAppearances` → `updateFieldAppearances()` → `flatten()`, in that order.**
The ordering is load-bearing:

- `NeedAppearances=true` asks the viewer to regenerate appearance streams. The
  ministry templates ship with streams that assume empty fields; without this,
  some viewers render the original blank appearance and the form prints empty.
- `updateFieldAppearances()` generates those streams immediately, so the file is
  correct even in viewers that ignore `NeedAppearances` — Preview.app and most
  mobile viewers do ignore it.
- `flatten()` converts fields into ordinary page content. This removes the blue
  interactive highlight and stops text shifting or re-wrapping when printed at a
  locutorio — the single most common cause of a rejected printout.

Flatten **last**: after flattening there are no fields left to set or restyle.

## Character encoding

The engine embeds WinAnsi Helvetica, which covers the Latin-1 range these forms
use. A name containing characters outside that range (Cyrillic, CJK, some
diacritics) will throw on encode.

That is deliberate — it surfaces the problem at generation time rather than
printing mojibake onto a legal document. Supply the transliteration from the
passport's machine-readable zone, which is what the authorities expect on the
form anyway.

## Testing without the official templates

CI cannot use the real PDFs, so a synthetic fixture with identical field names
is generated instead:

```bash
npx tsx scripts/make-test-template.mts templates/forms/EX-17.pdf
npx tsx scripts/make-test-template.mts templates/forms/EX-18.pdf
```

This verifies the **engine's behaviour** — routing, blank handling, Section 2,
DEHú, flattening. It does not verify the real template's layout. Field-name
drift against the genuine form is caught separately by `fillFormStrict()`.

The PDF tests skip automatically when no fixture is present, so a fresh clone
does not fail.
