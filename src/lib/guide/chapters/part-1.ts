import type { Chapter } from "../types";
import { MINISTRY, POLICE, PORTAL } from "../sources";

export const pickYourRoute: Chapter = {
  slug: "pick-your-route",
  number: "01",
  navTitle: "Pick your route",
  kicker: "01 · Start here",
  title: "EU or non-EU: pick your student paperwork route first",
  metaTitle: "EU or non-EU? Pick your student paperwork route",
  description:
    "Student paperwork in Spain splits in two: an EU registration certificate (EX-18, €12) or a non-EU TIE card (EX-17, €16.08). Find which one is yours.",
  lede:
    "Most avoidable mistakes start with following the wrong route. Your nationality decides your paperwork. Choose once, then skip everything not tagged for you.",
  keyFacts: [
    "EU, EEA and Swiss students staying more than three months apply for an EU registration certificate: form EX-18, a €12 fee, a green paper certificate and no fingerprints.",
    "Students with any other passport who are authorised to study for more than six months apply for a TIE: form EX-17, a €16.08 fee, a physical photo card and fingerprints in person, normally within one month of entry.",
    "If one of four special situations fits you, check before booking anything. Booking the wrong procedure wastes the appointment and sends you back to the end of the queue.",
  ],
  blocks: [
    {
      kind: "cards",
      items: [
        {
          label: "Route A",
          title: "EU, EEA or Swiss passport",
          body: [
            "Staying more than 3 months? You apply for an EU registration certificate. You get a green paper certificate, not a photo card. Form EX-18, no fingerprints, fee €12, within 3 months of entry.",
          ],
          href: "/guide/eu-registration-certificate",
          cta: "Read the EU registration steps",
        },
        {
          label: "Route B",
          title: "Any other passport",
          body: [
            "Authorised to study for more than 6 months? You apply for a TIE. You get a physical photo ID card. Form EX-17, fingerprints in person, fee €16.08, normally within 1 month of entry.",
          ],
          href: "/guide/getting-your-tie",
          cta: "Read the TIE steps",
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Four situations that change your route entirely",
      body: [
        "You already hold Spanish residence. You have EU-family rights through a spouse or parent. You’re on an EU student-mobility arrangement. Or you applied for your authorisation from inside Spain rather than at a consulate, in which case your one-month clock runs from notification of the favourable resolution, not from entry.",
        "If any of these describe you, confirm with your university’s international office before booking anything. Booking the wrong procedure wastes the appointment and you go back in the queue.",
      ],
    },
    {
      kind: "table",
      caption: "Route A vs Route B, in numbers",
      head: ["", "EU, EEA, Swiss", "Non-EU"],
      rows: [
        ["Time to apply", "3 months (90 days)", "1 month (30 days)"],
        ["Government fee (790-012)", "€12", "€16.08"],
        ["Documents to produce (official checklists)", "6", "9"],
        ["Immigration visits in person", "1", "Up to 2"],
        ["Fingerprints (biometric appointment)", "No", "Yes"],
      ],
    },
    { kind: "h3", text: "Your first term, on one page" },
    {
      kind: "p",
      text: "Follow your line from left to right. The life-admin items are for everyone: do them while you wait for your appointment.",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "**Route B, non-EU (TIE card):** arrive (day 0), first-week basics, start searching for a slot (day 1), padrón (day 3–30), EX-17 and pay 790-012 (€16.08), fingerprint appointment (apply by day 30), collect your TIE (ask how). In the middle sits the wait: 2–8+ weeks that nobody controls.",
        "**Route A, EU, EEA and Swiss (certificate):** arrive (day 0), first-week basics, padrón as proof of address, EX-18 and four proofs, pay 790-012 (€12), appointment where the certificate is issued (by day 90).",
        "**Everyone, life admin:** address and mobile data (day 0–3), health cover active (day 0–3), T-mobilitat and travel pass (day 1–10), bank account working (by day 14), Carnet Jove (day 10–60), and your policy end date in your calendar.",
      ],
    },
    {
      kind: "p",
      text: "Once you know your route, the next thing to read is [the 30-day clock](/guide/the-30-day-clock), which shows what is due when.",
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
  title: "The 30-day TIE clock and your first 90 days in Spain",
  metaTitle: "The 30-day TIE clock: what is due when in Spain",
  description:
    "Your first 90 days in Spain, to scale: the one-month TIE deadline, the three-month EU deadline, and the appointment wait nobody controls.",
  lede:
    "Only two of these are legal deadlines. The rest quietly block the next step if you leave them. One of them nobody controls. Day 0 is the day you enter Spain.",
  keyFacts: [
    "Only two items are hard legal deadlines: applying for the TIE in person within one month of entry (non-EU), and applying for the EU registration certificate within three months of entry (EU, EEA, Swiss).",
    "The 30-day clock applies to the ordinary non-EU study route over six months and runs from entry, or from notification of your favourable resolution if you applied from inside Spain.",
    "A realistic appointment wait is two to eight weeks or more and nobody controls it, so the appointment, not the paperwork, is the bottleneck.",
    "Start searching for your appointment on your first weekday in Spain. Everything else can happen while you wait.",
    "Your own authorisation document overrides any general timeline. Read it.",
  ],
  blocks: [
    {
      kind: "table",
      caption: "Your first 90 days, to scale. Day 0 is the day you enter Spain.",
      head: ["Task", "Window", "What kind of task", "Note"],
      rows: [
        ["Address and mobile data", "Day 0–3", "Do when convenient", "Confirm campus too"],
        ["Health cover active", "Day 0–3", "Do when convenient", "Save the assistance number"],
        ["Bank account working", "Day 0–14", "Blocks something else", "Receive money and pay rent"],
        ["T-mobilitat card and pass", "Day 1–10", "Blocks something else", "Register, then load"],
        ["Padrón (town hall address record)", "Day 3–30", "Blocks something else", "See [registering your address](/guide/register-your-address-padron)"],
        ["Realistic appointment wait", "Day 1–90", "Nobody controls this", "2–8+ weeks, unpredictable"],
        ["Apply for the TIE in person", "Day 1–30", "Hard legal deadline", "Within 1 month of entry. See [when the appointment won’t come](/guide/appointment-wont-come) if the calendar doesn’t cooperate"],
        ["EU registration certificate", "Day 0–90", "Hard legal deadline", "Within 3 months of entry"],
        ["Carnet Jove", "Day 10–60", "Do when convenient", "5–9 working days to activate"],
      ],
      note:
        "Deadlines reflect the ordinary study routes described by the Ministry and the National Police. Your own authorisation document overrides anything shown here. Read it.",
    },
    {
      kind: "callout",
      tone: "key",
      title: "Do this first",
      body: [
        "Start searching for your appointment on your first weekday in Spain. Everything else can happen while you wait.",
        "Calendar not cooperating? Missing the one-month window is usually recoverable: read [when the appointment won’t come](/guide/appointment-wont-come).",
      ],
    },
    {
      kind: "callout",
      tone: "key",
      title: "What the 30 days apply to",
      body: [
        "The 30-day clock applies to the ordinary non-EU study route over six months, and runs from entry, or from your favourable resolution if you applied from inside Spain. EU, EEA and Swiss students follow a different route entirely: [chapter 01](/guide/pick-your-route) splits them.",
      ],
    },
    {
      kind: "table",
      caption: "Put these in your calendar now",
      head: ["Deadline", "Who", "Rule"],
      rows: [
        ["Apply for your TIE", "Non-EU", "Within 1 month of entry (or of your favourable resolution, if you applied in Spain)"],
        ["EU registration", "EU", "Within 3 months of entry"],
        ["Health policy ends", "Everyone", "Must cover your full authorised period, not just the academic year"],
        ["Padrón renewal", "Non-EU", "Every 2 years without long-term residence. Lapses silently."],
        ["T-jove runs out", "Under 30", "90 consecutive days from your first tap, not 90 days of use"],
        ["Authorisation expires", "Non-EU", "No appointment yet as this gets close? Talk to a professional"],
        ["Card collection", "Non-EU", "Ask at your appointment. Don’t book flights around a guess."],
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
  title: "Your first week in Barcelona: eight things to do before the paperwork starts",
  metaTitle: "Your first week in Barcelona: an 8-point checklist",
  description:
    "Eight things to do in your first week in Barcelona. None involve a government office, and all of them make the paperwork possible.",
  lede:
    "Nothing here involves a government office. It’s the stuff that makes everything else possible. Tick them off as you go.",
  keyFacts: [
    "Nothing in the first week involves a government office; it is preparation that makes the later paperwork possible.",
    "Ask your landlord or head tenant in writing whether they will provide padrón paperwork before you need it.",
    "Read your visa or authorisation and write down your registration deadline.",
  ],
  blocks: [
    {
      kind: "checklist",
      items: [
        "Ask your landlord or head tenant, in writing, whether they will provide padrón paperwork, before you need it. (See [registering your address](/guide/register-your-address-padron).)",
        "Email your international office: do they run group or block TIE appointments for this intake?",
        "Get working mobile data. Home SIM roaming is fine for now.",
        "Check your health cover is active in Spain and save the assistance number.",
        "Read your visa or authorisation and write down your registration deadline. (See [the clock](/guide/the-30-day-clock).)",
        "Put passport, visa, insurance, enrolment and rental docs in one folder.",
        "Find your nearest copisteria now, not at 8am on appointment day.",
        "Make sure you can receive money and pay rent from a working account. (See [costs, banking and SIM](/guide/costs-bank-account-sim).)",
      ],
    },
  ],
  sources: [],
};

export const nieTiePadron: Chapter = {
  slug: "nie-tie-padron",
  number: "04",
  navTitle: "NIE, TIE, padrón",
  kicker: "04 · Vocabulary",
  title: "NIE, TIE, padrón, expediente: four words people mix up",
  metaTitle: "NIE vs TIE vs padrón vs expediente: what each is",
  description:
    "A NIE is a number, a TIE is a photo card and the padrón is an address record. Having one does not give you the others. What each means for students.",
  lede:
    "The most common confusion, and it costs people appointments. Having one of these does not give you the others.",
  keyFacts: [
    "A NIE is your foreigner ID number, a TIE is the photo card proving your authorised status, and the padrón registers where you live with the town hall.",
    "A NIE does not let you stay, and a padrón does not fix your immigration status.",
    "If a NIE already appears on your visa or approval decision, do not book a NIE appointment. A NIE does not let you stay.",
    "Your número de expediente (file number) is printed on your appointment confirmation and every resolution; quote it in every enquiry.",
  ],
  blocks: [
    {
      kind: "cards",
      items: [
        {
          label: "A number",
          title: "NIE",
          subtitle: "Número de Identidad de Extranjero",
          body: [
            "Your foreigner ID number. It’s often already printed on your visa or approval decision. If it’s already there, don’t book a NIE appointment.",
          ],
          meta: "A NIE does not let you stay.",
        },
        {
          label: "A photo card",
          title: "TIE",
          subtitle: "Tarjeta de Identidad de Extranjero",
          body: [
            "Proves your authorised status if you’re authorised for more than 6 months. Non-EU only.",
          ],
          meta: "Fingerprints in person · €16.08 · EX-17",
          href: "/guide/getting-your-tie",
          cta: "How to get your TIE",
        },
        {
          label: "A certificate",
          title: "EU registration",
          subtitle: "Certificado de Registro de Ciudadano de la UE",
          body: [
            "Green paper certificate containing your NIE. EU, EEA and Swiss students only.",
          ],
          meta: "Not photo ID: always carry your passport or national ID too · €12 · EX-18",
          href: "/guide/eu-registration-certificate",
          cta: "How to get your certificate",
        },
        {
          label: "Free · address registration",
          title: "Padrón",
          subtitle: "Empadronamiento",
          body: [
            "Registers where you live with the town hall. Needed for health services; often asked for at card appointments.",
          ],
          meta: "A padrón does not fix your immigration status.",
          href: "/guide/register-your-address-padron",
          cta: "How to register your address",
        },
        {
          label: "A reference",
          title: "Número de expediente",
          subtitle: "Your file number",
          body: [
            "On your appointment confirmation and every resolution. Without it, nobody can find you.",
            "Quote it in every email or call. Photograph it the day you get it.",
          ],
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "The most common wasted booking",
      body: [
        "If a NIE already appears on your visa or approval decision, do not book a NIE appointment. A NIE does not let you stay.",
      ],
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
