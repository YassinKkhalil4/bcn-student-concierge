import type { Chapter } from "../types";
import { MINISTRY, POLICE } from "../sources";

const P3 = "Part 3 · Life admin";

export const healthInsurance: Chapter = {
  slug: "health-insurance-requirements",
  number: "09",
  navTitle: "Health insurance",
  kicker: "09 · Health cover",
  part: P3,
  audience: [{ tone: "all", label: "Everyone" }],
  title: "Student health insurance in Spain: will your policy still qualify?",
  metaTitle: "Student health insurance in Spain: 4 rejection criteria",
  description: "Will your health insurance survive the counter and your renewal? The four rejection criteria, CatSalut and the TSI, and what changes if you work.",
  lede: "If you're non-EU, you bought insurance at the consulate months ago. This isn't about what to buy. It's whether what you have survives the counter, and when it runs out.",
  keyFacts: [
    "Some extranjería offices apply the criteria more strictly at renewal than the consulate did, and some prefer Spanish insurers.",
    "Check a policy against four criteria: no copayments, no waiting periods, an insurer authorised to operate in Spain, and dates covering the full authorised period rather than the academic year.",
    "Once you're on the padrón in Catalonia, many students can access CatSalut public healthcare and a targeta sanitària (TSI). This does not replace the insurance your authorisation requires.",
    "An EHIC can satisfy the requirement for EU, EEA and Swiss students if it stays valid for the whole relevant period and gives the required entitlement.",
  ],
  blocks: [
    {
      kind: "cards",
      items: [
        {
          label: "Non-EU",
          title: "The four rejection criteria",
          body: [
            "Check your policy against these before your appointment, not at it.",
            "**No copayments.** The biggest killer. A policy that charges per visit isn't comparable to public cover.",
            "**No waiting periods.** Cover that starts in three months doesn't cover you now.",
            "**Insurer authorised to operate in Spain.** A policy from home usually isn't.",
            "**Dates cover the full authorised period**, not the academic year. The gap between them is where people get caught.",
          ],
        },
        {
          label: "EU",
          title: "EU, EEA, Swiss",
          body: [
            "An EHIC can satisfy the requirement if it stays valid for the whole relevant period and gives the required entitlement. Check with your home insurer rather than assuming.",
            "Two things change this: **starting work** and **changing your residence situation**. Both are worth a five-minute call first.",
          ],
        },
      ],
    },
    {
      kind: "strips",
      title: "Where people get caught",
      tag: "Illustrative",
      rows: [
        { label: "Authorised period", segs: [{ from: 0, to: 100, tone: "ink", text: "WHAT YOUR POLICY MUST COVER" }] },
        {
          label: "Policy bought for the academic year",
          segs: [
            { from: 0, to: 70, tone: "teal", text: "COVERED" },
            { from: 72, to: 100, tone: "gap", text: "GAP → REJECTED" },
          ],
        },
      ],
    },
    {
      kind: "callout",
      tone: "note",
      title: "Your visa policy may not get you your renewal",
      body: [
        "Some extranjería offices apply the criteria more strictly at renewal than the consulate did, and some prefer Spanish insurers. If your policy came from a broker at home, find out now what renewing looks like, not eleven months from now.",
        "**Diarise your policy end date today.** It's the most commonly missed date in this entire guide.",
      ],
    },
    {
      kind: "cards",
      items: [
        {
          title: "You may be paying twice",
          body: [
            "Once you're on the padrón in Catalonia, many students can access **CatSalut** public healthcare and get a *targeta sanitària* (TSI). This does **not** replace the insurance your authorisation requires.",
            "You may have a public route for ordinary care. Check with CatSalut before you renew.",
          ],
        },
        {
          title: "If you do need to buy",
          body: [
            "**Sanitas**, **ASISA** and **DKV** offer student products in Barcelona. All three advertise no-copay options without waiting periods, issue a Spanish certificate and price by quote.",
            "Compare **total payable** and cancellation rules; check for an English-speaking GP nearby.",
          ],
        },
      ],
    },
    {
      kind: "callout",
      tone: "note",
      title: "Referral disclosure",
      body: [
        "We may receive a referral fee from some insurers, including Sanitas. ASISA and DKV pay us nothing. We quote no prices for any of them, so this page recommends none. Get three quotes and pick on the criteria above. If we later help you buy, we'll tell you then whether we're paid on it.",
      ],
    },
    { kind: "p", text: "Starting work changes the picture: see [working while you study](/guide/working-while-you-study)." },
  ],
  faq: [
    {
      q: "What are the requirements for student health insurance in Spain?",
      a: "Check four things: no copayments, no waiting periods, an insurer authorised to operate in Spain, and dates covering the full authorised period rather than the academic year. A policy that charges per visit isn't comparable to public cover, and cover that starts in three months doesn't cover you now.",
    },
    {
      q: "Can I use public healthcare in Catalonia as a student?",
      a: "Once you're on the padrón in Catalonia, many students can access CatSalut public healthcare and get a targeta sanitària (TSI). This does not replace the insurance your authorisation requires. Check with CatSalut before you renew.",
    },
    {
      q: "Which insurers offer student health insurance in Barcelona?",
      a: "Sanitas, ASISA and DKV offer student products in Barcelona. All three advertise no-copay options without waiting periods, issue a Spanish certificate and price by quote. Get three quotes and compare total payable and cancellation rules.",
    },
  ],
  sources: [POLICE],
};

