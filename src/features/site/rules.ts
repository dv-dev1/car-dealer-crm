// What the interest form and its action share; nothing here reads the database.
export type InterestState = { status: "idle" | "sent" | "error"; error?: string; typed?: { name: string; phone: string } };
