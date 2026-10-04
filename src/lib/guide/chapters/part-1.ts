import type { Chapter } from "../types";
import { MINISTRY, POLICE } from "../sources";

const P1 = "Part 1 · Get oriented";

export const pickYourRoute: Chapter = {
  slug: "pick-your-route",
  number: "01",
  navTitle: "Pick your route",
  kicker: "01 · Start here",
  part: P1,
  audience: [{ tone: "all", label: "Everyone" }],
  title: "EU or non-EU: pick your student paperwork route first",
  metaTitle: "EU or non-EU? Pick your student paperwork route",
  description:
    "Student paperwork in Spain splits in two: an EU registration certificate (EX-18, €12) or a non-EU TIE card (EX-17, €16.08). Find which one is yours.",
  lede: "Most avoidable mistakes start with following the wrong route. Your nationality decides your paperwork. Choose once, then skip everything not tagged for you.",
  keyFacts: [
    "EU, EEA or Swiss passport → registration certificate, within 3 months.",
    "Any other passport → TIE card, normally within 1 month of entry.",
    "If one of the four special situations fits you, check before booking anything. Booking the wrong procedure wastes the appointment and sends you back to the end of the queue.",
  ],
  blocks: [
    { kind: "h3", text: "Which passport are you studying on?" },
    {
      kind: "routecards",
      items: [
        {
          tone: "eu",
          label: "Route A",
          title: "EU, EEA or Swiss",
          lede: "Staying more than 3 months? You apply for an **EU registration certificate**.",
          rows: [
            { k: "You get", v: "A green paper certificate, not a photo card" },
            { k: "Form", v: "EX-18" },
            { k: "Fingerprints", v: "No" },
            { k: "Fee", v: "€12" },
            { k: "Deadline", v: "Within **3 months** of entry" },
          ],
          href: "/guide/eu-registration-certificate",
          cta: "Go to 06",
        },
        {
          tone: "non",
          label: "Route B",
          title: "Any other passport",
          lede: "Authorised to study for more than 6 months? You apply for a **TIE**.",
          rows: [
            { k: "You get", v: "A physical photo ID card" },
            { k: "Form", v: "EX-17" },
            { k: "Fingerprints", v: "Yes, in person" },
            { k: "Fee", v: "€16.08" },
            { k: "Deadline", v: "Normally within **1 month** of entry" },
          ],
          href: "/guide/getting-your-tie",
          cta: "Go to 05",
        },
      ],
    },
    {
      kind: "callout",
      tone: "note",
      title: "Wait — four situations change your route entirely",
      body: [
        "**1.** You already hold Spanish residence. **2.** You have EU-family rights through a spouse or parent. **3.** You're on an EU student-mobility arrangement. **4.** You applied for your authorisation **from inside Spain**, not at a consulate. Your one-month clock then runs from notification of the favourable resolution, not from entry.",
        "If any of these is you, confirm with your university's international office *before* booking anything. Booking the wrong procedure wastes the appointment and sends you back to the end of the queue.",
      ],
    },
    { kind: "h3", text: "Your first term, on one page" },
    { kind: "p", text: "Follow your line left to right. Grey stops are for everyone; do them while you wait for your appointment." },
    {
      kind: "swimlanes",
      lanes: [
        {
          tone: "non",
          chip: "Route B",
          name: "Non-EU",
          sub: "TIE card",
          stops: [
            { label: "Arrive", sub: "day 0" },
            { label: "First-week basics" },
            { label: "Start searching for a slot", sub: "day 1" },
            { label: "Padrón", sub: "day 3–30" },
            { label: "EX-17 + pay 790-012", sub: "€16.08" },
            { label: "Fingerprint appointment", sub: "apply by day 30", mark: "deadline" },
            { label: "Collect your TIE", sub: "ask how", mark: "final" },
          ],
          wait: { label: "THE WAIT · 2–8+ WEEKS · NOBODY CONTROLS IT", from: 2, to: 5 },
        },
        {
          tone: "eu",
          chip: "Route A",
          name: "EU · EEA · Swiss",
          sub: "Certificate",
          stops: [
            { label: "Arrive", sub: "day 0" },
            { label: "First-week basics" },
            { label: "Padrón", sub: "proof of address" },
            { label: "EX-18 + four proofs" },
            { label: "Pay 790-012", sub: "€12" },
            { label: "Appointment: certificate issued", sub: "by day 90", mark: "deadline" },
          ],
        },
        {
          tone: "all",
          chip: "Everyone",
          name: "Life admin",
          sub: "Do while you wait",
          stops: [
            { label: "Address + mobile data", sub: "day 0–3" },
            { label: "Health cover active", sub: "day 0–3" },
            { label: "T-mobilitat + pass", sub: "day 1–10" },
            { label: "Bank account working", sub: "by day 14" },
            { label: "Carnet Jove", sub: "day 10–60" },
            { label: "Policy end date in calendar" },
          ],
        },
      ],
    },
    {
      kind: "bars2",
      title: "Route A vs Route B, in numbers",
      legend: ["EU", "Non-EU"],
      rows: [
        { label: "Time to apply", sub: "more is easier", eu: { v: "90 days", pct: 100 }, non: { v: "30 days", pct: 33 } },
        { label: "Government fee", sub: "790-012", eu: { v: "€12", pct: 75 }, non: { v: "€16.08", pct: 100 } },
        { label: "Documents to produce", sub: "official checklists", eu: { v: "6", pct: 67 }, non: { v: "9", pct: 100 } },
        { label: "Immigration visits", sub: "in person", eu: { v: "1", pct: 50 }, non: { v: "up to 2", pct: 100 } },
        { label: "Fingerprints", sub: "biometric appointment", chips: ["EU: No", "Non-EU: Yes"] },
      ],
    },
    {
      kind: "p",
      text: "Once you know your route, read [the 30-day clock](/guide/the-30-day-clock) to see what is due when.",
    },
  ],
  faq: [
    {
      q: "Which student paperwork do I need in Spain if I have an EU passport?",
      a: "If you hold an EU, EEA or Swiss passport and are staying more than three months, you apply for an EU registration certificate using form EX-18. It is a green paper certificate rather than a photo card, it needs no fingerprints, and the fee is €12.",
    },
    {
      q: "Which student paperwork do I need in Spain if I have a non-EU passport?",
      a: "If you hold any other passport and are authorised to study for more than six months, you apply for a TIE, a physical photo card, using form EX-17, normally within one month of entry. Fingerprints are required and the fee is €16.08.",
    },
  ],
  sources: [POLICE, MINISTRY],
};

