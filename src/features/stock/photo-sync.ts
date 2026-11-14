/** A photo in the car form: `savedId` once it is in the database; `upload` is the prepared file still to send. */
export type FormPhoto = { id: string; url: string; savedId?: string; file?: File; upload?: Blob };

type PhotoActions = {
  add: (form: FormData) => Promise<{ error: string | null; id?: string }>;
  remove: (form: FormData) => Promise<{ error: string | null }>;
};

/** Removes and sends the photos one by one. What worked is marked done, so saving again retries only what failed. */
export async function syncPhotos(
  vehicleId: string,
  photos: FormPhoto[],
  removed: string[],
  actions: PhotoActions,
): Promise<{ photos: FormPhoto[]; removed: string[]; error: string | null; sent: number; total: number }> {
  let error: string | null = null;
  const stillRemoved: string[] = [];
  for (const photoId of removed) {
    const form = new FormData();
    form.set("photoId", photoId);
    const result = await actions.remove(form);
    if (result.error) {
      error = result.error;
      stillRemoved.push(photoId);
    }
  }

  let sent = 0;
  let total = 0;
  const next: FormPhoto[] = [];
  for (const photo of photos) {
    if (photo.savedId || !photo.upload) {
      next.push(photo);
      continue;
    }
    total += 1;
    const form = new FormData();
    form.set("vehicleId", vehicleId);
    form.set("photo", photo.upload);
    const result = await actions.add(form);
    if (result.error || !result.id) {
      error = result.error ?? "Uma foto não foi enviada; tente de novo.";
      next.push(photo);
    } else {
      sent += 1;
      next.push({ ...photo, savedId: result.id, upload: undefined });
    }
  }
  return { photos: next, removed: stillRemoved, error, sent, total };
}
