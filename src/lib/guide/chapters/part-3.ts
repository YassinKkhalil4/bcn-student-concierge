import type { Chapter } from "../types";
import { POLICE, PORTAL } from "../sources";

export const registerPadron: Chapter = {
  slug: "register-your-address-padron",
  number: "08",
  navTitle: "Registering your address (padrón)",
  kicker: "08 · The town hall",
  title: "How to register your address (padrón) in Barcelona as a student",
  metaTitle: "Padrón in Barcelona: register your address as a student",
  description:
    "The padrón is free and you don’t need to own the flat or hold the lease. Four situations, accepted evidence, volant vs certificat and the two-year renewal.",
  lede:
    "Free, quietly required by the step after it, and the one where a difficult landlord can genuinely stall you. It is also the part most students get wrong before they have even started.",
  keyFacts: [
    "Registration on the padrón is free. Anyone charging you for it is charging for their time, not for the registration.",
    "You do not need to own the property or hold the lease to register. The padrón records where you actually live, and it grants no tenancy right and no ownership claim.",
    "An OAC appointment (cita prèvia) is required. Your address must include floor and door number.",
    "Non-EU residents without long-term residence must renew the registration every two years. It lapses silently if you miss it.",
    "Never register at an address you do not live at: article 392 of the Criminal Code covers falsifying a document.",
  ],
  blocks: [
    {
      kind: "callout",
      tone: "key",
      title: "The fact that unlocks most of this",
      body: [
        "You do not need to own the property or hold the lease to register. The padrón records where you actually live. It grants no tenancy right and no ownership claim, which is exactly why a landlord’s refusal does not end the matter, and why their fear of “giving you rights” is misplaced.",
      ],
    },
    { kind: "h3", text: "Find your rung, then stop reading" },
    {
      kind: "p",
      text: "Four situations. Most students who panic about this are on rung one and do not know it.",
    },
    {
      kind: "cards",
      items: [
        {
          label: "Rung 1",
          title: "The contract is in your name",
          body: [
            "No landlord involvement needed at all. The contract is your proof, and they already signed it. Bring it with your ID and you are done. If this is you, the rest of this page is not your problem.",
          ],
        },
        {
          label: "Rung 2",
          title: "You rent a room, or the contract is in someone else’s name",
          body: [
            "You need an express written authorisation from the person whose name is on the title or contract: signed original, adult, plus a photocopy of their ID showing the same signature.",
            "The authoriser can be the owner or the tenant. Neither has to be registered there themselves, but they must evidence their own title. Your head tenant can authorise you using their own rental contract. That single sentence resolves most room-rental cases.",
          ],
        },
        {
          label: "Rung 3",
          title: "You live in a student residence",
          body: [
            "Authorisation from the establishment’s titleholder. Usually routine: ask reception, they will have done it many times. If they say they don’t do it, ask again in writing and name the person you spoke to.",
          ],
        },
        {
          label: "Rung 4",
          title: "You have no documentation at all",
          body: [
            "There is an official fallback. After you submit the application, municipal services verify by telephone and a visit to the address.",
            "Be clear-eyed about the trade-offs: it is slower, you must be genuinely reachable and genuinely living there, and your landlord may find out, because a municipal officer arriving at the door is not discreet. It works. It is not frictionless.",
          ],
        },
      ],
    },
    {
      kind: "checklist",
      title: "Other evidence that is accepted",
      items: [
        "Escritura: the deed, if you own",
        "Nota simple from the property register",
        "An IBI receipt",
        "A bank transfer from the last two months showing rent paid",
      ],
    },
    {
      kind: "p",
      text: "Mobile and internet bills are explicitly not accepted. Neither is a utility bill in someone else’s name.",
    },
    { kind: "h3", text: "Volant or certificat?" },
    {
      kind: "p",
      text: "Students bring the wrong one, constantly. A **volant** is informative: fast, often instant online. A **certificat** carries fe pública, meaning it is the authenticated document. It is a separate request and takes longer.",
    },
    {
      kind: "p",
      text: "Procedures that need proof rather than information will specify the certificat. Ask your appointment’s own checklist which it wants, and if you cannot get a clear answer, take the certificat, because it satisfies anything the volant would have.",
    },
    { kind: "h3", text: "Booking it and what to expect" },
    {
      kind: "list",
      items: [
        "An OAC appointment (cita prèvia) is required. Book it in week one, not week three: this queue is shorter than the immigration one, but it is not instant.",
        "There is also an online route if you hold a digital certificate (idCAT or Cl@ve), which can skip the counter entirely.",
        "Roughly seven calendar days to the confirmation email, after which volants are available.",
        "Your address must include floor and door number. “Carrer X 44” is not an address here; “Carrer X 44, 3r 2a” is.",
      ],
    },
    {
      kind: "callout",
      tone: "note",
      title: "It expires silently",
      body: [
        "Non-EU residents without long-term residence must renew the registration every two years. Miss it and the registration lapses without anyone telling you, and you find out at the worst moment. Put the date in your calendar the day you register.",
      ],
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Never register at an address you do not live at",
      body: [
        "Barcelona has recorded falsified rental contracts and utility bills submitted for padrón registration. Article 392 of the Criminal Code carries prison sentences and fines for falsifying a document, and it attaches to your immigration file, where it will follow you through every renewal you ever apply for.",
        "It’s not a shortcut.",
      ],
    },
  ],
  faq: [
    {
      q: "Is the padrón free in Barcelona?",
      a: "Yes. Padrón registration costs €0. Anyone charging you for it is charging for their time, not for the registration.",
    },
    {
      q: "Can I register on the padrón if my landlord refuses?",
      a: "You do not need to own the property or hold the lease to register. The padrón records where you actually live and grants no tenancy right or ownership claim, so a landlord’s refusal does not end the matter. If the contract is in someone else’s name, an express written authorisation from the titleholder or tenant is needed; if you have no documentation at all, municipal services verify by telephone and a visit to the address.",
    },
    {
      q: "What is the difference between a volant and a certificat?",
      a: "A volant is informative: fast, often instant online. A certificat carries fe pública, meaning it is the authenticated document, and takes longer as a separate request. If you cannot get a clear answer about which your procedure needs, take the certificat, because it satisfies anything the volant would have.",
    },
    {
      q: "How often must I renew the padrón?",
      a: "Non-EU residents without long-term residence must renew the registration every two years. It lapses without anyone telling you, so put the date in your calendar the day you register.",
    },
  ],
  sources: [POLICE],
};