export const theClock: Chapter = {
  slug: "the-30-day-clock",
  number: "02",
  navTitle: "The clock",
  kicker: "02 · The clock",
  part: P1,
  audience: [{ tone: "all", label: "Everyone" }],
  title: "The 30-day TIE clock and your first 90 days in Spain",
  metaTitle: "The 30-day TIE clock: what is due when in Spain",
  description: "Your first 90 days in Spain, to scale: the one-month TIE deadline, the three-month EU deadline, and the appointment wait nobody controls.",
  lede: "Only two of these are legal deadlines. The rest quietly block the next step if you leave them. One of them nobody controls.",
  keyFacts: [
    "Non-EU: apply for your TIE within 1 month. EU: register within 3 months.",
    "Bank, travel pass and padrón aren't deadlines, but they block other steps.",
    "The appointment wait is the only thing you can't speed up. Start searching on day 1.",
    "The 30-day clock applies to the ordinary non-EU study route over six months and runs from entry, or from notification of your favourable resolution if you applied from inside Spain.",
  ],
  blocks: [
    {
      kind: "gantt",
      title: "Your first 90 days, to scale",
      sub: "Day 0 = the day you enter Spain",
      legend: [
        { tone: "legal", label: "Hard legal deadline" },
        { tone: "blocks", label: "Blocks something else" },
        { tone: "easy", label: "Do when convenient" },
        { tone: "nobody", label: "Nobody controls this" },
      ],
      axisStart: "day 0",
      rows: [
        { label: "Address + mobile data", sub: "confirm your campus too", tone: "easy", from: 0, to: 3, value: "0-3" },
        { label: "Health cover active", sub: "save the assistance number", tone: "easy", from: 0, to: 3, value: "0-3" },
        { label: "Bank account working", sub: "receive money + pay rent", tone: "blocks", from: 0, to: 14, value: "0-14" },
        { label: "T-mobilitat + pass", sub: "register, then load", tone: "blocks", from: 1, to: 10, value: "1-10" },
        { label: "Padrón", sub: "town hall address record", tone: "blocks", from: 3, to: 30, value: "3-30" },
        { label: "Realistic appointment wait", sub: "2–8+ weeks, unpredictable", tone: "nobody", from: 1, to: 90, value: "1-90" },
        { label: "Apply for TIE in person", sub: "within 1 month of entry*", tag: { tone: "non", label: "Non-EU" }, tone: "legal", from: 0, to: 30, value: "by 30", mark: true },
        { label: "EU registration", sub: "within 3 months of entry", tag: { tone: "eu", label: "EU" }, tone: "legal", from: 0, to: 90, value: "by 90", mark: true },
        { label: "Carnet Jove", sub: "5–9 working days to activate", tone: "easy", from: 10, to: 60, value: "10-60" },
      ],
      note: "Deadlines reflect the ordinary study routes described by the Ministry and the National Police. Your own authorisation document overrides anything shown here, so read it.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Do this first",
      body: ["Start searching for your appointment on your first weekday in Spain. Everything else can happen while you wait."],
    },
    {
      kind: "callout",
      tone: "note",
      title: "*Calendar not cooperating?",
      body: ["Go to [section 07](/guide/appointment-wont-come). Missing the window is usually recoverable."],
    },
    {
      kind: "table",
      caption: "Put these in your calendar now",
      head: ["Deadline", "Who", "Rule", "My date"],
      blankLastColumn: true,
      rows: [
        ["Apply for your TIE", "Non-EU", "Within 1 month of entry (or of your favourable resolution, if you applied in Spain)"],
        ["EU registration", "EU", "Within 3 months of entry"],
        ["Health policy ends", "Everyone", "Must cover your full authorised period, not just the academic year"],
        ["Padrón renewal", "Non-EU", "Every 2 years without long-term residence. Lapses silently."],
        ["T-jove runs out", "Under 30", "90 consecutive days from your first tap, not 90 days of use"],
        ["Authorisation expires", "Non-EU", "No appointment yet as this gets close? Talk to a professional"],
        ["Card collection", "Non-EU", "Ask at your appointment. Don't book flights around a guess."],
      ],
      note: "Every date in this guide that can quietly bite you, in one place. Write yours in.",
    },
  ],
  faq: [
    {
      q: "How long do I have to apply for my TIE in Spain as a student?",
      a: "Non-EU students normally have one month from entry. The clock applies to the ordinary study route over six months and runs from entry, or from notification of the favourable resolution if you applied for your authorisation from inside Spain.",
    },
    {
      q: "How long do I have to register as an EU student in Spain?",
      a: "EU, EEA and Swiss students staying more than three months register within three months of entry, by applying for an EU registration certificate.",
    },
  ],
  sources: [POLICE, MINISTRY],
};

