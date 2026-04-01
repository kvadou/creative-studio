-- CreateEnum
CREATE TYPE "ScriptPersona" AS ENUM ('CONVERTED_PARENT', 'SKEPTICAL_PARENT', 'COMPARISON_PARENT');

-- CreateEnum
CREATE TYPE "ScriptFormat" AS ENUM ('HOOK_PROBLEM_PROOF_CTA', 'BEFORE_AFTER', 'STORY_ARC');

-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'SKIPPED', 'BRIEFED', 'FILMED', 'POSTED');

-- CreateEnum
CREATE TYPE "CreatorStatus" AS ENUM ('OUTREACH', 'ACTIVE', 'PAUSED', 'CHURNED');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('RECEIVED', 'APPROVED', 'REJECTED', 'POSTED', 'TRACKING');

-- CreateTable
CREATE TABLE "MarketingInsight" (
    "id" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "utmCampaign" TEXT,
    "spend" DOUBLE PRECISION NOT NULL,
    "leads" INTEGER NOT NULL,
    "registrations" INTEGER NOT NULL,
    "realizedRevenue" DOUBLE PRECISION NOT NULL,
    "roas" DOUBLE PRECISION NOT NULL,
    "cpl" DOUBLE PRECISION NOT NULL,
    "cpr" DOUBLE PRECISION NOT NULL,
    "hookTheme" TEXT NOT NULL,
    "audienceSignal" TEXT NOT NULL,
    "messagingAngle" TEXT NOT NULL,
    "proofPoints" TEXT[],
    "avoidPatterns" TEXT[],
    "insightScore" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MarketingInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingScript" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "insightId" TEXT,
    "persona" "ScriptPersona" NOT NULL,
    "format" "ScriptFormat" NOT NULL,
    "lineOfBusiness" TEXT NOT NULL DEFAULT 'tutoring',
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "hashtags" TEXT[],
    "textOverlaySuggestion" TEXT,
    "settingSuggestion" TEXT,
    "propsSuggestion" TEXT,
    "toneSuggestion" TEXT,
    "durationTarget" INTEGER NOT NULL,
    "status" "ScriptStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "approvedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "skippedReason" TEXT,

    CONSTRAINT "MarketingScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UGCCreator" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "tiktokHandle" TEXT NOT NULL,
    "email" TEXT,
    "paymentEmail" TEXT,
    "ratePerVideo" DOUBLE PRECISION NOT NULL DEFAULT 17.50,
    "promoCode" TEXT,
    "followerCount" INTEGER,
    "avgViewCount" INTEGER,
    "audienceType" TEXT,
    "hasKids" BOOLEAN NOT NULL DEFAULT true,
    "status" "CreatorStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,

    CONSTRAINT "UGCCreator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBrief" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scriptId" TEXT NOT NULL,
    "creatorId" TEXT,
    "briefHtml" TEXT NOT NULL,
    "canvaDesignUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "ContentBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UGCVideo" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "briefId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "tiktokUrl" TEXT,
    "s3Url" TEXT,
    "amountPaid" DOUBLE PRECISION,
    "paidAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "leadsAttributed" INTEGER NOT NULL DEFAULT 0,
    "performanceScore" DOUBLE PRECISION,
    "status" "VideoStatus" NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,

    CONSTRAINT "UGCVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingInsight_platform_idx" ON "MarketingInsight"("platform");

-- CreateIndex
CREATE INDEX "MarketingInsight_insightScore_idx" ON "MarketingInsight"("insightScore");

-- CreateIndex
CREATE INDEX "MarketingInsight_extractedAt_idx" ON "MarketingInsight"("extractedAt");

-- CreateIndex
CREATE INDEX "MarketingScript_status_idx" ON "MarketingScript"("status");

-- CreateIndex
CREATE INDEX "MarketingScript_persona_idx" ON "MarketingScript"("persona");

-- CreateIndex
CREATE INDEX "MarketingScript_createdAt_idx" ON "MarketingScript"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UGCCreator_tiktokHandle_key" ON "UGCCreator"("tiktokHandle");

-- CreateIndex
CREATE INDEX "UGCCreator_status_idx" ON "UGCCreator"("status");

-- CreateIndex
CREATE INDEX "ContentBrief_scriptId_idx" ON "ContentBrief"("scriptId");

-- CreateIndex
CREATE INDEX "ContentBrief_creatorId_idx" ON "ContentBrief"("creatorId");

-- CreateIndex
CREATE INDEX "UGCVideo_creatorId_idx" ON "UGCVideo"("creatorId");

-- CreateIndex
CREATE INDEX "UGCVideo_briefId_idx" ON "UGCVideo"("briefId");

-- CreateIndex
CREATE INDEX "UGCVideo_performanceScore_idx" ON "UGCVideo"("performanceScore");

-- AddForeignKey
ALTER TABLE "MarketingScript" ADD CONSTRAINT "MarketingScript_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "MarketingInsight"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBrief" ADD CONSTRAINT "ContentBrief_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "MarketingScript"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBrief" ADD CONSTRAINT "ContentBrief_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UGCCreator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UGCVideo" ADD CONSTRAINT "UGCVideo_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ContentBrief"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UGCVideo" ADD CONSTRAINT "UGCVideo_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UGCCreator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
