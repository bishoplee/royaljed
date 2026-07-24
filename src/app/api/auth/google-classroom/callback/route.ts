import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exchangeCodeForTokens } from '@/lib/googleClassroom';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state parameters' }, { status: 400 });
    }

    const schoolSlug = state.toLowerCase().trim();

    const school = await prisma.school.findUnique({
      where: { slug: schoolSlug },
    });

    if (!school) {
      return NextResponse.json({ error: 'School/Tenant not found' }, { status: 404 });
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      // NOTE: Google returns refresh token ONLY on the first consent.
      // If the user is reconnecting, they must revoke access first, or prompt=consent must be passed.
      // Our helper getGoogleAuthUrl passes prompt=consent to ensure refresh token is always returned.
      console.warn('Warning: Google did not return a refresh token.');
    }

    // Upsert school config with the refresh token
    await prisma.schoolConfig.upsert({
      where: { schoolId: school.id },
      update: {
        ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
      },
      create: {
        schoolId: school.id,
        googleRefreshToken: tokens.refresh_token || null,
        gclassSyncEnabled: false,
      },
    });

    // Create an audit log
    await logAudit({
      schoolId: school.id,
      action: 'GOOGLE_CLASSROOM_CONNECT',
      details: `Connected Google Classroom account. Refresh token saved.`,
    });

    // Redirect the user back to admin settings page
    const settingsUrl = new URL(`/ec/${school.slug}/admin/settings`, req.url);
    settingsUrl.searchParams.set('google_connected', 'true');
    return NextResponse.redirect(settingsUrl);
  } catch (error) {
    console.error('Error in Google Classroom OAuth callback:', error);
    return NextResponse.json({ error: 'Internal server error during Google link' }, { status: 500 });
  }
}
