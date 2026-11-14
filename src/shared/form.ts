// Lives outside the "use server" action files: those may export only async functions.
// FormData values can be null or a File: anything that is not a string counts as empty.
export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** A FormData from plain fields, for calling a server action from code. */
export function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}