export const firstWeek: Chapter = {
  slug: "your-first-week",
  number: "03",
  navTitle: "Your first week",
  kicker: "03 · Your first week",
  part: P1,
  audience: [{ tone: "all", label: "Everyone" }],
  title: "Your first week in Barcelona: eight things to do before the paperwork starts",
  metaTitle: "Your first week in Barcelona: an 8-point checklist",
  description: "Eight things to do in your first week in Barcelona. None involve a government office, and all of them make the paperwork possible.",
  lede: "None of these involve a government office. They're what makes everything else possible. Tick them off.",
  keyFacts: [
    "Nothing in the first week involves a government office; it is preparation that makes the later paperwork possible.",
    "Ask your landlord or head tenant in writing whether they'll provide padrón paperwork, before you need it.",
    "Read your visa or authorisation and write down your registration deadline.",
  ],
  blocks: [
    {
      kind: "checklist",
      items: [
        "Ask your landlord or head tenant, **in writing**, whether they'll provide padrón paperwork, before you need it",
        "Email your international office: do they run **group or block TIE appointments** for this intake?",
        "Get working mobile data (home SIM roaming is fine for now)",
        "Check your health cover is **active in Spain** and save the assistance number",
        "Read your visa or authorisation and **write down your registration deadline**",
        "Put passport, visa, insurance, enrolment and rental docs in **one folder**",
        "Find your nearest *copisteria* (print shop) now, not at 8am on appointment day",
        "Make sure you can **receive money and pay rent** from a working account",
      ],
    },
    {
      kind: "p",
      text: "Next: [registering your address](/guide/register-your-address-padron), [the clock](/guide/the-30-day-clock) and [costs, bank account and SIM](/guide/costs-bank-account-sim).",
    },
  ],
  sources: [],
};

