import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, isValidSession } from './lib/auth';

export async function middleware(req: NextRequest) {
  if (await isValidSession(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|_next|sw.js|manifest.webmanifest|icon.svg|favicon.ico).*)'],
};
