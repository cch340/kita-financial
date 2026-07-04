import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login')
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone(); url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone(); url.pathname = '/'
    return NextResponse.redirect(url)
  }
  return response
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|.*\\.png$).*)'] }
