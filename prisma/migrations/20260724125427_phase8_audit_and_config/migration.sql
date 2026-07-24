-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "google_course_work_id" TEXT;

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "google_course_id" TEXT;

-- AlterTable
ALTER TABLE "school_configs" ADD COLUMN     "google_refresh_token" TEXT;
