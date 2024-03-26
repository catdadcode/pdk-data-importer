-- CreateTable
CREATE TABLE "_GroupMembership" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_GroupMembership_AB_unique" ON "_GroupMembership"("A", "B");

-- CreateIndex
CREATE INDEX "_GroupMembership_B_index" ON "_GroupMembership"("B");

-- AddForeignKey
ALTER TABLE "_GroupMembership" ADD CONSTRAINT "_GroupMembership_A_fkey" FOREIGN KEY ("A") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GroupMembership" ADD CONSTRAINT "_GroupMembership_B_fkey" FOREIGN KEY ("B") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
