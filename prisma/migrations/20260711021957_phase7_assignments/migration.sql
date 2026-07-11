/*
  Warnings:

  - A unique constraint covering the columns `[assignment_id,student_id,attempt_number]` on the table `submissions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "SubmissionStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "video_error" TEXT,
ADD COLUMN     "video_status" TEXT DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "original_file_name" TEXT,
ADD COLUMN     "text_content" TEXT,
ALTER COLUMN "file_path" DROP NOT NULL;

-- CreateTable
CREATE TABLE "assignment_classes" (
    "assignment_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,

    CONSTRAINT "assignment_classes_pkey" PRIMARY KEY ("assignment_id","class_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignment_id_student_id_attempt_number_key" ON "submissions"("assignment_id", "student_id", "attempt_number");

-- AddForeignKey
ALTER TABLE "assignment_classes" ADD CONSTRAINT "assignment_classes_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_classes" ADD CONSTRAINT "assignment_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
