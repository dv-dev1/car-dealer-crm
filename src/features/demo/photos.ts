// Maré car photos: model key (modelKey in seed.ts) -> files in db/demo-photos/<key>/, uploaded to R2 under
// demo/<key>/ by `npm run demo:photos`. Every car of a model shares them. Each file comes from a stock image
// bank with commercial license, plate illegible, credited in db/demo-photos/CREDITS.md.
// Empty until the files are in the repo: the cars show "Sem foto".
export const DEMO_PHOTOS: Record<string, string[]> = {};
