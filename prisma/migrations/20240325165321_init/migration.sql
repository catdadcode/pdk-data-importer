-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('BLUETOOTH', 'CARD', 'MOBILE');

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "first" TEXT NOT NULL,
    "last" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "activeDate" TIMESTAMP(3) NOT NULL,
    "expireDate" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "pin" BIGINT NOT NULL,
    "pinDuress" BIGINT NOT NULL,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "personId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_personId_groupId_key" ON "GroupMembership"("personId", "groupId");

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
