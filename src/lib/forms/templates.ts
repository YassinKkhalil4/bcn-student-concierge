import { access } from "node:fs/promises";
import path from "node:path";
import type { FormId } from "./field-map";

/**
 * Where the official PDF templates live, and which files must be there.
 *
 * The official ministry and Ajuntament forms are not redistributable, so they
 * are not in git: they are copied onto the server (docs/DEPLOY.md) and mounted
 * at FORM_TEMPLATE_DIR. Two things follow, both learned from a support report
 * of "the EX-18 template isn't there" on an installation where the file was
 * present in the repository:
 *
 *  - The path is RESOLVED to an absolute one. A relative FORM_TEMPLATE_DIR
 *    (".env.example" suggests ./templates/forms) is read against the process's
 *    working directory, which is not the project directory for every way of
 *    starting the app — so the same configuration worked in dev and failed
 *    elsewhere. Same bug class as the DATA_DIR fix.
 *  - Missing files are reported at STARTUP and on the staff dashboard, not
 *    only when a student presses Download. Every error message names the
 *    resolved directory, so the fix is obvious.
 */

export const TEMPLATE_DIR = path.resolve(
  process.env.FORM_TEMPLATE_DIR?.trim() || path.join(process.cwd(), "templates", "forms"),
);

/** Official templates are suffixed to distinguish them from test fixtures. */
export const TEMPLATE_FILES: Record<FormId, string> = {
  "EX-17": "EX-17-official.pdf",
  "EX-18": "EX-18-official.pdf",
};

/** Barcelona's Padrón authorisation, filled for the sublet branch. */
export const AUTHORIZATION_TEMPLATE = "Autoritzaciodomicili_cat.pdf";

export const REQUIRED_TEMPLATES = [...Object.values(TEMPLATE_FILES), AUTHORIZATION_TEMPLATE];

export const templatePath = (file: string): string => path.join(TEMPLATE_DIR, file);

/** Which required templates are missing right now — empty when all are present. */
export async function missingTemplates(): Promise<string[]> {
  const checks = await Promise.all(
    REQUIRED_TEMPLATES.map(async (file) => {
      try {
        await access(templatePath(file));
        return null;
      } catch {
        return file;
      }
    }),
  );
  return checks.filter((f): f is string => f !== null);
}

/** One line for a log or a dashboard banner. */
export const missingTemplatesMessage = (missing: string[]): string =>
  `${missing.join(", ")} missing from ${TEMPLATE_DIR} — copy the official PDFs there (docs/FORMS.md).`;
