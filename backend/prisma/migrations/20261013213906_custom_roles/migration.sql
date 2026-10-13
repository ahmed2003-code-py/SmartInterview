-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_roleId_fkey";

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "roleTitle" TEXT,
ADD COLUMN     "specialization" TEXT,
ALTER COLUMN "roleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "domain" TEXT NOT NULL DEFAULT 'education';

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
