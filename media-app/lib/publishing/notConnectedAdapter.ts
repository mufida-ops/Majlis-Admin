import type { PlatformName } from '@/types/db';
import type { PublishAdapter, PublishInput, PublishResult } from './types';

/**
 * Stub adapter used for every platform until its real credentials/OAuth
 * flow are wired up (see docs/social-api-requirements.md). Never fakes a
 * success — always reports `not_connected` so the app can show "Not
 * Connected" and fall back to "Ready to Post Manually" (Section 25).
 */
export function makeNotConnectedAdapter(platform: PlatformName): PublishAdapter {
  return {
    platform,
    async isConnected() {
      return false;
    },
    async publish(_input: PublishInput): Promise<PublishResult> {
      return { status: 'not_connected', errorMessage: `${platform} is not connected yet.` };
    },
    async checkStatus(_externalRef: string): Promise<PublishResult> {
      return { status: 'not_connected' };
    }
  };
}
