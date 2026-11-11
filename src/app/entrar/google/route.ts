// The state must be new on every visit: never prerender or cache this route.
export const dynamic = "force-dynamic";

export { startGoogleLogin as GET } from "@/features/auth/routes";
