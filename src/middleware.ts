import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;
  
  // Reconstruct host and protocol using forwarded headers if present (behind reverse proxies like Railway)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const proto = req.headers.get('x-forwarded-proto') || (isLocal ? 'http' : 'https');
  const publicRequestUrl = `${proto}://${host}${pathname}${req.nextUrl.search}`;

  // Helper to extract base domain dynamically in production
  const getBaseDomain = (currentHost: string): string => {
    const parts = currentHost.split('.');
    if (parts.length >= 3) {
      return parts.slice(1).join('.');
    }
    return currentHost;
  };

  // A. Redirect visible '/ec/...' paths to clean URLs to ensure they are never exposed in address bar
  if (pathname.startsWith('/ec/')) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const slug = segments[1].toLowerCase();
      const rest = '/' + segments.slice(2).join('/');
      if (isLocal) {
        return NextResponse.redirect(new URL(`/${slug}${rest}`, publicRequestUrl));
      } else {
        // Redirect to subdomain in production dynamically
        return NextResponse.redirect(new URL(`https://${slug}.${getBaseDomain(host)}${rest}`, publicRequestUrl));
      }
    }
  }

  let schoolSlug: string | null = null;
  let schoolPathPrefix = '';

  // B. Detect school slug (tenant context)
  if (!isLocal) {
    // Production: subdomain-based routing (e.g., royaljed-demo.royaljed.com)
    const parts = host.split('.');
    if (parts.length >= 3 && parts[0] !== 'www') {
      schoolSlug = parts[0].toLowerCase();
    }
  }

  // If no subdomain slug detected (or running locally), check for path-based prefix in development
  const reservedPaths = [
    'auth',
    'api',
    'super-admin',
    '_next',
    'favicon.ico',
    'static',
    'images',
    'fonts',
  ];
  const pathSegments = pathname.split('/').filter(Boolean);

  if (!schoolSlug && pathSegments.length > 0) {
    const firstSegment = pathSegments[0].toLowerCase();
    if (!reservedPaths.includes(firstSegment)) {
      schoolSlug = firstSegment;
      schoolPathPrefix = `/${pathSegments[0]}`;
    }
  }

  // Extract the relative path within the tenant space
  const tenantRelativePath = schoolPathPrefix
    ? pathname.substring(schoolPathPrefix.length) || '/'
    : pathname;

  // C. Handle routing logic for identified school tenant
  if (schoolSlug) {
    // 1. If NOT authenticated
    if (!token) {
      // Let authentication pages pass through to be served
      if (tenantRelativePath.startsWith('/auth/signin') || tenantRelativePath.startsWith('/auth/signup')) {
        return NextResponse.next();
      }

      // Redirect to global signin page pre-populated with school parameter
      const signInUrl = new URL('/auth/signin', publicRequestUrl);
      signInUrl.searchParams.set('school', schoolSlug);
      signInUrl.searchParams.set('callbackUrl', publicRequestUrl);
      return NextResponse.redirect(signInUrl);
    }

    // 2. If authenticated
    const userRole = token.role;

    // Check for tenant mismatch (except for SUPER_ADMIN bypass)
    if (userRole !== 'SUPER_ADMIN' && token.schoolSlug !== schoolSlug) {
      const mySlug = token.schoolSlug || 'default';
      const myRole = userRole.toLowerCase();
      if (isLocal) {
        return NextResponse.redirect(new URL(`/${mySlug}/${myRole}/dashboard`, publicRequestUrl));
      } else {
        return NextResponse.redirect(new URL(`https://${mySlug}.${getBaseDomain(host)}/${myRole}/dashboard`, publicRequestUrl));
      }
    }

    // If requesting the root of tenant space, redirect to their role-specific dashboard
    if (tenantRelativePath === '/') {
      const rolePath = userRole === 'SUPER_ADMIN' ? 'admin' : userRole.toLowerCase();
      if (isLocal) {
        return NextResponse.redirect(new URL(`/${schoolSlug}/${rolePath}/dashboard`, publicRequestUrl));
      } else {
        return NextResponse.redirect(new URL(`https://${schoolSlug}.${getBaseDomain(host)}/${rolePath}/dashboard`, publicRequestUrl));
      }
    }

    // Role-based directory checks
    if (tenantRelativePath.startsWith('/admin')) {
      if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        const homeUrl = isLocal ? `/${schoolSlug}` : `https://${schoolSlug}.${getBaseDomain(host)}`;
        return NextResponse.redirect(new URL(homeUrl, publicRequestUrl));
      }
    }

    if (tenantRelativePath.startsWith('/tutor')) {
      if (userRole !== 'TUTOR' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        const homeUrl = isLocal ? `/${schoolSlug}` : `https://${schoolSlug}.${getBaseDomain(host)}`;
        return NextResponse.redirect(new URL(homeUrl, publicRequestUrl));
      }
    }

    if (tenantRelativePath.startsWith('/student')) {
      if (!['STUDENT', 'TUTOR', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
        const homeUrl = isLocal ? `/${schoolSlug}` : `https://${schoolSlug}.${getBaseDomain(host)}`;
        return NextResponse.redirect(new URL(homeUrl, publicRequestUrl));
      }
    }

    // Rewrite internally to the real App Router dynamic path under /ec/[schoolSlug]
    return NextResponse.rewrite(
      new URL(`/ec/${schoolSlug}${tenantRelativePath}`, req.url)
    );
  }

  // D. Main Domain (root domain royaljed.com or localhost:3000 root)
  const isAuthPage = pathname.startsWith('/auth/signin') || pathname.startsWith('/auth/signup');

  if (token) {
    // If logged in and visiting main domain root or auth pages, redirect to dashboard
    if (isAuthPage || pathname === '/') {
      const userRole = token.role;
      if (userRole === 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL('/super-admin/dashboard', publicRequestUrl));
      }
      
      const mySlug = token.schoolSlug || 'default';
      const myRole = userRole.toLowerCase();
      
      if (isLocal) {
        return NextResponse.redirect(new URL(`/${mySlug}/${myRole}/dashboard`, publicRequestUrl));
      } else {
        return NextResponse.redirect(new URL(`https://${mySlug}.${getBaseDomain(host)}/${myRole}/dashboard`, publicRequestUrl));
      }
    }
  }

  // Super admin guards on root domain
  if (pathname.startsWith('/super-admin')) {
    if (!token || token.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/auth/signin', publicRequestUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * 1. /api routes (let API handle its own authentication checks)
     * 2. /_next (Next.js internals)
     * 3. /static (inside public directory)
     * 4. standard root files (e.g. favicon.ico, sitemap.xml, robots.txt, logo.png)
     */
    '/((?!api|_next|static|favicon.ico|[\\w-]+\\.\\w+).*)',
  ],
};
