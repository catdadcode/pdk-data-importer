/*
  Warnings:

  - You are about to alter the column `first` on the `Person` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `last` on the `Person` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `email` on the `Person` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - Added the required column `type` to the `Credential` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Credential" ADD COLUMN     "type" "CredentialType" NOT NULL,
ADD COLUMN     "value" TEXT;

-- AlterTable
ALTER TABLE "Person" ALTER COLUMN "first" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "last" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "enabled" SET DEFAULT true,
ALTER COLUMN "activeDate" DROP NOT NULL,
ALTER COLUMN "expireDate" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "pin" DROP NOT NULL,
ALTER COLUMN "pinDuress" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DisposableDomain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,

    CONSTRAINT "DisposableDomain_pkey" PRIMARY KEY ("id")
);
