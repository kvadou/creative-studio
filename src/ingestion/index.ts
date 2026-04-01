import { readdirSync, statSync } from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { parseLesson, parseModuleCode, isLessonFile, detectMnemonics } from './parser.js';
import { chunkLesson, createMnemonicChunk } from './chunker.js';
import { embedChunks, type EmbeddingJob } from './embedder.js';
import type { IngestionResult } from '../types/index.js';
import { CANONICAL_CHARACTERS, CANONICAL_MNEMONICS } from '../types/index.js';

interface ModuleInfo {
  code: string;
  title: string;
  ageGroup: string | null;
  term: string | null;
  sequence: number;
  dirPath: string;
}

function getModuleSequence(code: string): number {
  // Extract numeric part and convert to sequence
  const match = code.match(/^(\d+)([AB])?/i);
  if (!match) return 999;

  const num = parseInt(match[1], 10) * 10;
  const suffix = match[2]?.toUpperCase();

  if (suffix === 'A') return num;
  if (suffix === 'B') return num + 5;
  return num;
}

// US Curriculum 2026 module titles
const MODULE_TITLES: Record<string, string> = {
  '1': 'Piece and Game Mechanics',
  '1B': 'Piece and Game Mechanics Review',
  '2': 'Module 2',
  '2B': 'Module 2B',
  '3': 'Module 3',
  '4': 'Module 4',
  '4B': 'Module 4B',
  '5': 'Module 5',
  '6': 'Module 6',
};

function parseModuleInfo(dirPath: string): ModuleInfo {
  const code = parseModuleCode(dirPath);

  return {
    code,
    title: MODULE_TITLES[code] || `Module ${code}`,
    ageGroup: null,
    term: null,
    sequence: getModuleSequence(code),
    dirPath,
  };
}

async function seedCanonicalData(): Promise<void> {
  console.log('Seeding canonical characters...');
  for (const char of CANONICAL_CHARACTERS) {
    await prisma.character.upsert({
      where: { name: char.name },
      update: char,
      create: char,
    });
  }

  console.log('Seeding canonical mnemonics...');
  for (const mnem of CANONICAL_MNEMONICS) {
    await prisma.mnemonic.upsert({
      where: { phrase: mnem.phrase },
      update: mnem,
      create: mnem,
    });
  }
}

// US Curriculum 2026 — expected lesson counts and titles for Coming Soon placeholders
const COMING_SOON_LESSONS: Record<string, Record<number, string>> = {
  '1B': {
    3: 'Lights Out at the Circus',
    4: 'The Jumping Contest',
    5: "Chef Squishyfeet's Grocery Run",
  },
  '2B': {
    7: "Earl's ABC's",
    8: "Earl's ABC's",
    9: "Earl's ABC's",
  },
  '5': {
    1: 'The Lone King | Setting Up a Checkmate',
    4: "Allegra's Architect Adventure Part 3 | Ladder Mate",
  },
};

const EXPECTED_LESSON_COUNTS: Record<string, number> = {
  '1': 10, '1B': 10, '2': 10, '2B': 10, '3': 10,
  '4': 11, '4B': 10, '5': 10, '6': 11,
};

async function fillComingSoonLessons(): Promise<void> {
  console.log('\nFilling Coming Soon placeholders...');

  for (const [moduleCode, expectedCount] of Object.entries(EXPECTED_LESSON_COUNTS)) {
    const dbModule = await prisma.module.findUnique({ where: { code: moduleCode } });
    if (!dbModule) continue;

    const existingLessons = await prisma.lesson.findMany({
      where: { moduleId: dbModule.id },
      select: { lessonNumber: true },
    });
    const existingNumbers = new Set(existingLessons.map(l => l.lessonNumber));

    for (let n = 1; n <= expectedCount; n++) {
      if (existingNumbers.has(n)) continue;

      const comingSoonTitle = COMING_SOON_LESSONS[moduleCode]?.[n] || 'Coming Soon';
      const filePath = `coming-soon/module-${moduleCode.toLowerCase()}/lesson-${n}.md`;

      await prisma.lesson.create({
        data: {
          moduleId: dbModule.id,
          lessonNumber: n,
          title: comingSoonTitle,
          filePath,
          rawContent: '# Coming Soon\n\nThis lesson is currently being developed.',
        },
      });

      console.log(`  ✓ Module ${moduleCode}, Lesson ${n}: ${comingSoonTitle} (placeholder)`);
    }
  }
}

