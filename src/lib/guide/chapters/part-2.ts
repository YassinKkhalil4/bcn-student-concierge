import type { Chapter } from "../types";
import { POLICE, PORTAL } from "../sources";

const P2 = "Part 2 · The paperwork";

export const gettingYourTie: Chapter = {
  slug: "getting-your-tie",
  number: "05",
  navTitle: "Getting your TIE",
  kicker: "05 · Route B",
  part: P2,
  audience: [{ tone: "non", label: "Non-EU" }],
  title: "How to get your TIE in Barcelona: five steps for non-EU students",
  metaTitle: "How to get your TIE in Barcelona: 5 steps (EX-17)",
  description:
    "Five steps to a TIE for non-EU students in Barcelona: book the right appointment, pay fee 790-012 (€16.08), attend with originals, avoid the traps.",
  lede: "You can't control one of these steps. Start on your first weekday in Spain: the appointment, not the paperwork, is the bottleneck.",
  keyFacts: [
    "Book the **fingerprint** appointment (Toma de huellas), not a NIE one: that is the classic wasted trip.",
    "The 790-012 fee form only counts once it's **paid and stamped** at a bank. Generating the form is not paying it.",
    "Bring originals and paper copies. Screenshots don't count, and names and passport or NIE numbers must match across every document.",
    "The TIE documents a permission you already hold; it doesn't create one. If your stay is six months or less, you generally don't need a TIE at all.",
  ],
  blocks: [
    {
      kind: "steps",
      items: [
        {
          title: "Read your own authorisation first",
          body: [
            "The TIE documents a permission you already hold. It doesn't create one. Check the dates and conditions on your visa or approval decision. If your stay is six months or less, you generally don't need a TIE at all.",
          ],
        },
        {
          title: "Book the *cita previa* (appointment)",
          body: [
            "**Official appointment portal** → Barcelona province → the fingerprint/card procedure, usually labelled **POLICÍA — TOMA DE HUELLAS**. Booking a NIE-number appointment instead is the classic wasted trip.",
          ],
          tags: ["Slots release irregularly", "Check early morning", "Keep the confirmation"],
        },
        {
          title: "Fill in EX-17 and pay fee 790-012",
          body: [
            "Download the current EX-17 from the **National Police student-card page**. Generate Modelo 790 Código 012 and select the first-issuance category. **Generating the form is not paying it**: follow the banking instructions and keep the stamped proof.",
          ],
          tags: ["EX-17", "790-012", "€16.08"],
        },
        {
          title: "Go in person with originals",
          body: [
            "They check your documents and take your fingerprints. Bring originals *and* a set of paper copies. Names and passport/NIE numbers must match across every document.",
          ],
        },
        {
          title: "Ask exactly how you collect it",
          body: [
            "Some offices need a separate collection appointment. Ask: same day or second appointment? How long is the wait? Where, when, and what to bring? **Don't book flights around an assumed collection date**, and check your re-entry position before travelling with a card still pending.",
          ],
        },
      ],
    },
    {
      kind: "controls",
      title: "Who controls each step",
      legend: [
        { owner: "you", label: "You" },
        { owner: "nobody", label: "Nobody" },
        { owner: "office", label: "The office" },
      ],
      steps: [
        { n: "1 · Read", sub: "Your authorisation", owner: "you" },
        { n: "2 · Book", sub: "The wait is unpredictable", owner: "nobody" },
        { n: "3 · Pay", sub: "At a bank, stamped", owner: "you" },
        { n: "4 · Attend", sub: "In person, originals", owner: "you" },
        { n: "5 · Collect", sub: "Same day or 2nd visit", owner: "office" },
      ],
      next: "**Next:** exactly what to bring, and the five ways people waste the trip",
    },
    { kind: "h3", text: "Your appointment-day kit" },
    { kind: "p", text: "Pack this the night before. Originals plus paper copies of everything." },
    {
      kind: "kit",
      checklist: {
        title: "Bring all of this",
        count: "9 items",
        items: [
          "Appointment confirmation",
          "Completed, signed EX-17",
          "Original passport + the copies your office asks for",
          "Visa / authorisation decision",
          "Proof of entry: passport stamp or travel evidence",
          "Recent colour photo (spec on the right)",
          "**Paid and stamped** 790-012 receipt",
          "Padrón certificate, if your office asks for it",
          "Current enrolment evidence, if requested",
        ],
      },
      photo: {
        title: "The photo",
        size: "32 × 26 mm",
        rules: ["Plain **white** background", "Face forward", "Head uncovered", "No tinted lenses", "Recent and in colour"],
        note: "Budget about **€6–12** for a set of photos.",
      },
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Five ways people waste the trip",
      body: [
        "**Wrong appointment type.** Booked a NIE assignment instead of fingerprints.",
        "**Generated but never paid.** The 790-012 needs a bank payment and a stamp.",
        "**Name mismatch.** Middle names on one document, missing on another.",
        "**Digital only.** Relying on your phone when the checklist asks for paper.",
        "**Missing photocopies.** Offices routinely want the passport bio page *and every stamped page*. Copy the lot.",
      ],
    },
    {
      kind: "callout",
      tone: "key",
      title: "Can't find an appointment?",
      body: [
        "There's no legitimate way to guarantee one. What you can do is make sure that when you get one, nothing on your file sends you home again. [Section 07](/guide/appointment-wont-come) covers what to do while you wait.",
      ],
    },
  ],
  faq: [
    {
      q: "Do I need a TIE if I am studying in Spain for six months or less?",
      a: "If your stay is six months or less, you generally don't need a TIE at all. Check the dates and conditions on your visa or approval decision first, because the TIE documents a permission you already hold.",
    },
    {
      q: "How much does the TIE cost in Spain?",
      a: "The government fee is €16.08, paid with Modelo 790 Código 012 and the EX-17 form. Generating the form is not paying it: the form needs a bank payment and a stamp, and you keep the stamped proof.",
    },
    {
      q: "Which appointment do I book for my TIE in Barcelona?",
      a: "On the official appointment portal choose Barcelona province and the fingerprint and card procedure, usually labelled POLICÍA — TOMA DE HUELLAS. Booking a NIE-number appointment instead is the classic wasted trip.",
    },
  ],
  sources: [PORTAL, POLICE],
};

