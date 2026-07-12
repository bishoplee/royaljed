import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isTenantMatch } from '@/lib/tutorAccess';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schoolSlug } = await params;
    const slug = schoolSlug.toLowerCase().trim();

    if (
      !isTenantMatch({
        isSuperAdmin: session.user.role === 'SUPER_ADMIN',
        userSchoolSlug: session.user.schoolSlug,
        targetSchoolSlug: slug,
      })
    ) {
      return NextResponse.json({ error: 'Forbidden: Tenant mismatch' }, { status: 403 });
    }

    const school = await prisma.school.findUnique({ where: { slug } });
    if (!school) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // Determine target student: students can only download their own, tutors/admins can download anyone's
    const targetStudentId = req.nextUrl.searchParams.get('studentId') || session.user.id;

    if (session.user.role === 'STUDENT' && targetStudentId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const student = await prisma.user.findFirst({
      where: {
        id: targetStudentId,
        schoolId: school.id,
        role: 'STUDENT',
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Fetch student's grades and assignments
    const submissions = await prisma.submission.findMany({
      where: {
        studentId: targetStudentId,
        status: 'GRADED',
      },
      include: {
        assignment: true,
        grade: {
          include: {
            tutor: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    // Calculate overall average
    let overallAverage = 0;
    if (submissions.length > 0) {
      const sum = submissions.reduce((acc, sub) => acc + (sub.grade ? Number(sub.grade.percentage) : 0), 0);
      overallAverage = Number((sum / submissions.length).toFixed(1));
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Stream PDF data into a ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        doc.on('data', (chunk) => controller.enqueue(chunk));
        doc.on('end', () => controller.close());
        doc.on('error', (err) => controller.error(err));
      },
    });

    const primaryColor = school.brandColor || '#001E2B';
    const secondaryColor = '#00684A';
    const darkInk = '#001E2B';
    const mutedSlate = '#5C6F84';
    const lightBg = '#F9FBFA';

    // 1. Draw Title Header Banner
    doc.rect(50, 45, 495, 80).fill(primaryColor);
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('STUDENT PROGRESS REPORT', 70, 60);
    doc.fontSize(11).fillColor('#00ED64').font('Helvetica').text(school.name.toUpperCase(), 70, 95);

    // Reset standard coordinates
    doc.text('', 50, 150);

    // 2. Info Boxes
    doc.fontSize(10).fillColor(mutedSlate).font('Helvetica').text('STUDENT PROFILE', 50, 150);
    doc.fontSize(14).fillColor(darkInk).font('Helvetica-Bold').text(student.fullName, 50, 165);
    doc.fontSize(10).fillColor(mutedSlate).font('Helvetica').text(student.email, 50, 185);

    // Average Score Box (right aligned)
    doc.rect(385, 145, 160, 55).fill(lightBg);
    doc.strokeColor('#E8F8F0').rect(385, 145, 160, 55).stroke();
    doc.fontSize(8).fillColor(secondaryColor).font('Helvetica').text('OVERALL AVERAGE GRADE', 400, 155);
    doc.fontSize(22).fillColor(secondaryColor).font('Helvetica-Bold').text(`${overallAverage}%`, 400, 168);

    // Divider
    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, 220).lineTo(545, 220).stroke();

    // 3. Performance Summary Table
    doc.fontSize(12).fillColor(primaryColor).font('Helvetica-Bold').text('Assignment Speech Performance Summary', 50, 235);

    let currentY = 265;
    
    // Draw table headers
    doc.rect(50, currentY, 495, 20).fill(primaryColor);
    doc.fontSize(9).fillColor('#FFFFFF').font('Helvetica');
    doc.text('ASSIGNMENT', 60, currentY + 6);
    doc.text('SUBMISSION DATE', 250, currentY + 6);
    doc.text('SCORE', 470, currentY + 6);
    
    currentY += 20;

    if (submissions.length === 0) {
      doc.rect(50, currentY, 495, 30).fill(lightBg);
      doc.fontSize(10).fillColor(mutedSlate).font('Helvetica').text('No graded oral submissions found.', 60, currentY + 10);
      currentY += 30;
    } else {
      submissions.forEach((sub) => {
        const gradeVal = sub.grade ? Number(sub.grade.percentage) : 0;
        doc.fontSize(10).fillColor(darkInk).font('Helvetica');
        
        // Alternating row background
        doc.rect(50, currentY, 495, 22).fill(currentY % 44 === 0 ? '#FFFFFF' : lightBg);
        
        doc.text(sub.assignment.title.substring(0, 32), 60, currentY + 7);
        doc.fontSize(9).fillColor(mutedSlate).font('Helvetica').text(new Date(sub.submittedAt).toLocaleDateString(), 250, currentY + 7);
        
        doc.fontSize(10).fillColor(gradeVal >= 70 ? '#00684A' : '#D97706');
        doc.text(`${gradeVal}%`, 470, currentY + 7);
        
        currentY += 22;
      });
    }

    currentY += 20;

    // 4. Detailed Tutor Feedback Section
    doc.fontSize(12).fillColor(primaryColor).font('Helvetica-Bold').text('Detailed Tutor Feedback Comments', 50, currentY);
    currentY += 20;

    const printableSubmissionsWithFeedback = submissions.filter((sub) => sub.grade?.feedbackText);

    if (printableSubmissionsWithFeedback.length === 0) {
      doc.fontSize(10).fillColor(mutedSlate).font('Helvetica').text('No verbal feedback notes logged yet.', 50, currentY);
    } else {
      printableSubmissionsWithFeedback.forEach((sub) => {
        // Page break safety check
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        doc.fontSize(10).fillColor(darkInk).font('Helvetica-Bold').text(sub.assignment.title, 50, currentY);
        currentY += 14;
        
        doc.fontSize(9).fillColor(mutedSlate).font('Helvetica').text(`Graded by ${sub.grade?.tutor.fullName || 'Tutor'} on ${new Date(sub.grade!.gradedAt).toLocaleDateString()}`, 50, currentY);
        currentY += 12;

        doc.fontSize(10).fillColor(darkInk).font('Helvetica-Oblique').text(`"${sub.grade?.feedbackText}"`, 60, currentY);
        
        // Dynamic offset calculation for feedback text size
        const lines = Math.ceil((sub.grade?.feedbackText || '').length / 70);
        currentY += lines * 14 + 15;
      });
    }

    // 5. Page Number footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor(mutedSlate).font('Helvetica').text(`Page ${i + 1} of ${pageCount}`, 50, 780, { align: 'right' });
    }

    doc.end();

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="progress_report_${student.fullName.replace(/\s+/g, '_')}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating progress PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
