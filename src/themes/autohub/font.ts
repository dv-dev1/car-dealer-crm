import { Archivo } from "next/font/google";

// Archivo with the width axis: the landing headings are wide (font-stretch 108–125%).
// Kept out of the root layout so the public store site never preloads it.
export const autohubFont = Archivo({ subsets: ["latin"], axes: ["wdth"], display: "swap", variable: "--font-archivo" });