export const euRegistration: Chapter = {
  slug: "eu-registration-certificate",
  number: "06",
  navTitle: "EU registration certificate",
  kicker: "06 · Route A",
  part: P2,
  audience: [{ tone: "eu", label: "EU · EEA · Swiss" }],
  title: "EU registration certificate (EX-18) for students in Barcelona",
  metaTitle: "EU registration certificate (EX-18) for students in Spain",
  description: "How EU, EEA and Swiss students register in Spain: complete EX-18, gather four proofs, pay fee 790-012 (€12) and attend. No fingerprints.",
  lede: "Staying more than three months means registering within three months of entry. Shorter, simpler and cheaper than the non-EU route, but not automatic, and a NIE alone doesn't count as done.",
  keyFacts: [
    "Form **EX-18**, fee **€12**, no fingerprints, deadline **3 months**.",
    "You need four proofs: enrolment, health cover, resources, address.",
    "Certificate is normally issued at the appointment. Getting the appointment is the slow part.",
    "A standalone NIE is not EU registration.",
  ],
  blocks: [
    {
      kind: "steps",
      items: [
        { title: "Complete EX-18", body: ["This is the EU registration form. You do *not* use EX-17, and you don't give fingerprints."] },
        {
          title: "Gather your four proofs",
          body: [
            "Enrolment at a recognised institution · comprehensive health cover in Spain · a declaration of sufficient resources · the address/registration evidence your local procedure requires.",
          ],
          tags: ["Enrolment letter", "EHIC or private policy", "Resources declaration", "Padrón"],
        },
        { title: "Pay fee 790-012 — €12", body: ["Different amount from the non-EU card, same rule: generating the form isn't paying it. Keep the stamped receipt."] },
        {
          title: "Book \"EU citizen registration\" and attend",
          body: [
            "Book through the official appointment system and go in person with originals and copies. If the requirements are met, the certificate is normally issued at the appointment. That says nothing about how long you'll wait for the appointment itself.",
          ],
        },
      ],
    },
    {
      kind: "callout",
      tone: "note",
      title: "Myth: \"I already have a NIE, so I'm registered.\"",
      body: [
        "**No.** A standalone NIE allocation is not EU registration. If you only need a number for one transaction during a short stay, the separate EX-15 route may fit, but it doesn't replace EX-18 when registration is required.",
      ],
    },
    {
      kind: "callout",
      tone: "tip",
      title: "Money saver: your EHIC may be enough",
      body: [
        "An EHIC can satisfy the health cover requirement if it stays valid for the whole relevant period and gives the required entitlement. **Check with your home insurer** before buying Spanish private cover you may not need. Starting work or changing your residence situation can change this.",
      ],
    },
    { kind: "p", text: "The padrón is one of the four proofs, and it is free: see [registering your address](/guide/register-your-address-padron)." },
  ],
  faq: [
    {
      q: "How much is the EU registration certificate for students in Spain?",
      a: "The fee is €12, paid with fee 790-012. That is a different amount from the non-EU card, which costs €16.08. Generating the form is not paying it, so keep the stamped receipt.",
    },
    {
      q: "Do EU students need fingerprints in Spain?",
      a: "No. EU, EEA and Swiss students use form EX-18, not EX-17, and do not give fingerprints. The certificate is a green paper certificate, not a photo card.",
    },
    {
      q: "Is a NIE the same as EU registration?",
      a: "No. A standalone NIE allocation is not EU registration. If you only need a number for one transaction during a short stay, the separate EX-15 route may fit, but it doesn't replace EX-18 when registration is required.",
    },
  ],
  sources: [PORTAL, POLICE],
};

