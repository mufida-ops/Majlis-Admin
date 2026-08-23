import type { PlatformName, PlatformPost } from '@/types/db';

export interface PublishInput {
  post: PlatformPost;
  mediaUrls: string[]; // signed URLs, in carousel order
  coverUrl: string | null;
}

export type PublishResultStatus = 'published' | 'processing' | 'failed' | 'not_connected';

export interface PublishResult {
  status: PublishResultStatus;
  liveUrl?: string;
  errorMessage?: string;
  /** Opaque platform reference (e.g. Instagram container id) used by checkStatus for async platforms. */
  externalRef?: string;
}

/**
 * One adapter per platform (Section 22: publishToInstagram / publishToTikTok
 * / publishToLinkedIn). Each operates completely independently — the
 * dispatcher never lets one platform's failure touch another's state.
 * Every real implementation must keep API secrets server-side only (this
 * module runs inside the Edge Function, never in the Expo client).
 */
export interface PublishAdapter {
  platform: PlatformName;
  isConnected(): Promise<boolean>;
  publish(input: PublishInput): Promise<PublishResult>;
  checkStatus(externalRef: string): Promise<PublishResult>;
}
