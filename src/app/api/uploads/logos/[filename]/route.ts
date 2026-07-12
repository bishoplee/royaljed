import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    console.log('Serving logo file request:', filename);
    const safeFilename = path.basename(filename); // Prevent directory traversal
    
    // Read from the persistent storage logos directory
    const filePath = path.join(process.cwd(), 'storage', 'logos', safeFilename);
    console.log('Resolved path:', filePath);
    console.log('Exists:', fs.existsSync(filePath));

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Logo Not Found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    
    // Determine content type based on file extension
    const ext = path.extname(safeFilename).toLowerCase();
    let contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    } else if (ext === '.svg') {
      contentType = 'image/svg+xml';
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving logo:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