export const costsBankSim: Chapter = {
  slug: "costs-bank-account-sim",
  number: "10",
  navTitle: "Money, bank account, SIM",
  kicker: "10 · Practicalities",
  part: P3,
  audience: [{ tone: "all", label: "Everyone" }],
  title: "What student paperwork costs in Spain, plus the bank account and SIM you need",
  metaTitle: "Student paperwork costs in Spain, bank account and SIM",
  description: "The fees for TIE and EU registration (€16.08 and €12), the free padrón, a realistic total, and what to know about a Spanish bank account and phone number.",
  lede: "Not a cost-of-living page. Just the money the paperwork takes, and what you need working to pay it.",
  keyFacts: [
    "Fee 790-012 is €12.00 on the EU route and €16.08 for a non-EU TIE. Padrón registration is €0.",
    "The guide's estimate for the whole process on the non-EU route is €80–160, including photos, copies, a travel pass and insurance if you must buy it.",
    "A Spanish IBAN isn't legally required for a SEPA payment, but some landlords and most utility direct debits want an ES IBAN.",
    "Prepaid SIMs work on a passport. Contract plans generally want a NIE, which you may not have yet.",
  ],
  blocks: [
    {
      kind: "costbars",
      title: "The paperwork, start to finish",
      total: "Total, non-EU: **€80–160**",
      legend: ["Fixed / minimum", "Up to"],
      rows: [
        { label: "Fee 790-012, EU registration", tag: { tone: "eu", label: "EU" }, value: "€12.00", min: 12, max: 12 },
        { label: "Fee 790-012, TIE", tag: { tone: "non", label: "Non-EU" }, value: "€16.08", min: 16.08, max: 16.08 },
        { label: "Padrón registration", tag: { tone: "free", label: "All" }, value: "€0", min: 0, max: 0 },
        { label: "Passport photos, 32×26 mm", tag: { tone: "non", label: "Non-EU" }, value: "€6-12", min: 6, max: 12 },
        { label: "Photocopies", tag: { tone: "all", label: "All" }, value: "€5-10", min: 5, max: 10 },
        { label: "T-mobilitat card + 90-day T-jove", tag: { tone: "all", label: "Under 30" }, value: "€46.50-50", min: 46.5, max: 50 },
        { label: "Insurance, if you must buy", tag: { tone: "all", label: "Some" }, value: "€0-65", min: 0, max: 65 },
      ],
      axis: [0, 20, 40, 60],
      note: "Government fees confirmed against the current fee schedule. The padrón really is free: anyone charging you is charging for their time, not the registration.",
    },
    {
      kind: "cards",
      items: [
        {
          title: "A bank account",
          body: [
            "You need one that does three things: **pays the fee, receives money from home, pays your rent.**",
            "A Spanish IBAN isn't legally required for a SEPA payment; an account in another EU country shouldn't be refused for that alone. In practice, **some landlords and most utility direct debits want an ES IBAN**, so get one if you can.",
            "**At every ATM and card terminal, choose euros.** Offered your home currency? Decline. That's dynamic currency conversion, and it's usually worse.",
          ],
        },
        {
          title: "A Spanish number",
          body: [
            "**Prepaid works on a passport.** Contract plans generally want a NIE, which you may not have yet.",
            "**You want a +34 number** for appointment SMS and deliveries. A data-only travel eSIM often gives you no number at all.",
            "**\"€10 every 28 days\" isn't €10 a month.** A 28-day cycle renews about thirteen times a year.",
          ],
        },
      ],
    },
    {
      kind: "cycle",
      label: "Payments in a year",
      rows: [
        { label: "Monthly", count: 12 },
        { label: "28-day", count: 13, extra: true },
      ],
    },
    { kind: "p", text: "Keep access to your home SIM until your bank stops sending codes to it." },
  ],
  faq: [
    {
      q: "How much does student paperwork cost in Spain?",
      a: "Fee 790-012 is €12.00 for the EU route and €16.08 for a non-EU TIE, and padrón registration is free. Adding photos, photocopies, a travel pass and insurance if you must buy it, the guide estimates €80–160 in total for the non-EU route.",
    },
    {
      q: "Do I need a Spanish bank account to pay the TIE fee?",
      a: "A Spanish IBAN isn't legally required for a SEPA payment, and an account in another EU country shouldn't be refused for that alone. In practice some landlords and most utility direct debits want an ES IBAN, so get one if you can.",
    },
    {
      q: "Can I get a Spanish SIM card without a NIE?",
      a: "Yes. Prepaid works on a passport, while contract plans generally want a NIE, which you may not have yet. Make sure you get a +34 number for appointment SMS, because a data-only travel eSIM often gives you no number at all.",
    },
  ],
  sources: [POLICE],
};

