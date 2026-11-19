// An in-memory Workers KV namespace with the three calls the photo store makes.
export function fakeKv() {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    objects,
    async put(key: string, value: Uint8Array, options: { metadata: { contentType: string } }) {
      objects.set(key, { bytes: value, contentType: options.metadata.contentType });
    },
    async getWithMetadata(key: string, options: { type: "stream" }) {
      if (options.type !== "stream") throw new Error("the photo store reads streams");
      const object = objects.get(key);
      return object
        ? { value: new Blob([object.bytes as Uint8Array<ArrayBuffer>]).stream(), metadata: { contentType: object.contentType } }
        : { value: null, metadata: null };
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
}
