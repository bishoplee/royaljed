import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { TMP_DIR } from '@/lib/storage';
import path from 'path';
import fs from 'fs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const formData = await req.formData();
    const uploadId = formData.get('uploadId') as string;
    const chunkIndexStr = formData.get('chunkIndex') as string;
    const chunkFile = formData.get('chunk') as File | null;

    if (!uploadId || !chunkIndexStr || !chunkFile) {
      return NextResponse.json({ error: 'Missing formData parameters' }, { status: 400 });
    }

    const chunkIndex = parseInt(chunkIndexStr, 10);
    const uploadPath = path.join(TMP_DIR, uploadId);

    // Verify upload folder exists
    if (!fs.existsSync(uploadPath)) {
      return NextResponse.json({ error: 'Upload session not initialized or expired' }, { status: 404 });
    }

    // Read chunk file buffer
    const arrayBuffer = await chunkFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write chunk file
    const chunkFilePath = path.join(uploadPath, `chunk_${chunkIndex}`);
    fs.writeFileSync(chunkFilePath, buffer);

    return NextResponse.json({ success: true, chunkIndex });
  } catch (error: any) {
    console.error('Error in upload-chunk API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
