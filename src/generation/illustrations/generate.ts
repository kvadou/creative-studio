import { getReplicateClient } from '../../lib/replicate.js';
import { config } from '../../lib/config.js';
import { prisma } from '../../lib/prisma.js';

export interface GenerationOptions {
  prompt?: string;
  loraScale?: number;
  guidanceScale?: number;
  numOutputs?: number;
}

// Default prompt matches the existing Acme Creative illustration style:
// simple cartoon, bold black outlines, flat colors, full body, transparent bg
const DEFAULT_PROMPT =
  'Acme CreativeSTYLE simple cartoon character illustration, bold black outlines, flat colors, ' +
  'full body standing pose, transparent background, simplified features, ' +
  'clean vector-style lines, friendly expression, no shading, no gradients, ' +
  'cartoon proportions, white background';

export async function startGeneration(
  illustrationId: string,
  sourcePhotoUrl: string,
  options: GenerationOptions = {}
): Promise<string> {
  const replicate = getReplicateClient();

  // Get the active style model
  const styleModel = await prisma.styleModel.findFirst({
    where: { isActive: true },
  });

  const modelVersion = styleModel?.modelVersion || config.fluxModelVersion;

  if (!modelVersion) {
    throw new Error('No trained style model available. Please train a model first.');
  }

  const prompt = options.prompt || DEFAULT_PROMPT;
  const loraScale = options.loraScale ?? 1.0;
  const guidanceScale = options.guidanceScale ?? 4.0;
  const numOutputs = options.numOutputs ?? 3;

  const prediction = await replicate.predictions.create({
    version: modelVersion,
    input: {
      image: sourcePhotoUrl,
      prompt,
      num_outputs: numOutputs,
      guidance_scale: guidanceScale,
      num_inference_steps: 30,
      lora_scale: loraScale,
    },
  });

  // Update illustration with prediction ID
  await prisma.illustration.update({
    where: { id: illustrationId },
    data: {
      status: 'GENERATING',
      replicateId: prediction.id,
    },
  });

  // Create generation record
  await prisma.illustrationGeneration.create({
    data: {
      illustrationId,
      replicateId: prediction.id,
      inputPhotoUrl: sourcePhotoUrl,
      prompt,
      modelVersion,
    },
  });

  return prediction.id;
}

export async function checkGeneration(predictionId: string): Promise<{
  status: string;
  outputUrls?: string[];
  error?: string;
}> {
  const replicate = getReplicateClient();
  const prediction = await replicate.predictions.get(predictionId);

  if (prediction.status === 'succeeded' && prediction.output) {
    const outputs = Array.isArray(prediction.output)
      ? prediction.output
      : [prediction.output];
    return {
      status: 'succeeded',
      outputUrls: outputs as string[],
    };
  }

  if (prediction.status === 'failed') {
    return {
      status: 'failed',
      error: prediction.error?.toString() || 'Generation failed',
    };
  }

  return { status: prediction.status };
}
