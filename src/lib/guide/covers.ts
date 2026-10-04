import type { StaticImageData } from "next/image";
import en from "../../../assets/guide/cover.png";
import es from "../../../assets/guide/cover-es.png";
import ca from "../../../assets/guide/cover-ca.png";
import fr from "../../../assets/guide/cover-fr.png";
import it from "../../../assets/guide/cover-it.png";
import de from "../../../assets/guide/cover-de.png";

/** The guide's cover, in the visitor's language: page 1 of that language's PDF. */
const COVERS: Record<string, StaticImageData> = { en, es, ca, fr, it, de };
export const coverFor = (locale: string): StaticImageData => COVERS[locale] ?? en;
