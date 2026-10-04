import type { Chapter } from "./types";
import { euRegistration, gettingYourTie, appointmentWontCome } from "./chapters/part-2";
import { costsBankSim, healthInsurance, registerPadron } from "./chapters/part-3";
import { adminDaySurvival, howMuchAdmin, workingWhileStudying } from "./chapters/part-4";
import { firstWeek, nieTiePadron, pickYourRoute, theClock } from "./chapters/part-1";

/** Reading order. The URL of each chapter is /guide/<slug>, in English only. */
export const CHAPTERS: readonly Chapter[] = [
  pickYourRoute,
  theClock,
  firstWeek,
  nieTiePadron,
  gettingYourTie,
  euRegistration,
  appointmentWontCome,
  registerPadron,
  healthInsurance,
  costsBankSim,
  workingWhileStudying,
  adminDaySurvival,
  howMuchAdmin,
];

export function getChapter(slug: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}

export function chapterNeighbours(slug: string): { prev?: Chapter; next?: Chapter } {
  const i = CHAPTERS.findIndex((c) => c.slug === slug);
  if (i < 0) return {};
  return { prev: CHAPTERS[i - 1], next: CHAPTERS[i + 1] };
}

export const chapterPath = (slug: string) => `/guide/${slug}`;