export const healthInsurance: Chapter = {
  slug: "health-insurance-requirements",
  number: "09",
  navTitle: "Health insurance",
  kicker: "09 · Health cover",
  title: "Student health insurance in Spain: will your policy still qualify?",
  metaTitle: "Student health insurance in Spain: 4 rejection criteria",
  description:
    "Will your health insurance survive the counter and your renewal? The four rejection criteria, CatSalut and the TSI, and what changes if you work.",
  lede:
    "If you are non-EU and reading this in Barcelona, you bought insurance at the consulate months ago. This chapter is not about what to buy. It is about whether what you already have will survive contact with the counter, and when it expires.",
  keyFacts: [
    "Some extranjería offices apply the criteria more strictly at renewal than the consulate did at issue, and some show a marked preference for Spanish insurers.",
    "Check a policy against four criteria: no copayments, no waiting periods, an insurer authorised to operate in Spain, and dates covering the full authorised period rather than the academic year.",
    "Once registered on the padrón in Catalonia, many students can access CatSalut public healthcare and a targeta sanitària (TSI). This does not replace the insurance requirement your authorisation imposes.",
    "An EHIC can satisfy the requirement for EU, EEA and Swiss students if it stays valid for the whole relevant period and provides the required entitlement.",
  ],
  blocks: [
    {
      kind: "callout",
      tone: "warning",
      title: "The policy that got you your visa may not get you your renewal",
      body: [
        "Some extranjería offices apply the criteria more strictly at renewal than the consulate did at issue, and some show a marked preference for Spanish insurers. If your policy came from a broker at home, find out now what renewing looks like, not eleven months from now.",
        "Diarise your policy end date today. It is the single most commonly missed date in this entire guide.",
      ],
    },
    {
      kind: "checklist",
      title: "The four rejection criteria",
      items: [
        "**No copayments.** The single biggest killer. A policy that charges you per visit is not comparable to public cover.",
        "**No waiting periods.** Cover that starts in three months does not cover you now.",
        "**Insurer authorised to operate in Spain.** A policy from home usually is not.",
        "**Dates covering the full authorised period,** not the academic year. These are different, and the gap is where people get caught.",
      ],
    },
    { kind: "p", text: "Check your policy against these before your appointment, not at it." },
    {
      kind: "p",
      text: "**Where people get caught.** A policy bought for the academic year covers less than your authorised period. The gap between the two is where a renewal is rejected.",
    },
    { kind: "h3", text: "You may be paying twice" },
    {
      kind: "p",
      text: "Once registered on the padrón in Catalonia, many students can access CatSalut public healthcare and obtain a targeta sanitària (TSI). This does not replace the insurance requirement your authorisation imposes: you still need the policy for immigration purposes.",
    },
    {
      kind: "p",
      text: "But it does mean you may have a public route for ordinary care while paying a private premium for a document. Worth knowing before you renew. Conditions vary by situation; check yours with CatSalut directly.",
    },
    { kind: "h3", text: "If you do need to buy" },
    {
      kind: "p",
      text: "Three insurers offer student-specific products in Barcelona: Sanitas, ASISA and DKV. All three advertise no-copay options without waiting periods, all three issue a Spanish certificate, and all three price by individual quote.",
    },
    {
      kind: "p",
      text: "Premiums are not published here, because the only number that matters is your quote for your dates and your age band. Compare total payable and the cancellation rules, and check there is a clinic and an English-speaking GP near you in that policy’s directory before you buy.",
    },
    {
      kind: "callout",
      tone: "note",
      title: "Referral disclosure",
      body: [
        "BCN Student Concierge may receive a referral fee from some insurers, including Sanitas. ASISA and DKV pay nothing. This page recommends none of them: get three quotes and pick on the criteria above.",
      ],
    },
    { kind: "h3", text: "EU, EEA and Swiss students" },
    {
      kind: "p",
      text: "An EHIC can satisfy the requirement if it stays valid for the whole relevant period and provides the required entitlement. Check with your home insurer rather than assuming.",
    },
    {
      kind: "p",
      text: "Two things change the position: starting work, and changing your residence situation. Both are worth a five-minute call before they happen. See [working while you study](/guide/working-while-you-study).",
    },
  ],
  faq: [
    {
      q: "What are the requirements for student health insurance in Spain?",
      a: "Check four things: no copayments, no waiting periods, an insurer authorised to operate in Spain, and dates covering the full authorised period rather than the academic year. A policy that charges per visit is not comparable to public cover, and cover that starts in three months does not cover you now.",
    },
    {
      q: "Can I use public healthcare in Catalonia as a student?",
      a: "Once registered on the padrón in Catalonia, many students can access CatSalut public healthcare and obtain a targeta sanitària (TSI). This does not replace the insurance requirement your authorisation imposes. Conditions vary by situation, so check yours with CatSalut directly.",
    },
    {
      q: "Which insurers offer student health insurance in Barcelona?",
      a: "Three insurers offer student-specific products in Barcelona: Sanitas, ASISA and DKV. All three advertise no-copay options without waiting periods, issue a Spanish certificate, and price by individual quote. Get three quotes and compare total payable and cancellation rules.",
    },
  ],
  sources: [POLICE, PORTAL],
};

