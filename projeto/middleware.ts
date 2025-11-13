import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refreshing the auth session ensures the session is always up-to-date
  // and valid. It also sets the session cookies for the client.
  await supabase.auth.getSession();
  console.log('Middleware: Session refreshed by createMiddlewareClient');

  const { data: { session } } = await supabase.auth.getSession();
  console.log('Middleware: Current session:', session);

  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');
  const isLoginPage = req.nextUrl.pathname === '/login';

  // Se o usuário tenta acessar uma rota /admin (e não é a página de login) e NÃO está autenticado
  if (isAdminRoute && !isLoginPage && !session) {
    console.log('Middleware: Não autenticado para rota admin, redirecionando para /login');
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Se o usuário já está logado e tenta acessar /login
  if (isLoginPage && session) {
    console.log('Middleware: Autenticado e na página de login, redirecionando para /admin');
    const adminUrl = new URL('/admin', req.url);
    return NextResponse.redirect(adminUrl);
  }

  console.log('Middleware: Prosseguindo com a requisição.');
  return res;
}

// Especifica quais caminhos o middleware deve ser executado
export const config = {
  matcher: ['/admin/:path*', '/login', '/reset-password'],
};
