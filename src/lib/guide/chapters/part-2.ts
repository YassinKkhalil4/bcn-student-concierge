import type { Chapter } from "../types";
import { POLICE, PORTAL } from "../sources";

export const gettingYourTie: Chapter = {
  slug: "getting-your-tie",
  number: "05",
  navTitle: "Getting your TIE",
  kicker: "05 · Route B · non-EU",
  title: "How to get your TIE in Barcelona: five steps for non-EU students",
  metaTitle: "How to get your TIE in Barcelona: 5 steps (EX-17)",
  description:
    "Five steps to a TIE for non-EU students in Barcelona: book the right appointment, pay fee 790-012 (€16.08), attend with originals, avoid the traps.",
  lede:
    "Five steps, one of which you cannot control. Start on your first weekday in Spain: the appointment, not the paperwork, is the bottleneck.",
  keyFacts: [
    "Book the fingerprint appointment (toma de huellas, usually labelled POLICÍA — TOMA DE HUELLAS), not a NIE one: that is the classic wasted trip.",
    "The 790-012 fee form only counts once it is paid and stamped at a bank. Generating the form is not paying it.",
    "Bring originals and paper copies. Screenshots don’t count, and names and passport or NIE numbers must match across every document.",
    "The TIE documents a permission you already hold; it does not create one. If your stay is six months or less you generally don’t need a TIE at all.",
  ],
  blocks: [
    {
      kind: "steps",
      items: [
        {
          title: "Read your own authorisation first",
          body: [
            "The TIE documents a permission you already hold. It does not create one. Check the dates and conditions on your visa or approval decision. If your stay is six months or less, you generally don’t need a TIE at all.",
          ],
        },
        {
          title: "Book the citaprevia",
          body: [
            "Official appointment portal → Barcelona province → the fingerprint/card-issuance procedure, usually labelled POLICÍA — TOMA DE HUELLAS. Booking a NIE-number appointment instead is the classic wasted trip.",
          ],
          tags: ["Slots release irregularly", "Check early morning", "Keep the confirmation"],
        },
        {
          title: "Fill EX-17 and pay tasa 790-012",
          body: [
            "Download the current EX-17 from the National Police student-card page. Generate Modelo 790 Código 012 and select the first-issuance category. Generating the form is not paying it: follow the banking instructions and keep the stamped proof.",
          ],
          tags: ["EX-17", "790-012", "€16.08"],
        },
        {
          title: "Attend in person with originals",
          body: [
            "They check your documents and take your fingerprints. Bring originals and a set of paper copies. Names and passport/NIE numbers must match across every document. ",
          ],
        },
        {
          title: "Ask exactly how you collect it",
          body: [
            "Some offices require a separate collection appointment. Ask whether your office issues same-day or requires a second collection appointment, and what the wait is. Ask where, when, and what to bring.",
            "Don’t book flights around an assumed collection date, and check your re-entry position before travelling with a card still pending.",
          ],
        },
      ],
    },
    {
      kind: "checklist",
      title: "Bring all of this",
      items: [
        "Appointment confirmation",
        "Completed, signed EX-17",
        "Original passport and the copies your office asks for",
        "Visa or authorisation decision",
        "Proof of entry: passport stamp or travel evidence",
        "Recent colour photo, 32 × 26 mm, plain white background, face forward, head uncovered, no tinted lenses (budget about €6–12 for a set of photos)",
        "Paid and stamped 790-012 receipt",
        "Padrón certificate, if your office requests it",
        "Current enrolment evidence, if requested",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "The five ways people waste the trip",
      body: [
        "**Wrong appointment type.** They booked NIE assignment instead of fingerprints.",
        "**Generated but never paid.** The 790-012 needs a bank payment and a stamp.",
        "**Name mismatch.** Middle names present on one document, missing on another.",
        "**Digital only.** Relying on the phone when the checklist asks for paper.",
        "**Missing photocopies.** Offices routinely want the passport bio page and every stamped page. Copy the lot.",
      ],
    },
    {
      kind: "p",
      text: "**Can’t find an appointment?** There is no legitimate way to guarantee one. What you can do is make sure that when you get one, nothing on your file sends you home again. [When the appointment won’t come](/guide/appointment-wont-come) covers what to do while you wait.",
    },
  ],
  faq: [
    {
      q: "Do I need a TIE if I am studying in Spain for six months or less?",
      a: "If your stay is six months or less, you generally don’t need a TIE at all. Check the dates and conditions on your visa or approval decision first, because the TIE documents a permission you already hold.",
    },
    {
      q: "How much does the TIE cost in Spain?",
      a: "The government fee is €16.08, paid with Modelo 790 Código 012 and the EX-17 form. Generating the form is not paying it: the form needs a bank payment and a stamp, and you keep the stamped proof.",
    },
    {
      q: "Which appointment do I book for my TIE in Barcelona?",
      a: "On the official appointment portal choose Barcelona province and the fingerprint and card-issuance procedure, usually labelled POLICÍA — TOMA DE HUELLAS. Booking a NIE-number appointment instead is the classic wasted trip.",
    },
  ],
  sources: [PORTAL, POLICE],
};

export const euRegistration: Chapter = {
  slug: "eu-registration-certificate",
  number: "06",
  navTitle: "EU registration certificate",
  kicker: "06 · Route A · EU, EEA, Swiss",
  title: "EU registration certificate (EX-18) for students in Barcelona",
  metaTitle: "EU registration certificate (EX-18) for students in Spain",
  description:
    "How EU, EEA and Swiss students register in Spain: complete EX-18, gather four proofs, pay tasa 790-012 (€12) and attend. No fingerprints.",
  lede:
    "Staying more than three months means registering within three months of entry. Shorter, simpler and cheaper than the non-EU route, but it is not automatic, and a NIE alone doesn’t count as done.",
  keyFacts: [
    "EU, EEA and Swiss students staying more than three months register within three months of entry using form EX-18. It is not the EX-17, and you do not give fingerprints.",
    "The fee is €12 (tasa 790-012), a different amount from the non-EU card. Generating the form isn’t paying it: keep the stamped receipt.",
    "A standalone NIE is not EU registration.",
    "The certificate is normally issued at the appointment. Getting the appointment is the slow part.",
  ],
  blocks: [
    {
      kind: "steps",
      items: [
        {
          title: "Complete EX-18",
          body: ["This is the EU registration form. You do not use EX-17, and you do not give fingerprints."],
        },
        {
          title: "Gather your four proofs",
          body: [
            "Enrolment at a recognised institution. Comprehensive health cover in Spain. A declaration of sufficient resources. And the address or registration evidence required for your local procedure.",
          ],
          tags: ["Enrolment letter", "EHIC or private policy", "Resources declaration", "Padrón"],
        },
        {
          title: "Pay tasa 790-012: €12",
          body: [
            "Different amount from the non-EU card. Same rule applies: generating the form isn’t paying it. Keep the stamped receipt.",
          ],
        },
        {
          title: "Book EU citizen registration and attend",
          body: [
            "Book through the official appointment system and go in person with originals and copies. Where requirements are met the certificate is normally issued at the appointment, but that says nothing about how long you’ll wait for the appointment itself.",
          ],
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "“I already have a NIE, so I’m registered.” No.",
      body: [
        "A standalone NIE allocation is not EU registration. If you genuinely only need a number for one transaction during a short stay, the separate EX-15 route may fit, but it does not replace EX-18 when registration is required.",
      ],
    },
    {
      kind: "callout",
      tone: "note",
      title: "Your EHIC may be enough",
      body: [
        "An EHIC can satisfy the health cover requirement if it stays valid for the whole relevant period and gives the required entitlement. Check with your home insurer before buying Spanish private cover you may not need. Starting work or changing your residence situation can change the position.",
      ],
    },
    {
      kind: "p",
      text: "The padrón is one of the four proofs and is free: see [registering your address](/guide/register-your-address-padron).",
    },
  ],
  faq: [
    {
      q: "How much is the EU registration certificate for students in Spain?",
      a: "The fee is €12, paid with tasa 790-012. That is a different amount from the non-EU card, which costs €16.08. Generating the form is not paying it, so keep the stamped receipt.",
    },
    {
      q: "Do EU students need fingerprints in Spain?",
      a: "No. EU, EEA and Swiss students use form EX-18, not EX-17, and do not give fingerprints. The certificate is a green paper certificate, not a photo card.",
    },
    {
      q: "Is a NIE the same as EU registration?",
      a: "No. A standalone NIE allocation is not EU registration. If you genuinely only need a number for one transaction during a short stay, the separate EX-15 route may fit, but it does not replace EX-18 when registration is required.",
    },
  ],
  sources: [PORTAL, POLICE],
};

export const appointmentWontCome: Chapter = {
  slug: "appointment-wont-come",
  number: "07",
  navTitle: "When the appointment won’t come",
  kicker: "07 · When it won’t come",
  title: "No TIE appointment within 30 days? What to do, and what to keep",
  metaTitle: "No TIE appointment in 30 days? What to do in Spain",
  description:
    "The portal has nothing inside thirty days. The one-month window is not a cliff edge. How to look, what evidence to keep, and why not to buy an appointment.",
  lede:
    "The cover said you have thirty days. In September, the portal often has nothing inside thirty days. Read this before you panic.",
  keyFacts: [
    "The one-month window is when you are expected to apply. It is not a cliff edge that voids your right to be here.",
    "Applications submitted after it are generally still processed, and what protects your status while you wait is the visa or authorisation you already hold, not the card.",
    "Take a dated, full-screen screenshot every time the portal shows no availability, and keep every one in one folder named by date.",
    "There is no legitimate way to guarantee appointment availability, and buying a resold appointment puts your file in the same investigation as the seller’s other customers.",
  ],
  blocks: [
    {
      kind: "callout",
      tone: "key",
      title: "First, the part that matters most",
      body: [
        "The one-month window is when you are expected to apply. It is not a cliff edge that voids your right to be here. Applications submitted after it are generally still processed, and what protects your status while you wait is the visa or authorisation you already hold, not the card. The TIE documents a permission you already have; it does not create one.",
        "So the goal isn’t to beat the clock. It’s to be able to show, later, that you tried.",
      ],
    },
    { kind: "h3", text: "Evidence discipline" },
    {
      kind: "p",
      text: "This is the whole job. Every single time you check the portal and it shows no availability, take a dated screenshot. Full screen, with the date visible. Keep every one, in one folder, named by date.",
    },
    {
      kind: "p",
      text: "Searching for an appointment is not the same as submitting an application. If your file is ever questioned, the screenshots are the difference between “I didn’t get round to it” and “here is the system, empty, forty-one times.”",
    },
    { kind: "h3", text: "How to actually look" },
    {
      kind: "list",
      items: [
        "**Check daily, early.** Slots release irregularly and go quickly. A check that takes ninety seconds, done every morning, beats an hour of refreshing once a week.",
        "**Confirm you are selecting the right procedure every time:** the fingerprint/card procedure, not a NIE-assignment appointment.",
        "**Keep looking after you find one.** If an earlier slot appears, you can usually rebook, but cancel the old one so somebody else gets it.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Do not buy an appointment",
      body: [
        "There is a market in resold appointments, and it exists because bots scrape the government booking system. In November 2024 the Policía Nacional dismantled one such network across Alicante, Murcia and Valencia: twenty-one arrests, including for unauthorised access to the state server and document falsification.",
        "Buying one puts your file, with your name on it, in the same investigation as the seller’s other customers.",
      ],
    },
    { kind: "h3", text: "While you wait" },
    {
      kind: "p",
      text: "Nothing else in this guide is blocked by the appointment. Do the [padrón](/guide/register-your-address-padron). Get the travel pass. Open the bank account. Check your insurance dates.",
    },
    {
      kind: "p",
      text: "The padrón in particular is worth doing early: it is free, it does not depend on the appointment, and several offices ask to see it when you finally get there.",
    },
    {
      kind: "p",
      text: "Before you travel abroad with a pending card, check your re-entry position. This is the single most common way a manageable situation becomes an expensive one.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "When it stops being an admin problem",
      body: [
        "Talk to a qualified immigration professional (an abogado or a gestor administrativo) if any of these are true:",
        "Your authorisation is close to expiring and you still have no appointment. You need to travel abroad with the card still pending. You arrived without the authorisation you thought you had. You’ve had an application refused, for anything.",
      ],
    },
  ],
  faq: [
    {
      q: "What happens if I can’t get a TIE appointment within 30 days?",
      a: "The one-month window is when you are expected to apply; it is not a cliff edge that voids your right to be here. Applications submitted after it are generally still processed, and what protects your status while you wait is the visa or authorisation you already hold, not the card. Keep a dated screenshot of every check that shows no availability.",
    },
    {
      q: "Should I buy a TIE appointment from someone online?",
      a: "No. There is a market in resold appointments, fed by bots that scrape the government booking system. In November 2024 the Policía Nacional dismantled one such network across Alicante, Murcia and Valencia with twenty-one arrests. Buying one puts your file in the same investigation as the seller’s other customers, and there is no legitimate way to guarantee appointment availability.",
    },
    {
      q: "Can I travel abroad while my TIE is pending?",
      a: "Before you travel abroad with a pending card, check your re-entry position. This is the single most common way a manageable situation becomes an expensive one. If you need to travel with the card still pending, talk to a qualified immigration professional.",
    },
  ],
  sources: [PORTAL, POLICE],
};
