import { prisma } from '@/lib/prisma';

export interface AuditLogOptions {
  schoolId?: string | null;
  userId?: string | null;
  action: string;
  details?: string | null;
  ipAddress?: string | null;
}

/**
 * Safely records an audit log entry in PostgreSQL.
 * Validates userId foreign key and catches unexpected log errors to prevent blocking primary transactions.
 */
export async function logAudit(options: AuditLogOptions): Promise<void> {
  try {
    let validUserId: string | null = null;
    if (options.userId) {
      const existingUser = await prisma.user.findUnique({
        where: { id: options.userId },
        select: { id: true },
      });
      if (existingUser) {
        validUserId = existingUser.id;
      }
    }

    await prisma.auditLog.create({
      data: {
        schoolId: options.schoolId || null,
        userId: validUserId,
        action: options.action,
        details: options.details || null,
        ipAddress: options.ipAddress || null,
      },
    });
  } catch (err) {
    console.error('[AuditLog Warning] Could not record audit log:', err);
  }
}