export const nieTiePadron: Chapter = {
  slug: "nie-tie-padron",
  number: "04",
  navTitle: "NIE, TIE, padrón",
  kicker: "04 · Vocabulary",
  part: P1,
  audience: [{ tone: "all", label: "Everyone" }],
  title: "NIE, TIE, padrón, expediente: four words people mix up",
  metaTitle: "NIE vs TIE vs padrón vs expediente: what each is",
  description: "A NIE is a number, a TIE is a photo card and the padrón is an address record. Having one does not give you the others. What each means for students.",
  lede: "The most common confusion, and it costs people appointments. Having one of these does not give you the others.",
  keyFacts: [
    "A NIE is your foreigner ID number, a TIE is the photo card proving your authorised status, and the padrón registers where you live with the town hall.",
    "A NIE does not let you stay, and a padrón does not fix your immigration status.",
    "If a NIE already appears on your visa or approval decision, do not book a NIE appointment.",
    "Your número de expediente (file number) is on your appointment confirmation and every resolution; quote it in every email or call.",
  ],
  blocks: [
    {
      kind: "terms",
      head: ["Word", "What it is", "Remember"],
      rows: [
        {
          term: "NIE",
          native: "Número de Identidad de Extranjero",
          kind: "A number",
          what: ["Your foreigner ID number. Often already printed on your visa or approval decision"],
          remember: ["If it's already there, **don't book a NIE appointment**. **A NIE does not let you stay.**"],
        },
        {
          term: "TIE",
          native: "Tarjeta de Identidad de Extranjero",
          kind: "A photo card · Non-EU",
          what: ["Proves your authorised status if you're authorised for more than 6 months."],
          remember: ["Fingerprints in person · **€16.08** · EX-17"],
        },
        {
          term: "EU registration",
          native: "Certificado de Registro de Ciudadano de la UE",
          kind: "A certificate · EU",
          what: ["Green paper certificate containing your NIE."],
          remember: ["Not photo ID: always carry your passport or national ID too · **€12** · EX-18"],
        },
        {
          term: "Padrón",
          native: "Empadronamiento",
          kind: "An address record · Free",
          what: ["Registers where you live with the town hall. Needed for health services; often asked for at card appointments."],
          remember: ["**It doesn't fix your immigration status.**"],
        },
        {
          term: "Expediente",
          native: "Número de expediente",
          kind: "Your file number",
          what: ["On your appointment confirmation and every resolution. Without it, nobody can find you."],
          remember: ["Quote it in every email or call. **Photograph it the day you get it.**"],
        },
      ],
    },
    {
      kind: "p",
      text: "Where each one comes from: [how to get your TIE](/guide/getting-your-tie), [the EU registration certificate](/guide/eu-registration-certificate) and [registering your address](/guide/register-your-address-padron).",
    },
  ],
  faq: [
    {
      q: "What is the difference between a NIE, a TIE and the padrón?",
      a: "A NIE is a number, a TIE is a photo card and the padrón is an address record. The NIE is your foreigner ID number, the TIE is the card proving your authorised status, and the padrón registers where you live with the town hall. Having one of these does not give you the others.",
    },
    {
      q: "Do I need to book a NIE appointment as a student?",
      a: "Not if a NIE already appears on your visa or approval decision. If it is already there, do not book a NIE appointment, and remember that a NIE does not let you stay.",
    },
  ],
  sources: [POLICE],
};