export const costsBankSim: Chapter = {
  slug: "costs-bank-account-sim",
  number: "10",
  navTitle: "Money, bank account, SIM",
  kicker: "10 · Practicalities",
  title: "What student paperwork costs in Spain, plus the bank account and SIM you need",
  metaTitle: "Student paperwork costs in Spain, bank account and SIM",
  description:
    "The fees for TIE and EU registration (€16.08 and €12), the free padrón, a realistic total, and what to know about a Spanish bank account and phone number.",
  lede:
    "Not a cost-of-living page. Just the money the paperwork itself takes, and the two things you need working to pay it.",
  keyFacts: [
    "Tasa 790-012 is €12.00 on the EU route and €16.08 for a non-EU TIE. Padrón registration is €0.",
    "The guide’s estimate for the whole process on the non-EU route is €80–160 including photos, copies, a travel pass and insurance if you must buy it.",
    "A Spanish IBAN is not legally required for a SEPA payment, but some landlords and most utility direct debits want an ES IBAN.",
    "Prepaid SIMs work on a passport. Contract plans generally want a NIE, which you may not have yet.",
  ],
  blocks: [
    {
      kind: "table",
      caption: "The paperwork itself, start to finish",
      head: ["Item", "Applies to", "Cost"],
      rows: [
        ["Fee 790-012, EU registration", "EU", "€12.00"],
        ["Fee 790-012, TIE", "Non-EU", "€16.08"],
        ["Padrón registration", "Everyone", "€0 (free)"],
        ["Passport photos, 32×26 mm", "Non-EU", "€6–12"],
        ["Photocopies", "Everyone", "€5–10"],
        ["T-mobilitat card + 90-day T-jove", "Under 30", "€46.50–50"],
        ["Insurance, if you must buy", "Some", "€0–65"],
        ["Total, non-EU", "", "€80–160"],
      ],
      note: "Government fees were confirmed against the fee schedule in force when the guide was written (edition 2026/27); check the current schedule before paying. The padrón really is free: anyone charging you for it is charging for their time, not for the registration.",
    },
    { kind: "h3", text: "A bank account" },
    {
      kind: "p",
      text: "You need one that does three things: pays the fee, receives money from home, and pays your rent.",
    },
    {
      kind: "p",
      text: "A Spanish IBAN is not legally required for a SEPA payment: an account in another EU member state should not be refused for that reason alone. In practice, some landlords and most utility direct debits want an ES IBAN, so get one if you can.",
    },
    {
      kind: "p",
      text: "At every ATM and card terminal, choose euros. If a machine offers to bill you in your home currency, decline. That is dynamic currency conversion, and it is usually worse than letting your own bank or card network handle it.",
    },
    { kind: "h3", text: "A Spanish number" },
    { kind: "p", text: "Three things matter and nothing else does:" },
    {
      kind: "list",
      items: [
        "**Prepaid works on a passport.** Contract plans generally want a NIE, which you may not have yet.",
        "**You want a +34 number** for appointment SMS and delivery contact. A data-only travel eSIM often gives you no number at all.",
        "**“€10 every 28 days” is not €10 a month.** A 28-day cycle renews about thirteen times a year.",
      ],
    },
    {
      kind: "p",
      text: "Keep access to your home SIM until your bank stops sending codes to it.",
    },
  ],
  faq: [
    {
      q: "How much does student paperwork cost in Spain?",
      a: "Tasa 790-012 is €12.00 for the EU route and €16.08 for a non-EU TIE, and padrón registration is free. Adding photos, photocopies, a travel pass and insurance if you must buy it, the guide estimates €80–160 in total for the non-EU route.",
    },
    {
      q: "Do I need a Spanish bank account to pay the TIE fee?",
      a: "A Spanish IBAN is not legally required for a SEPA payment, and an account in another EU member state should not be refused for that reason alone. In practice some landlords and most utility direct debits want an ES IBAN, so get one if you can.",
    },
    {
      q: "Can I get a Spanish SIM card without a NIE?",
      a: "Yes. Prepaid works on a passport, while contract plans generally want a NIE, which you may not have yet. Make sure you get a +34 number for appointment SMS, because a data-only travel eSIM often gives you no number at all.",
    },
  ],
  sources: [POLICE],
};
