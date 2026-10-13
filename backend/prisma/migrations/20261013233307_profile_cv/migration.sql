-- AlterTable
ALTER TABLE "User" ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "currentRole" TEXT,
ADD COLUMN     "cvExtract" JSONB,
ADD COLUMN     "cvFileName" TEXT,
ADD COLUMN     "cvProfile" TEXT,
ADD COLUMN     "cvStatus" TEXT,
ADD COLUMN     "cvText" TEXT,
ADD COLUMN     "cvUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "education" JSONB,
ADD COLUMN     "experience" JSONB,
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "projects" JSONB,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
