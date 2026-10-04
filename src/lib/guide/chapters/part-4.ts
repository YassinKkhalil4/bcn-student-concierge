import type { Chapter } from "../types";
import { POLICE } from "../sources";
import { ADDONS, TIERS, tierPriceCents } from "../../pricing";

/**
 * Every price below is read from the site's pricing table, so the guide can
 * never quote one the checkout does not charge. The whole euros are what the
 * guide prints ("€49"), the same figures the pricing page shows.
 */
const eur = (cents: number) => `€${cents / 100}`;
const tier = (id: string) => TIERS.find((t) => t.id === id)!;
const ready = tier("ready-file");
const soft = tier("soft-landing");
const READY = { eu: eur(tierPriceCents(ready, "eu")), non: eur(tierPriceCents(ready, "non-eu")) };
const SOFT = { eu: eur(tierPriceCents(soft, "eu")), non: eur(tierPriceCents(soft, "non-eu")) };
export const GUIDE_PRICES = { READY, SOFT, ADDONS: ADDONS.map((a) => ({ id: a.id, name: a.name, price: eur(a.priceCents) })) };

const ADDON_BODY: Record<string, string> = {
  "t-jove": "We create your T-mobilitat account, verify your ID and load a 90-day unlimited youth pass. Under 30 only.",
  "carnet-jove": "The official Catalan youth card: application, fee payment and digital activation.",
  isic: "The International Student Identity Card, issued against your enrolment letter.",
  esim: "A local Spanish number with 50–100 GB of data, ready before you land.",
};

export const adminDaySurvival: Chapter = {
  slug: "admin-day-survival",
  number: "12",
  navTitle: "Admin-day survival",
  kicker: "12 · At the counter",
  part: "Part 4 · On the day",
  audience: [{ tone: "all", label: "Everyone" }],
  title: "Spanish phrases and emergency numbers for admin day in Barcelona",
  metaTitle: "Spanish phrases and emergency numbers for admin day",
  description: "Seven Spanish phrases for a government counter, Barcelona emergency numbers (112, 061, 092, 017), office-hours habits and Catalan versus Spanish.",
  lede: "The only page you need on you. Print it or save it to your phone.",
  keyFacts: [
    "112 is police, fire and medical, free and 24/7. 061 is Salut Respon for health guidance in Catalonia, 092 is the Guàrdia Urbana, and 017 is INCIBE for online fraud.",
    "Most offices serve the public mornings only, and many close entirely in August and around public holidays.",
    "A 09:30 appointment is not a 09:30 arrival. Arrive early.",
  ],
  blocks: [
    {
      kind: "phrases",
      title: "Say this",
      head: ["Spanish", "English"],
      rows: [
        { spanish: "Tengo cita para…", english: "I have an appointment for…" },
        { spanish: "¿Qué documentos me faltan?", english: "Which documents am I missing?" },
        { spanish: "¿Necesito el certificado o el volante?", english: "Do I need the certificate or the volante?" },
        { spanish: "¿Puede hablar más despacio?", english: "Could you speak more slowly?" },
        { spanish: "¿Me lo puede dar por escrito?", english: "Could you give it to me in writing?" },
        { spanish: "¿Cuál es mi número de expediente?", english: "What is my file number?" },
        { spanish: "Necesito ayuda. ¿Habla inglés?", english: "I need help. Do you speak English?" },
      ],
    },
    {
      kind: "numbers",
      title: "Emergency numbers",
      rows: [
        { n: "112", label: "Police, fire, medical. Free, 24/7." },
        { n: "061", label: "Salut Respon: health guidance, Catalonia" },
        { n: "092", label: "Guàrdia Urbana, local police" },
        { n: "017", label: "INCIBE: online fraud" },
      ],
    },
    { kind: "h3", text: "Office hours aren't your hours" },
    {
      kind: "p",
      text: "Most offices serve the public **mornings only**, and many close entirely in **August** and around public holidays. Check the specific office's hours the day before.",
    },
    { kind: "p", text: "**A 09:30 appointment is not a 09:30 arrival.** Arrive early." },
    { kind: "h3", text: "Catalan and Spanish" },
    {
      kind: "p",
      text: "Both are official. Municipal websites often default to Catalan; look for the language switch, usually top right. The Spanish version is occasionally less complete.",
    },
    {
      kind: "checklist",
      title: "Last-minute check",
      items: ["Originals **and** paper copies", "790 form **paid and stamped**", "Appointment confirmation + expediente number", "Names match on every document"],
    },
  ],
  faq: [
    {
      q: "What are the emergency numbers in Barcelona?",
      a: "112 is police, fire and medical, free and 24/7. 061 Salut Respon gives health guidance in Catalonia, 092 is the Guàrdia Urbana (local police), and 017 INCIBE handles online fraud.",
    },
    {
      q: "What Spanish phrases do I need at a government office?",
      a: "Useful ones are \"Tengo cita para…\" (I have an appointment for…), \"¿Qué documentos me faltan?\" (Which documents am I missing?), \"¿Me lo puede dar por escrito?\" (Could you give it to me in writing?) and \"Necesito ayuda. ¿Habla inglés?\" (I need help. Do you speak English?).",
    },
    {
      q: "Do Barcelona government offices open all day?",
      a: "Most offices serve the public mornings only, and many close entirely in August and around public holidays. Check the specific office's hours the day before.",
    },
  ],
  sources: [POLICE],
};

