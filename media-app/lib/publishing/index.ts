import type { PlatformName } from '@/types/db';
import type { PublishAdapter } from './types';
import { makeNotConnectedAdapter } from './notConnectedAdapter';

// Real adapters get dropped in here one at a time, in the order set by
// docs/social-api-requirements.md (Instagram -> LinkedIn -> TikTok), each
// replacing its stub without any other file changing:
//   import { instagramAdapter } from './instagram';
//   const adapters: Record<PlatformName, PublishAdapter> = { instagram: instagramAdapter, ... }
const adapters: Record<PlatformName, PublishAdapter> = {
  instagram: makeNotConnectedAdapter('instagram'),
  tiktok: makeNotConnectedAdapter('tiktok'),
  linkedin: makeNotConnectedAdapter('linkedin')
};

export function getAdapter(platform: PlatformName): PublishAdapter {
  return adapters[platform];
}

export * from './types';
