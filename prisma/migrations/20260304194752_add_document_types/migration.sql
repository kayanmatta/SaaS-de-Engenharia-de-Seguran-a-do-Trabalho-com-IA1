/*
  Warnings:

  - The values [OUTRO] on the enum `DocumentType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DocumentType_new" AS ENUM ('PGR', 'PCMSO', 'LAUDO_INSALUBRIDADE', 'LAUDO_PERICULOSIDADE', 'ASO', 'CLCB', 'RELATORIO_TECNICO', 'TLCAT');
ALTER TABLE "Document" ALTER COLUMN "type" TYPE "DocumentType_new" USING ("type"::text::"DocumentType_new");
ALTER TYPE "DocumentType" RENAME TO "DocumentType_old";
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";
DROP TYPE "public"."DocumentType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "fileName" TEXT;