export const workingWhileStudying: Chapter = {
  slug: "working-while-you-study",
  number: "11",
  navTitle: "Working while you study",
  kicker: "11 · Earning",
  part: P3,
  audience: [{ tone: "all", label: "Everyone" }],
  title: "Can international students work in Spain? The 30-hour rule (RD 1155/2024)",
  metaTitle: "Can students work in Spain? 30 hours (RD 1155/2024)",
  description: "Under RD 1155/2024, higher-education students in Spain may work 30 hours a week without a separate work permit. Conditions, and the effect on health cover.",
  lede: "The question everyone asks after the TIE. The answer recently changed in your favour.",
  keyFacts: [
    "Under RD 1155/2024, students in higher education may work up to 30 hours a week without a separate work permit.",
    "Older guidance online says 20 hours or says you need a permit. Check the date on anything you read.",
    "Two conditions: the work must be compatible with your studies, and your employer needs to see your card or authorisation before you start.",
    "Starting work means Social Security affiliation, which can replace the private insurance your authorisation required.",
  ],
  blocks: [
    {
      kind: "statcards",
      items: [
        {
          big: "30 h",
          unit: "a week, no separate permit",
          tone: "teal",
          ruler: { oldLabel: "Old rule", old: "20h", nowLabel: "Now", now: "30h" },
          body: [
            "Under **RD 1155/2024**, students in higher education may work up to 30 hours a week without a separate work permit. Older guidance online says 20 hours or says you need a permit. **Check the date on anything you read.**",
          ],
        },
        {
          big: "2",
          unit: "conditions",
          tone: "ink",
          body: [
            "The work must be **compatible with your studies**. And your employer needs to see your card or authorisation **before you start**: they carry the risk if you can't evidence your status.",
            "Post-compulsory vocational training follows different rules: formative practice, not general employment.",
          ],
        },
        {
          big: "1",
          unit: "catch: your health cover",
          tone: "amber",
          body: [
            "Starting work means Social Security affiliation, which can replace the private insurance your authorisation required.",
            "Don't cancel a policy without checking your own authorisation conditions first. But do check: some students pay for cover they no longer need.",
          ],
        },
      ],
    },
    {
      kind: "p",
      text: "Put your dates in one place: [the calendar in section 02](/guide/the-30-day-clock) lists every date that can quietly bite you. Health policy rules are in [health cover](/guide/health-insurance-requirements).",
    },
  ],
  faq: [
    {
      q: "How many hours can a student work in Spain?",
      a: "Under RD 1155/2024, students in higher education may work up to 30 hours a week without a separate work permit. Older guidance online says 20 hours or says you need a permit, so check the date on anything you read.",
    },
    {
      q: "What conditions apply to student work in Spain?",
      a: "The work must be compatible with your studies, and your employer needs to see your card or authorisation before you start. Post-compulsory vocational training follows different rules: formative practice, not general employment.",
    },
    {
      q: "Does working affect my student health insurance?",
      a: "It can. Starting work means Social Security affiliation, which can replace the private insurance your authorisation required. Don't cancel a policy without checking your own authorisation conditions first.",
    },
  ],
  sources: [MINISTRY],
};
