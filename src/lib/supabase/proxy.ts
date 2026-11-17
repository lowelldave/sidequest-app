import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before each page request. It keeps the sign-in session fresh (Supabase
 * stores it in cookies) and sends signed-out visitors to the sign-in page.
 *
 * This is only a first check. The database decides what each person may see
 * and change, and the app checks roles again in the browser.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Without configuration the app shows its own setup message.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // Stops caches from storing a response that carries someone's session.
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Checks the session's signature, refreshing it first if it has expired.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const { pathname, search } = request.nextUrl;
  const isPublic = pathname === "/login" || pathname.startsWith("/auth/");

  const redirect = (to: URL) => {
    const r = NextResponse.redirect(to);
    // Keep any refreshed session cookies.
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  // An email link that Supabase sent to the site's root (when /auth/callback isn't in
  // its list of allowed redirect addresses) still carries its one-time code: finish there.
  if (!signedIn && !isPublic && request.nextUrl.searchParams.has("code")) {
    return redirect(new URL(`/auth/callback${search}`, request.url));
  }

  if (!signedIn && !isPublic) {
    const to = new URL("/login", request.url);
    if (pathname !== "/") to.searchParams.set("next", pathname + search);
    return redirect(to);
  }
  if (signedIn && pathname === "/login") {
    return redirect(new URL("/", request.url));
  }
  return response;
}
