import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Páginas abertas a quem não entrou. Cada app tem a sua tela de entrada.
const ENTRADAS: Record<string, string> = { "/entregador/entrar": "/entregador", "/membro/entrar": "/membro", "/login": "/" };
const LIVRES = ["/auth/", "/sem-acesso"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const rota = request.nextUrl.pathname;
  const destinoSeLogado = ENTRADAS[rota.replace(/\/$/, "")];
  const livre = destinoSeLogado !== undefined || LIVRES.some((p) => rota.startsWith(p));

  if (!data.user && !livre) {
    const url = request.nextUrl.clone();
    url.pathname = rota.startsWith("/entregador") ? "/entregador/entrar" : rota.startsWith("/membro") ? "/membro/entrar" : "/login";
    return NextResponse.redirect(url);
  }
  if (data.user && destinoSeLogado !== undefined) {
    const url = request.nextUrl.clone();
    url.pathname = destinoSeLogado;
    return NextResponse.redirect(url);
  }
  return response;
}
