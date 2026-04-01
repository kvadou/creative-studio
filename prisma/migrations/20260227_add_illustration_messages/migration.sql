-- CreateTable
CREATE TABLE "IllustrationMessage" (
    "id" TEXT NOT NULL,
    "illustrationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IllustrationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IllustrationMessage_illustrationId_idx" ON "IllustrationMessage"("illustrationId");

-- AddForeignKey
ALTER TABLE "IllustrationMessage" ADD CONSTRAINT "IllustrationMessage_illustrationId_fkey" FOREIGN KEY ("illustrationId") REFERENCES "Illustration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
