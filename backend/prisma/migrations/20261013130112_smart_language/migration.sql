-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "languageMode" TEXT NOT NULL DEFAULT 'fixed';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "language" TEXT;
