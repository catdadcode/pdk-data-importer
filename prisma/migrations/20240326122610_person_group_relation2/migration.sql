/*
  Warnings:

  - You are about to drop the `_GroupMembership` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_GroupMembership" DROP CONSTRAINT "_GroupMembership_A_fkey";

-- DropForeignKey
ALTER TABLE "_GroupMembership" DROP CONSTRAINT "_GroupMembership_B_fkey";

-- DropIndex
DROP INDEX "GroupMembership_personId_groupId_key";

-- AlterTable
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("personId", "groupId");

-- DropTable
DROP TABLE "_GroupMembership";

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
