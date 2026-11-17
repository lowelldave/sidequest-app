import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Every page, but not Next's own files, images or the favicon/logo files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\.(?:png|jpg|jpeg|svg|webp|gif)$).*)"],
};
