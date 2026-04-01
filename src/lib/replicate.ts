import Replicate from 'replicate';
import { config } from './config.js';

export const replicate = config.replicateApiToken
  ? new Replicate({ auth: config.replicateApiToken })
  : null;

export function getReplicateClient(): Replicate {
  if (!replicate) {
    throw new Error('Replicate API token not configured. Set REPLICATE_API_TOKEN env var.');
  }
  return replicate;
}
