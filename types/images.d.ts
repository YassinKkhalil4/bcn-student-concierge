/**
 * Types for static image imports (`import cover from "./cover.png"`).
 *
 * Next normally supplies this through next-env.d.ts, which `next build`
 * generates and .gitignore excludes. Without a committed copy, `tsc --noEmit`
 * fails on a fresh clone before anything has been built — so the type gate
 * only worked for whoever happened to have run a build.
 */
/// <reference types="next/image-types/global" />
