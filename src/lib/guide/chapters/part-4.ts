import type { Chapter } from "../types";
import { MINISTRY, POLICE } from "../sources";

export const workingWhileStudying: Chapter = {
  slug: "working-while-you-study",
  number: "11",
  navTitle: "Working while you study",
  kicker: "11 · Earning",
  title: "Can international students work in Spain? The 30-hour rule (RD 1155/2024)",
  metaTitle: "Can students work in Spain? 30 hours (RD 1155/2024)",
  description:
    "Under RD 1155/2024, higher-education students in Spain may work 30 hours a week without a separate work permit. Conditions, and the effect on health cover.",
  lede:
    "The question everyone asks after the TIE. The answer recently changed in your favour.",
  keyFacts: [
    "Under RD 1155/2024, students in higher education may work up to 30 hours per week without applying for a separate work permit.",
    "Older guidance online says 20 hours, or says you need a permit. Check the date on anything you read.",
    "Two conditions: the work must be compatible with your studies, and your employer needs to see your card or authorisation before you start.",
    "Starting work means Social Security affiliation, which can replace the private insurance requirement your authorisation imposed.",
  ],
  blocks: [
    {
      kind: "callout",
      tone: "key",
      title: "Up to 30 hours a week",
      body: [
        "Under RD 1155/2024, students in higher education may work up to 30 hours per week without applying for a separate work permit. This was a real change: older guidance you will find online says 20 hours, or says you need a permit. Check the date on anything you read.",
      ],
    },
    {
      kind: "table",
      head: ["", "Hours per week without a separate work permit"],
      rows: [
        ["Old rule", "20"],
        ["Now (RD 1155/2024)", "30"],
      ],
    },
    { kind: "h3", text: "Two conditions" },
    {
      kind: "list",
      items: [
        "The work must be compatible with your studies.",
        "Your employer needs to see your card or authorisation before you start. They are the ones carrying the risk if you cannot evidence your status.",
      ],
    },
    {
      kind: "p",
      text: "Different rules apply to post-compulsory vocational training, where the route is formative practice rather than general employment.",
    },
    {
      kind: "callout",
      tone: "warning",
      title: "It changes your health cover",
      body: [
        "This is the part nobody mentions. Starting work means Social Security affiliation, and affiliation can replace the private insurance requirement that your authorisation imposed.",
        "Do not cancel a policy on that basis without confirming it against your own authorisation conditions first, but do check, because some students pay for cover they no longer need. See [health insurance requirements](/guide/health-insurance-requirements).",
      ],
    },
  ],
  faq: [
    {
      q: "How many hours can a student work in Spain?",
      a: "Under RD 1155/2024, students in higher education may work up to 30 hours per week without applying for a separate work permit. Older guidance online says 20 hours or says you need a permit, so check the date on anything you read.",
    },
    {
      q: "What conditions apply to student work in Spain?",
      a: "The work must be compatible with your studies, and your employer needs to see your card or authorisation before you start. Different rules apply to post-compulsory vocational training, where the route is formative practice rather than general employment.",
    },
    {
      q: "Does working affect my student health insurance?",
      a: "It can. Starting work means Social Security affiliation, and affiliation can replace the private insurance requirement your authorisation imposed. Do not cancel a policy without confirming it against your own authorisation conditions first.",
    },
  ],
  sources: [MINISTRY],
};

