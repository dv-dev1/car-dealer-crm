import { authkitProxy } from "@workos-inc/authkit-nextjs";

// Only keeps the WorkOS session fresh. It is never the lock: requireMember() runs in every route.
export default authkitProxy({ middlewareAuth: { enabled: false, unauthenticatedPaths: [] } });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|webp|avif|gif|svg|ico)$).*)"],
};