export const howMuchAdmin: Chapter = {
  slug: "how-much-admin",
  number: "13",
  navTitle: "Do it yourself, or hand it over?",
  kicker: "13 · The honest part",
  part: "Part 5 · If you'd rather not do it alone",
  audience: [{ tone: "all", label: "Everyone" }],
  title: "Do it yourself, or hand it over? Student paperwork in Barcelona, counted",
  metaTitle: "Do it yourself or hand it over? Student admin, counted",
  description: "Documents, official systems and in-person visits for the TIE, EU certificate, padrón, travel pass and bank account, counted from the official checklists.",
  lede: "No opinions, just counts: documents to produce, separate systems to use, and times you physically show up during office hours.",
  keyFacts: [
    "The non-EU TIE application is the heaviest task: nine documents, three systems and two in-person visits.",
    "The padrón needs four documents, one system and one visit.",
    "All of it is doable without paid help. Thousands of students do it every September with patience and a checklist.",
  ],
  blocks: [
    {
      kind: "workload",
      title: "How much admin each task creates",
      sub: "From the official checklists, non-EU route",
      legend: ["Documents", "Systems / portals", "In-person visits"],
      rows: [
        { label: "TIE application", d: 9, s: 3, v: 2, total: "14 items" },
        { label: "EU certificate", d: 6, s: 3, v: 1, total: "10 items" },
        { label: "Padrón", d: 4, s: 1, v: 1, total: "6 items" },
        { label: "Travel pass setup", d: 1, s: 2, v: 1, total: "4 items" },
        { label: "Bank account", d: 3, s: 1, v: 0, total: "4 items" },
      ],
      note: "Local offices may ask for more. Documents counted are the nine on the [appointment-day checklist](/guide/getting-your-tie). The three in-person visits on the cover: padrón counter, fingerprint appointment, and card collection where a second visit is required.",
    },
    {
      kind: "callout",
      tone: "tip",
      title: "All of this is doable alone",
      body: [
        "Thousands of students do it every September with patience and this kind of checklist. It's free and it's official. If you have time in your first fortnight and a bit of Spanish, **do it yourself**. We'd rather you kept your money.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Who tends to hire us",
      body: [
        "One-year programme with no slack in it. You don't speak Spanish. You arrived in the September crush, clock running. You've already lost one appointment. Your landlord is difficult about the padrón.",
        "None of those you? Use the checklists and keep your money.",
      ],
    },
    {
      kind: "cards",
      items: [
        {
          title: "Why two prices",
          body: [
            "The EU route is less work, so it costs less: no fingerprints, no €16.08 fee, and the certificate is normally issued at the appointment. Non-EU means EX-17, the biometric appointment, and at some offices a second collection trip.",
            "We confirm your route at triage, **before you pay anything**.",
          ],
        },
        {
          title: "What it costs",
          body: [
            `Two fixed-fee packages: **The Ready File** from **${READY.eu}** and **The Soft Landing** from **${SOFT.eu}** (EU route; non-EU is ${READY.non} and ${SOFT.non}). Nothing is billed hourly, and government fees are never included.`,
            "A wrong appointment type costs you the slot and puts you back in a queue nobody can predict. [Section 14](/guide/packages-and-pricing) shows what each package includes.",
          ],
        },
      ],
    },
    {
      kind: "callout",
      tone: "key",
      title: "Not sure? Free triage, same day.",
      body: ["Which route, how many days left, what's recoverable. [Start the free triage](/triage)."],
    },
  ],
  faq: [
    {
      q: "How much paperwork does a student face in Barcelona?",
      a: "Counted from the official checklists on the non-EU route: the TIE needs nine documents, three systems and two in-person visits; the EU certificate six documents, three systems and one visit; the padrón four documents, one system and one visit; a travel pass one document and two systems; a bank account three documents and one system.",
    },
    {
      q: "Can I do the student paperwork in Spain myself?",
      a: "Yes. Thousands of students do it every September with patience and a checklist. It is free and official, and if you have time in your first fortnight and a bit of Spanish, you can do it yourself.",
    },
  ],
  sources: [POLICE],
};

export const packagesAndPricing: Chapter = {
  slug: "packages-and-pricing",
  number: "14",
  navTitle: "Two packages, fixed fees",
  kicker: "14 · What it costs",
  part: "Part 5 · If you'd rather not do it alone",
  audience: [{ tone: "all", label: "Everyone" }],
  title: "BCN Student Concierge packages and prices: what each one includes",
  metaTitle: "Student paperwork help in Barcelona: packages and prices",
  description: `Two fixed-fee packages for student paperwork in Barcelona: The Ready File from ${READY.eu} and The Soft Landing from ${SOFT.eu}, excluding IVA. What each includes.`,
  lede: "The Soft Landing includes everything in The Ready File. Prices are EU / EEA / Swiss first, then non-EU, and exclude IVA.",
  keyFacts: [
    `The Ready File costs ${READY.eu} on the EU route and ${READY.non} on the non-EU route. You book your own appointments.`,
    `The Soft Landing costs ${SOFT.eu} on the EU route and ${SOFT.non} on the non-EU route. It adds appointment searching and booking in your name, a WhatsApp line for 30 days and a live line during your appointment.`,
    "Prices exclude IVA: 21% is added at checkout, and you see the total before you pay. Government fees are never included, and nothing is billed hourly.",
    "On The Soft Landing, if no appointment opens within six weeks you get 50% of the package fee back and keep the entire Ready File.",
  ],
  blocks: [
    {
      kind: "packages",
      terms: ["Government fees are never included.", "Nothing is billed hourly.", "21% IVA is added at checkout."],
      tiers: [
        { name: "The Ready File", sub: "You book your own appointments", eu: READY.eu, non: READY.non },
        { name: "The Soft Landing", sub: "+ we hunt your appointment", eu: SOFT.eu, non: SOFT.non, badge: "Most chosen" },
      ],
      routes: ["EU", "NON-EU"],
      sections: [
        {
          title: "The paperwork · both packages",
          rows: [
            { label: "**Route confirmed** against your own authorisation", has: [true, true] },
            { label: "**Your form** (EX-17 or EX-18), generated, print-ready and cross-checked", has: [true, true] },
            { label: "**Modelo 790 Código 012**, set for cash, plus a named bank branch", has: [true, true] },
            { label: "**Padrón file**, for the right town hall", has: [true, true] },
            { label: "**Authorisation form** if the flat isn't in your name", has: [true, true] },
            { label: "**Completeness audit**, including the name-match check", has: [true, true] },
            { label: "**Step-by-step booking guide** for the official portal", has: [true, true] },
            { label: "The whole file as a print-at-home PDF, the moment it's assembled", has: [true, true] },
          ],
        },
        {
          title: "We take it from there · The Soft Landing",
          rows: [
            { label: "**Appointments searched and booked** in your name, with a dated itinerary", has: [false, true] },
            { label: "**WhatsApp line** in English for 30 days", has: [false, true] },
            { label: "**Live line** during your appointment", has: [false, true] },
            { label: "**Bank and transit** setup guides", has: [false, true] },
          ],
        },
      ],
      addonsTitle: "Optional add-ons · either package · excl. IVA",
      addons: ADDONS.map((a) => ({
        name: a.name,
        price: eur(a.priceCents),
        body: ADDON_BODY[a.id] ?? "",
      })),
    },
    {
      kind: "callout",
      tone: "note",
      title: "If the slot never comes",
      body: [
        "On The Soft Landing we search the official portal for up to six weeks. If nothing opens, you get **50% of the package fee back** and keep the entire Ready File.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "One thing we will never do",
      body: ["**We will never register you at an address you don't live at.** That's a fraud problem attached to your immigration file."],
    },
    { kind: "p", text: "Before you choose, read [the honest notes](/guide/the-honest-notes). The full, current price list is on the [pricing page](/pricing)." },
  ],
  faq: [
    {
      q: "How much does BCN Student Concierge cost?",
      a: `There are two fixed-fee packages. The Ready File costs ${READY.eu} (EU route) or ${READY.non} (non-EU route); The Soft Landing costs ${SOFT.eu} or ${SOFT.non}. Prices exclude IVA, which is added at checkout, and government fees are never included.`,
    },
    {
      q: "What is the difference between The Ready File and The Soft Landing?",
      a: "The Ready File is the finished paperwork: route confirmed, forms, Modelo 790 set up, padrón file, completeness audit and a booking guide, and you book your own appointments. The Soft Landing includes all of that and also searches and books your appointments in your name, with a WhatsApp line for 30 days, a live line during your appointment, and bank and transit setup guides.",
    },
    {
      q: "What happens if no appointment opens?",
      a: "On The Soft Landing we search the official portal for up to six weeks. If nothing opens, you get 50% of the package fee back and keep the entire Ready File, so you are ready the day a slot appears.",
    },
  ],
  sources: [],
};

export const honestNotes: Chapter = {
  slug: "the-honest-notes",
  number: "15",
  navTitle: "The honest notes",
  kicker: "15 · Read before you buy",
  part: "Part 5 · If you'd rather not do it alone",
  audience: [{ tone: "all", label: "Everyone" }],
  title: "Before you pay for paperwork help in Spain: six things that go wrong",
  metaTitle: "Before you pay for student paperwork help: honest notes",
  description: "Six things that go wrong when nobody says them out loud first: the unpaid 790, uncertified copies, appointments nobody can guarantee, and what a fee never covers.",
  lede: "Six things that go wrong when nobody says them out loud first.",
  keyFacts: [
    "The 790 form arrives unpaid and has to be paid and stamped at a bank by you. An unstamped form ends the appointment.",
    "Copies we print are printed copies, not certified ones. You carry the originals.",
    "No service can make an appointment exist. Anyone who says otherwise is selling you something they don't have.",
    "The biometric appointment requires you, in person, with originals. The appearance is yours, in your own name.",
  ],
  blocks: [
    {
      kind: "cards",
      items: [
        {
          label: "01",
          title: "The 790 arrives unpaid, and it has to",
          body: [
            "It's a barcoded form that must be paid and stamped at a bank counter or scanner. Paying online needs a Spanish digital certificate you don't have yet. We configure, print and tell you where; **the trip is yours**. An unstamped form ends the appointment.",
          ],
        },
        {
          label: "02",
          title: "Our copies are printed, not certified",
          body: ["We print from the scans you upload. We've never seen your original passport and can't certify anything. **You carry the originals**; the folder carries what goes with them."],
        },
        {
          label: "03",
          title: "We can't make an appointment exist",
          body: [
            "On The Soft Landing we search the official portal for up to **six weeks**. If none opens, you get **50% of the package fee back** and keep the entire Ready File, so you're ready the day one does. On The Ready File you book your own, with our guide. Nobody can shortcut this legally.",
          ],
        },
        {
          label: "04",
          title: "We don't attend the biometric appointment for you",
          body: [
            "It requires you, in person, with originals. We prepare and brief you, and on The Soft Landing we also book it and stay reachable by phone. **The appearance is yours, in your own name.**",
          ],
        },
        {
          label: "05",
          title: "Your 90 days start when you tap",
          body: ["The T-jove add-on's window runs from first validation, not purchase. But it's **90 consecutive days** once it starts, not 90 days of use."],
        },
        {
          label: "06",
          title: "T-jove is an age rule, not a student rule",
          body: [
            "Under 30 only; no student card needed. Thirty or over, leave the add-on unticked: the right pass is a **T-usual** for the zones you need, and we can point you to it.",
          ],
        },
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "If your window has already closed",
      body: [
        "Past the deadline, on an expired or irregular status, or facing a refusal: that needs legal analysis we're not qualified to give. **We'll say so at triage and point you to a *colegiado abogado***, and we won't take your money.",
      ],
    },
    {
      kind: "cards",
      items: [
        {
          title: "Never in the fee",
          body: [
            "Modelo 790 Código 012 and card issuance: paid by you, directly, at a bank",
            "Tuition, rent, deposits: we never handle funds for third parties",
            "Legal representation or appeals: outside our scope",
            "Sworn translation or apostille: we identify what needs it and refer you to a *traductor jurado*",
          ],
        },
        {
          title: "Paying us",
          body: [
            "Prices exclude IVA: **21% is added at checkout**, and you see the total before you pay. Nothing is billed hourly.",
            "Your documents are stored encrypted and **permanently deleted 30 days after your service completes**, or earlier on request.",
            "We don't guarantee appointments, and we don't give legal advice.",
          ],
        },
      ],
    },
    {
      kind: "callout",
      tone: "key",
      title: "Where do you actually stand today?",
      body: [
        "Send us your entry stamp, your authorisation and your enrolment letter. We'll tell you **which route applies, how many days you have left, and what's still recoverable**. No charge, no obligation, and if you don't need us we'll say so. [Start the free triage](/triage).",
      ],
    },
  ],
  faq: [
    {
      q: "Can a paperwork service guarantee me a TIE appointment?",
      a: "No. Nobody can shortcut the appointment legally, and any service that says otherwise is selling you something it doesn't have. On The Soft Landing we search the official portal for up to six weeks and refund 50% of the package fee if nothing opens.",
    },
    {
      q: "Who pays the 790 fee and how?",
      a: "You do, directly, at a bank. It is a barcoded form that must be paid and stamped at a bank counter or scanner. Paying online needs a Spanish digital certificate you don't have yet, and an unstamped form ends the appointment.",
    },
  ],
  sources: [],
};
