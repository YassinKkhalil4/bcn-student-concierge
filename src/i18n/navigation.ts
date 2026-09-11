import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware Link, redirect and hooks: links keep the visitor's language. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
