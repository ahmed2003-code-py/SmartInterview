-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" BYTEA,
ADD COLUMN     "avatarType" TEXT,
ADD COLUMN     "avatarUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "headline" TEXT,
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "specialization" TEXT,
ADD COLUMN     "targetRole" TEXT;