export async function ingestCurriculum(curriculumDir: string): Promise<IngestionResult> {
  const startTime = Date.now();
  const errors: Array<{ file: string; error: string }> = [];
  let filesProcessed = 0;
  let chunksCreated = 0;
  const embeddingJobs: EmbeddingJob[] = [];

  console.log(`Starting ingestion from: ${curriculumDir}`);

  // Seed canonical data first
  await seedCanonicalData();

  // Find all module directories
  const entries = readdirSync(curriculumDir);
  const moduleDirs = entries
    .map((entry) => path.join(curriculumDir, entry))
    .filter((p) => statSync(p).isDirectory() && !path.basename(p).startsWith('.'));

  console.log(`Found ${moduleDirs.length} module directories`);

  // Process each module
  for (const moduleDir of moduleDirs) {
    const moduleInfo = parseModuleInfo(moduleDir);
    console.log(`\nProcessing module: ${moduleInfo.code} (${moduleInfo.title})`);

    // Create or update module
    const dbModule = await prisma.module.upsert({
      where: { code: moduleInfo.code },
      update: {
        title: moduleInfo.title,
        ageGroup: moduleInfo.ageGroup,
        term: moduleInfo.term,
        sequence: moduleInfo.sequence,
      },
      create: {
        code: moduleInfo.code,
        title: moduleInfo.title,
        ageGroup: moduleInfo.ageGroup,
        term: moduleInfo.term,
        sequence: moduleInfo.sequence,
      },
    });

    // Find lesson files
    const lessonFiles = readdirSync(moduleDir).filter(isLessonFile);
    console.log(`  Found ${lessonFiles.length} lesson files`);

    for (const lessonFile of lessonFiles) {
      const filePath = path.join(moduleDir, lessonFile);

      try {
        // Parse the lesson
        const parsed = parseLesson(filePath);

        // Create or update lesson
        const dbLesson = await prisma.lesson.upsert({
          where: { filePath },
          update: {
            moduleId: dbModule.id,
            lessonNumber: parsed.lessonNumber,
            title: parsed.title,
            chessConceptKey: parsed.chessConceptKey,
            rawContent: parsed.rawContent,
          },
          create: {
            moduleId: dbModule.id,
            lessonNumber: parsed.lessonNumber,
            title: parsed.title,
            chessConceptKey: parsed.chessConceptKey,
            filePath,
            rawContent: parsed.rawContent,
          },
        });

        // Delete existing chunks for this lesson (for re-ingestion)
        await prisma.chunk.deleteMany({ where: { lessonId: dbLesson.id } });

        // Create chunks
        const chunks = chunkLesson(parsed.sections);

        // Also create mnemonic-specific chunks
        const detectedMnemonics = detectMnemonics(parsed.rawContent);
        let mnemonicSeq = chunks.length;
        for (const mnem of detectedMnemonics) {
          const mnemonicChunk = createMnemonicChunk(parsed.rawContent, mnem, mnemonicSeq++);
          if (mnemonicChunk) {
            chunks.push(mnemonicChunk);
          }
        }

        // Insert chunks
        for (const chunk of chunks) {
          const dbChunk = await prisma.chunk.create({
            data: {
              lessonId: dbLesson.id,
              chunkType: chunk.chunkType,
              sectionTitle: chunk.sectionTitle,
              content: chunk.content,
              contentHash: chunk.contentHash,
              tokenCount: chunk.tokenCount,
              sequence: chunk.sequence,
            },
          });

          embeddingJobs.push({
            chunkId: dbChunk.id,
            content: chunk.content,
          });

          chunksCreated++;
        }

        filesProcessed++;
        console.log(`    ✓ ${lessonFile}: ${chunks.length} chunks`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`    ✗ ${lessonFile}: ${errMsg}`);
        errors.push({ file: filePath, error: errMsg });
      }
    }
  }

  // Fill Coming Soon placeholders for missing lessons
  await fillComingSoonLessons();

  // Generate embeddings
  console.log(`\nGenerating embeddings for ${embeddingJobs.length} chunks...`);
  const embeddingsCreated = await embedChunks(embeddingJobs);

  const duration = Date.now() - startTime;

  // Log ingestion run
  await prisma.ingestionRun.create({
    data: {
      filesProcessed,
      chunksCreated,
      embeddingsCreated,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    },
  });

  console.log(`\nIngestion complete!`);
  console.log(`  Files: ${filesProcessed}`);
  console.log(`  Chunks: ${chunksCreated}`);
  console.log(`  Embeddings: ${embeddingsCreated}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);

  return {
    filesProcessed,
    chunksCreated,
    embeddingsCreated,
    errors,
    duration,
  };
}
