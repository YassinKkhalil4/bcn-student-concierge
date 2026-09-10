import type { Metadata } from "next";
import { LegalPage, Clause } from "@/components/LegalPage";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

export const metadata: Metadata = {
  title: "Scope of Service",
  description:
    "What BCN Student Concierge does and does not do, and why the distinction matters under Spanish law.",
};

export default function ScopePage() {
  return (
    <LegalPage eyebrow="Legal" title="Scope of service" updated="10 September 2026">
      <LegalDisclaimer variant="prominent" />

      <Clause heading="What we are">
        <p>
          BCN Student Concierge is a private administrative facilitation service. We
          prepare documents from information you supply, book appointments on public
          booking systems in your name, and guide you through a process that is
          conducted in Spanish and assumes local knowledge you do not yet have.
        </p>
      </Clause>

      <Clause heading="What we are not">
        <p>
          We are not a law firm (despacho de abogados) and hold no colegiación. We are
          not a registered gestoría administrativa. We are not agents, representatives
          or intermediaries of any Spanish public authority, and we are not affiliated
          with any university.
        </p>
        <p>
          Spanish law reserves certain activities — legal representation, formal
          immigration advice, and acting before authorities on another person's behalf
          — to regulated professionals. Offering those services without that
          qualification is intrusismo profesional. We do not offer them, and this page
          exists so there is no ambiguity about it.
        </p>
      </Clause>

      <Clause heading="Section 2 of your form stays blank">
        <p>
          Official forms EX-17 and EX-18 contain a section for the details of a legal
          representative. We leave it deliberately and permanently empty. Completing
          it would declare to the National Police that we act as your representative,
          which is both untrue and would require a power of attorney we neither hold
          nor will ask you for. You are the applicant on every form we prepare.
        </p>
      </Clause>

      <Clause heading="Electronic notifications (DEHú)">
        <p>
          We leave the electronic-notification consent box unchecked. Opting in starts
          legally binding notification deadlines delivered to a Spanish government
          mailbox that requires a digital certificate to open — something a newly
          arrived student does not have. A missed notification can close a file. If
          you later obtain a certificate and want to opt in, that is your decision to
          make knowingly.
        </p>
      </Clause>

      <Clause heading="No guaranteed outcome">
        <p>
          Decisions on residency, registration and documentation rest entirely with
          the competent Spanish authorities. We do not influence those decisions and
          cannot guarantee any outcome, timeline or appointment availability. What we
          are accountable for is that your file is complete, internally consistent,
          correctly formatted and submitted on time.
        </p>
      </Clause>

      <Clause heading="Your responsibilities">
        <p>
          The information you give us becomes a declaration you sign. You are
          responsible for its accuracy, for reviewing every document before signing,
          and for attending appointments in person with the original documents. We
          will tell you clearly what to check; we cannot check it for you, because we
          have never seen your original passport.
        </p>
      </Clause>

      <Clause heading="When we will refer you elsewhere">
        <p>
          If your situation involves a refused application, an expired or irregular
          status, a criminal record check, a family reunification claim, or any matter
          requiring legal analysis, we will say so and decline the work rather than
          attempt it. We would rather lose the engagement than have you rely on advice
          we are not qualified to give.
        </p>
      </Clause>
    </LegalPage>
  );
}