export const adminDaySurvival: Chapter = {
  slug: "admin-day-survival",
  number: "12",
  navTitle: "Admin-day survival",
  kicker: "12 · At the counter",
  title: "Spanish phrases and emergency numbers for admin day in Barcelona",
  metaTitle: "Spanish phrases and emergency numbers for admin day",
  description:
    "Seven Spanish phrases for a government counter, Barcelona emergency numbers (112, 061, 092, 017), office-hours habits and Catalan versus Spanish.",
  lede:
    "Print this page, or screenshot it. It is the only page you need on you.",
  keyFacts: [
    "112 is police, fire and medical, free and 24/7. 061 is Salut Respon for health guidance in Catalonia, 092 is the Guàrdia Urbana, and 017 is INCIBE for online fraud.",
    "Most administrative offices deal with the public in the morning only, and many close entirely in August and around public holidays.",
    "Volant and certificat are the Catalan spellings of volante and certificado. Same documents.",
  ],
  blocks: [
    {
      kind: "phrases",
      title: "Say this",
      rows: [
        { spanish: "Tengo cita para…", english: "I have an appointment for…" },
        { spanish: "¿Qué documentos me faltan?", english: "Which documents am I missing?" },
        { spanish: "¿Necesito el certificado o el volante?", english: "Do you need the certificate or the volante?" },
        { spanish: "¿Puede hablar más despacio?", english: "Could you speak more slowly?" },
        { spanish: "¿Me lo puede dar por escrito?", english: "Could you give it to me in writing?" },
        { spanish: "¿Cuál es mi número de expediente?", english: "What is my file number?" },
        { spanish: "Necesito ayuda. ¿Habla inglés?", english: "I need help. Do you speak English?" },
      ],
    },
    {
      kind: "table",
      caption: "Emergency numbers",
      head: ["Number", "Who"],
      rows: [
        ["112", "Police, fire, medical. Free, 24/7."],
        ["061", "Salut Respon: health guidance, Catalonia."],
        ["092", "Guàrdia Urbana, local police."],
        ["017", "INCIBE: online fraud."],
      ],
    },
    {
      kind: "checklist",
      title: "Last-minute check",
      items: [
        "Originals and paper copies",
        "790 form paid and stamped",
        "Appointment confirmation and expediente number",
        "Names match on every document",
      ],
    },
    { kind: "h3", text: "Office hours are not your hours" },
    {
      kind: "p",
      text: "Most administrative offices deal with the public in the morning only, and many close entirely in August and around public holidays. Check the specific office’s hours the day before, not the general website’s.",
    },
    {
      kind: "p",
      text: "Arrive early. A 09:30 appointment is not a 09:30 arrival.",
    },
    { kind: "h3", text: "Catalan and Spanish" },
    {
      kind: "p",
      text: "Both are official here. Municipal websites often default to Catalan: look for the language switch, usually top right, and note that the Spanish version is occasionally less complete.",
    },
    {
      kind: "p",
      text: "Volant and certificat are the Catalan spellings of volante and certificado. Same documents. See [registering your address](/guide/register-your-address-padron) for which one you need.",
    },
  ],
  faq: [
    {
      q: "What are the emergency numbers in Barcelona?",
      a: "112 is police, fire and medical, free and 24/7. 061 Salut Respon gives health guidance in Catalonia, 092 is the Guàrdia Urbana (local police), and 017 INCIBE handles online fraud.",
    },
    {
      q: "What Spanish phrases do I need at a government office?",
      a: "Useful ones are “Tengo cita para…” (I have an appointment for…), “¿Qué documentos me faltan?” (Which documents am I missing?), “¿Me lo puede dar por escrito?” (Could you give it to me in writing?) and “Necesito ayuda. ¿Habla inglés?” (I need help. Do you speak English?).",
    },
    {
      q: "Do Barcelona government offices open all day?",
      a: "Most administrative offices deal with the public in the morning only, and many close entirely in August and around public holidays. Check the specific office’s hours the day before, not the general website’s.",
    },
  ],
  sources: [POLICE],
};

export const howMuchAdmin: Chapter = {
  slug: "how-much-admin",
  number: "13",
  navTitle: "Do it yourself, or hand it over?",
  kicker: "13 · Do it yourself, or hand it over?",
  title: "Do it yourself, or hand it over? Student paperwork in Barcelona, counted",
  metaTitle: "Do it yourself or hand it over? Student admin, counted",
  description:
    "Documents, official systems and in-person visits for the TIE, EU certificate, padrón, travel pass and bank account, counted from the official checklists.",
  lede:
    "No opinions, just counts: documents to produce, separate systems to use, and times you physically show up during office hours.",
  keyFacts: [
    "The non-EU TIE application is the heaviest task: nine documents, three systems and two in-person appointments.",
    "The padrón needs four documents, one system and one appointment.",
    "All of it is doable without paid help. Thousands of students do it every September with patience and a checklist.",
  ],
  blocks: [
    {
      kind: "callout",
      tone: "key",
      title: "All of this is genuinely doable alone",
      body: [
        "Thousands of students do it every September with nothing but patience and this kind of checklist. It’s free and it’s official. If you have time in your first fortnight and a bit of Spanish, do it yourself. We’d rather you kept your money.",
      ],
    },
    {
      kind: "table",
      caption: "How much admin each task creates (counted from the official checklists, non-EU route)",
      head: ["Task", "Documents required", "Separate systems / portals", "In-person appointments"],
      rows: [
        ["TIE application", "9", "3", "2"],
        ["EU certificate", "6", "3", "1"],
        ["Padrón", "4", "1", "1"],
        ["Travel pass setup", "1", "2", "1"],
        ["Bank account", "3", "1", "0"],
      ],
      note: "Counts reflect the ordinary published requirements. Local offices may request additional evidence depending on the procedure and your circumstances. Documents counted for the TIE are the nine on the [Getting your TIE](/guide/getting-your-tie) appointment-day checklist. The three in-person visits on the cover are the padrón counter, the fingerprint appointment, and card collection where a second visit is required.",
    },
    {
      kind: "callout",
      tone: "note",
      title: "Who tends to need help",
      body: [
        "A one-year programme with no slack in it. You don’t speak Spanish. You arrived in the September crush with the clock running. You’ve already lost one appointment. Your landlord is difficult about the padrón.",
        "None of those you? Use the checklists and keep your money.",
      ],
    },
  ],
  faq: [
    {
      q: "How much paperwork does a student face in Barcelona?",
      a: "Counted from the official checklists on the non-EU route: the TIE needs nine documents, three systems and two in-person appointments; the EU certificate six documents, three systems and one appointment; the padrón four documents, one system and one appointment; a travel pass one document and two systems; a bank account three documents and one system.",
    },
    {
      q: "Can I do the student paperwork in Spain myself?",
      a: "Yes. Thousands of students do it every September with patience and a checklist. It is free and official, and if you have time in your first fortnight and a bit of Spanish, you can do it yourself.",
    },
  ],
  sources: [POLICE],
};
