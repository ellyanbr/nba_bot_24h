import { NextResponse, type NextRequest } from "next/server";

/**
 * Proteção opcional por senha (HTTP Basic Auth) para todas as páginas e ações.
 * Ativada quando APP_BASIC_AUTH_USER e APP_BASIC_AUTH_PASSWORD estão definidas.
 *
 * Não substitui um sistema de login com usuários. Fora da sua máquina, use somente
 * atrás de HTTPS: no Basic Auth a senha trafega apenas codificada (base64), não criptografada.
 */
function safeEqual(a: string, b: string) {
  // Comparação em tempo constante (evita descobrir a senha medindo o tempo de resposta).
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const user = process.env.APP_BASIC_AUTH_USER;
  const pass = process.env.APP_BASIC_AUTH_PASSWORD;
  if (!user || !pass) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      if (sep >= 0 && safeEqual(decoded.slice(0, sep), user) && safeEqual(decoded.slice(sep + 1), pass)) {
        return NextResponse.next();
      }
    } catch {
      // cabeçalho malformado → nega
    }
  }
  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="FIGHT IQ", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
