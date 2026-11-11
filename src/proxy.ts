import { authkitProxy } from "@workos-inc/authkit-nextjs";

// Only keeps the WorkOS session fresh. It is never the lock: requireMember() runs in every route.
export default authkitProxy({ middlewareAuth: { enabled: false, unauthenticatedPaths: [] } });

export const config = {
  // Only the routes that read or write the session; the public site and static files skip it.
  matcher: ["/entrar/:path*", "/callback", "/gestao/:path*", "/sem-acesso"],
};
