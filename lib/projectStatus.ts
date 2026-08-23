import { theme } from '@/constants/theme';
import type { ProjectStatus } from '@/types/db';

// A project's row/card is tinted by how far along it is — red/amber/orange/green,
// a traffic-light reading of progress — not by who created it. Projects are
// joint work, not one founder's or the other's, so an owner tint here would
// be answering the wrong question. Blocked gets its own orange so it reads
// as distinct from Not Started at a glance, rather than sharing red.
export const PROJECT_STATUS_TINT: Record<ProjectStatus, string> = {
  'Not Started': theme.colors.statusRedPale,
  Active: theme.colors.statusAmberPale,
  Blocked: theme.colors.statusOrangePale,
  Complete: theme.colors.completedGreen
};
