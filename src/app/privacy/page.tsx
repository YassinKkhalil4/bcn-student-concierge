import type { Metadata } from "next";
import { LegalPage, Clause } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy & GDPR",
  description:
    "How BCN Student Concierge collects, encrypts, retains and deletes personal data under the GDPR and LOPDGDD.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy notice and GDPR commitments"
      updated="10 September 2026"
    >
      <Clause heading="Who is responsible for your data">
        <p>
          BCN Student Concierge (the “controller”) determines how and why your personal
          data is processed. Contact for all data-protection matters, including
          exercising the rights below:{" "}
          <a href="mailto:privacy@bcnstudentconcierge.com" className="text-olive underline">
            privacy@bcnstudentconcierge.com
          </a>
          .
        </p>
      </Clause>

      <Clause heading="What we collect, and why">
        <p>
          Identity and civil-status data (passport number, NIE, names, gender, birth
          details, nationality, marital status, parents' given names), your Spanish
          address, contact details, and scans of your passport, university acceptance
          letter and lease.
        </p>
        <p>
          Legal basis: performance of a contract with you (GDPR Art. 6(1)(b)). We
          collect this data because Spanish residency forms require it — not because
          we want it. We do not collect health data, biometric templates, or any
          special-category data under Art. 9 beyond what appears on the face of the
          documents you upload.
        </p>
      </Clause>

      <Clause heading="How your documents are protected">
        <p>
          Every uploaded document is encrypted at rest with AES-256-GCM under a key
          unique to that file. Those per-file keys are themselves encrypted under a
          master key held in a managed key store, separate from the database — so a
          copy of the database alone does not decrypt anything, and one compromised
          file never exposes another.
        </p>
        <p>
          All traffic is served over TLS with HTTP Strict Transport Security. Payment
          card details are handled entirely by Stripe and never reach our servers.
        </p>
        <p>
          <span className="font-medium text-ink">An honest limitation: </span>
          this is strong encryption at rest, but it is not end-to-end encryption. Our
          systems can decrypt your documents, because our staff must review them and
          our software must read your data to populate your forms. Any service telling
          you it holds your passport under end-to-end encryption while also filling in
          your paperwork is describing something that cannot be true.
        </p>
      </Clause>

      <Clause heading="How long we keep it — the 30-day rule">
        <p>
          Passport scans, uploaded documents and identity data are permanently deleted
          30 days after your service completes. This runs as an automated daily job,
          not a manual promise: expired files are purged without anyone deciding to do
          it, and the deletion is irreversible.
        </p>
        <p>
          Two things survive that purge, and only these: a record that the file existed
          and was deleted, and invoice data. Spanish commercial and tax law (Código de
          Comercio Art. 30; Ley General Tributaria) requires invoice records to be kept
          for several years, and that obligation overrides erasure requests for those
          specific records under GDPR Art. 17(3)(b). Nothing in the retained invoice
          data includes your passport number or document scans.
        </p>
        <p>You may request deletion earlier than 30 days at any time.</p>
      </Clause>

      <Clause heading="Who else sees your data">
        <p>
          Stripe (payment processing, Ireland/USA under the EU-US Data Privacy
          Framework) and our EU-based hosting and email providers, each under a data
          processing agreement. We do not sell your data, we do not share it with
          advertisers, and we do not transfer it outside the EEA except as stated here.
        </p>
        <p>
          Public authorities receive only what you submit to them yourself, in your own
          name, at your appointment.
        </p>
      </Clause>

      <Clause heading="Your rights">
        <p>
          You may request access to your data, correction of inaccuracies, erasure,
          restriction of processing, portability in a machine-readable format, and you
          may object to processing. Where processing rests on consent, you may withdraw
          it at any time — though withdrawing consent to hold your documents will
          usually mean we cannot complete the service.
        </p>
        <p>
          We respond within one month. If you are unsatisfied, you may complain to the
          Agencia Española de Protección de Datos (AEPD), C/ Jorge Juan 6, 28001
          Madrid, or at aepd.es.
        </p>
      </Clause>

      <Clause heading="Breach notification">
        <p>
          If a breach occurs that is likely to result in a risk to your rights, we
          notify the AEPD within 72 hours and inform you directly without undue delay.
          We will tell you what was accessed, not a vague reassurance.
        </p>
      </Clause>

      <Clause heading="Cookies">
        <p>
          This site sets no advertising or analytics cookies and runs no third-party
          trackers. Stripe sets cookies strictly necessary for fraud prevention during
          checkout. There is no consent banner because there is nothing to consent to.
        </p>
      </Clause>
    </LegalPage>
  );
}
