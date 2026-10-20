import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSession(request);
}

// Arquivos públicos (ícones, manifestos, service workers) não passam pelo login.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|ico|webmanifest|js|css|txt)$).*)"],
};
