-- Swap embedding dimensions from 1536 (OpenAI) to 768 (Gemini Embedding 2)
-- Step 1: Drop the old embeddings (incompatible with new dimensions)
UPDATE "Chunk" SET embedding = NULL;

-- Step 2: Alter the column from vector(1536) to vector(768)
ALTER TABLE "Chunk" ALTER COLUMN embedding TYPE vector(768);