export const appointmentWontCome: Chapter = {
  slug: "appointment-wont-come",
  number: "07",
  navTitle: "When the appointment won't come",
  kicker: "07 · When it won't come",
  part: P2,
  audience: [{ tone: "non", label: "Non-EU" }],
  title: "No TIE appointment within 30 days? What to do, and what to keep",
  metaTitle: "No TIE appointment in 30 days? What to do in Spain",
  description:
    "The portal has nothing inside thirty days. The one-month window is not a cliff edge. How to look, what evidence to keep, and why not to buy an appointment.",
  lede: "The cover said you have thirty days. In September, the portal often has nothing inside thirty days. Read this before you panic.",
  keyFacts: [
    "The one-month window is not a cliff edge that voids your right to be here. Late applications are generally still processed.",
    "What protects you while you wait is the visa or authorisation you already hold, not the card.",
    "Take a dated, full-screen screenshot every time the portal shows no availability, and keep every one in one folder named by date.",
    "Never buy a resold appointment: it puts your file in the same investigation as the seller's other customers.",
  ],
  blocks: [
    {
      kind: "strips",
      title: "The part that matters most",
      tag: "Not to scale",
      rows: [
        {
          label: "When you're expected to apply",
          segs: [
            { from: 0, to: 30, tone: "red", text: "month 1" },
            { from: 32, to: 100, tone: "amber", dashed: true, text: "late applications generally still processed" },
          ],
        },
        { label: "What protects you", segs: [{ from: 0, to: 100, tone: "teal", text: "YOUR VISA / AUTHORISATION · THE WHOLE TIME" }] },
        { label: "The TIE card", segs: [{ from: 55, to: 100, tone: "purple", dashed: true, text: "documents it, later" }] },
      ],
      note: "The one-month window is **not a cliff edge** that voids your right to be here. **The TIE documents a permission you have; it doesn't create one.** So the goal isn't to beat the clock. It's to be able to show, later, that you tried.",
    },
    { kind: "h3", text: "Evidence discipline" },
    {
      kind: "p",
      text: "This is the whole job. Every time the portal shows no availability, **take a dated screenshot**: full screen, date visible. Keep every one in one folder, named by date.",
    },
    {
      kind: "p",
      text: "If your file is ever questioned, those screenshots are the difference between \"I didn't get round to it\" and \"here is the system, empty, forty-one times.\"",
    },
    { kind: "h3", text: "How to actually look" },
    {
      kind: "list",
      items: [
        "**Check daily, early.** Slots release irregularly and go fast. Ninety seconds every morning beats an hour of refreshing once a week.",
        "**Check the procedure every time:** fingerprint/card, not NIE-assignment.",
        "**Keep looking after you find one.** If an earlier slot appears you can usually rebook. Cancel the old one so someone else gets it.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Never buy an appointment",
      body: [
        "Resold appointments exist because bots scrape the government booking system. In November 2024 the Policía Nacional dismantled one network across Alicante, Murcia and Valencia: **twenty-one arrests**, including for unauthorised access to the state server and document falsification. Buying one puts your file, with your name on it, in the same investigation as the seller's other customers.",
      ],
    },
    {
      kind: "callout",
      tone: "key",
      title: "When it stops being an admin problem",
      body: [
        "Talk to a qualified immigration professional (an *abogado* or *gestor administrativo*) if:",
        "Your authorisation is close to expiring and you still have no appointment. You need to travel abroad with the card still pending. You arrived without the authorisation you thought you had. You've had an application refused, for anything. You married, changed course or stopped studying.",
      ],
    },
    { kind: "h3", text: "While you wait" },
    {
      kind: "p",
      text: "Nothing else in this guide is blocked by the appointment. Do the padrón, get the travel pass, open the bank account, check your insurance dates.",
    },
    {
      kind: "p",
      text: "The **padrón** is worth doing early: it's free, doesn't depend on the appointment, and several offices ask to see it when you finally get there.",
    },
    {
      kind: "p",
      text: "**Before travelling abroad** with a pending card, check your re-entry position. It's the most common way a manageable situation becomes an expensive one.",
    },
  ],
  faq: [
    {
      q: "What happens if I can't get a TIE appointment within 30 days?",
      a: "The one-month window is when you are expected to apply; it is not a cliff edge that voids your right to be here. Late applications are generally still processed, and what protects your status while you wait is the visa or authorisation you already hold, not the card. Keep a dated screenshot of every check that shows no availability.",
    },
    {
      q: "Should I buy a TIE appointment from someone online?",
      a: "No. Resold appointments exist because bots scrape the government booking system. In November 2024 the Policía Nacional dismantled one such network across Alicante, Murcia and Valencia with twenty-one arrests. Buying one puts your file in the same investigation as the seller's other customers.",
    },
    {
      q: "Can I travel abroad while my TIE is pending?",
      a: "Before travelling abroad with a pending card, check your re-entry position. It's the most common way a manageable situation becomes an expensive one. If you need to travel with the card still pending, talk to a qualified immigration professional.",
    },
  ],
  sources: [PORTAL, POLICE],
};

export const registerPadron: Chapter = {
  slug: "register-your-address-padron",
  number: "08",
  navTitle: "Registering your address (padrón)",
  kicker: "08 · The town hall",
  part: P2,
  audience: [
    { tone: "all", label: "Everyone" },
    { tone: "all", label: "Free" },
  ],
  title: "How to register your address (padrón) in Barcelona as a student",
  metaTitle: "Padrón in Barcelona: register your address as a student",
  description: "The padrón is free and you don't need to own the flat or hold the lease. Four situations, accepted evidence, volant vs certificat and the two-year renewal.",
  lede: "Free, quietly required by the step after it, and the one where a difficult landlord can genuinely stall you. Also the part most students get wrong before they've even started.",
  keyFacts: [
    "Registration on the padrón is free. Anyone charging you is charging for their time, not the registration.",
    "You don't need to own the property or hold the lease to register. The padrón records where you actually live and grants no tenancy right or ownership claim.",
    "An OAC appointment (cita prèvia) is required. Your address needs floor and door: \"Carrer X 44, 3r 2a\", not \"Carrer X 44\".",
    "Non-EU residents without long-term residence must renew every 2 years, or it lapses silently.",
    "Never register at an address you don't live at: article 392 of the Criminal Code covers falsifying a document.",
  ],
  blocks: [
    {
      kind: "callout",
      tone: "tip",
      title: "The fact that unlocks most of this",
      body: [
        "**You don't need to own the property or hold the lease to register.** The padrón records where you actually live. It grants no tenancy right and no ownership claim, which is exactly why a landlord's refusal doesn't end the matter, and why their fear of \"giving you rights\" is misplaced.",
      ],
    },
    { kind: "h3", text: "Find your situation, then stop reading" },
    { kind: "p", text: "Most students who panic about this are on rung 1 and don't know it." },
    {
      kind: "cards",
      items: [
        {
          label: "Rung 1",
          tag: "Easiest",
          effort: 1,
          title: "The contract is in your name",
          body: [
            "**No landlord involvement needed at all.** The contract is your proof, and they already signed it. Bring it with your ID and you're done. If this is you, the rest of this page isn't your problem.",
          ],
        },
        {
          label: "Rung 2",
          tag: "Most common",
          effort: 2,
          title: "You rent a room, or the contract is in someone else's name",
          body: [
            "You need an **express written authorisation** from the person named on the title or contract: signed original, by an adult, plus a photocopy of their ID showing the same signature.",
            "The authoriser can be the owner *or* the tenant. Neither has to be registered there themselves, but they must evidence their own title. **Your head tenant can authorise you using their own rental contract.** That one sentence resolves most room-rental cases.",
          ],
        },
        {
          label: "Rung 3",
          tag: "Routine",
          effort: 2,
          title: "You live in a student residence",
          body: [
            "Authorisation from the establishment's titleholder. Ask reception; they've done it many times. If they say they don't, ask again **in writing** and name the person you spoke to.",
          ],
        },
        {
          label: "Rung 4",
          tag: "Fallback",
          effort: 4,
          title: "You have no documentation at all",
          body: [
            "There's an official fallback: after you apply, municipal services verify by telephone and a visit to the address.",
            "The trade-offs: it's **slower**, you must be genuinely reachable and genuinely living there, and **your landlord may find out**, because an officer at the door isn't discreet. It works. It isn't frictionless.",
          ],
        },
      ],
    },
    { kind: "h3", text: "Proof, paperwork and the date you'll forget" },
    {
      kind: "checklist",
      title: "Other evidence that's accepted",
      items: [
        "*Escritura*: the deed, if you own",
        "*Nota simple* from the property register",
        "An **IBI** (property tax) receipt",
        "A **bank transfer from the last two months** showing rent paid",
      ],
    },
    { kind: "p", text: "**Not accepted:** mobile and internet bills, or a utility bill in someone else's name." },
    { kind: "h3", text: "Volant or certificat?" },
    { kind: "p", text: "Students bring the wrong one, constantly." },
    {
      kind: "cards",
      items: [
        { label: "Volant", title: "Informative", body: ["Informative. Fast, often instant online."] },
        { label: "Certificat", title: "Authenticated", body: ["Carries *fe pública*: the authenticated document. Separate request, takes longer."] },
      ],
    },
    {
      kind: "p",
      text: "Procedures that need proof ask for the **certificat**. Check your appointment's own checklist. **Unsure? Take the certificat**: it covers anything the volant would.",
    },
    {
      kind: "flow",
      title: "From booking to renewal",
      aside: "OAC = the town hall's citizen office",
      steps: [
        { icon: "calendar", title: "Book in week one", body: "OAC appointment (*cita prèvia*). Shorter queue than immigration, not instant." },
        { icon: "pin", title: "Register", body: "At the counter, or online with **idCAT** or **Cl@ve**." },
        { icon: "mail", title: "~7 days later", body: "Confirmation email; volants now available." },
        { icon: "renew", title: "Every 2 years", body: "Renew, or it **lapses silently**. Calendar it today.", tag: "Non-EU" },
      ],
      example: { label: "Your address needs floor and door:", bad: "Carrer X 44", good: "Carrer X 44, 3r 2a" },
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Never register at an address you don't live at",
      body: [
        "Barcelona has recorded falsified rental contracts and utility bills submitted for padrón registration. **Article 392 of the Criminal Code carries prison sentences and fines** for falsifying a document, and it attaches to your immigration file, following you through every renewal you ever apply for. It's not a shortcut.",
      ],
    },
    {
      kind: "callout",
      tone: "note",
      title: "Catalan vs Spanish",
      body: ["*volant* and *certificat* are the Catalan spellings of *volante* and *certificado*. Same documents."],
    },
  ],
  faq: [
    {
      q: "Is the padrón free in Barcelona?",
      a: "Yes. Padrón registration costs €0. Anyone charging you is charging for their time, not for the registration.",
    },
    {
      q: "Can I register on the padrón if my landlord refuses?",
      a: "You don't need to own the property or hold the lease to register. The padrón records where you actually live and grants no tenancy right or ownership claim, so a landlord's refusal doesn't end the matter. If the contract is in someone else's name, an express written authorisation from the titleholder or tenant is needed; if you have no documentation at all, municipal services verify by telephone and a visit to the address.",
    },
    {
      q: "What is the difference between a volant and a certificat?",
      a: "A volant is informative: fast, often instant online. A certificat carries fe pública, meaning it is the authenticated document, and takes longer as a separate request. If you are unsure which your procedure needs, take the certificat, because it covers anything the volant would.",
    },
    {
      q: "How often must I renew the padrón?",
      a: "Non-EU residents without long-term residence must renew the registration every two years. It lapses silently, so put the date in your calendar the day you register.",
    },
  ],
  sources: [POLICE],
};
