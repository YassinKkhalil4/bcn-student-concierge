/**
 * Produce an ADMIN_PASSWORD_HASH value.
 *
 *   npm run admin:hash-password
 *
 * Reads the password from stdin so it never lands in shell history or `ps`.
 */
import { createInterface } from "node:readline/promises";
import { hashPassword } from "../src/lib/admin/password.ts";

const rl = createInterface({ input: process.stdin, output: process.stderr });
const password = (await rl.question("Admin password (min 12 chars): ")).trim();
rl.close();

if (password.length < 12) {
  console.error("Too short — use at least 12 characters, ideally a passphrase.");
  process.exit(1);
}
console.log(`\nADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
