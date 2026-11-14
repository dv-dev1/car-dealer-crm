// Car photos live in R2; the app serves them from /fotos/<key>.
export function photoUrl(path: string): string {
  return `/fotos/${path}`;
}
