// Majlis Media Studio visual direction (Section 32): warm, creative,
// premium-but-approachable — cream backgrounds, navy + muted gold accents,
// neutral greys. Deliberately NOT a dark-navy corporate dashboard; media
// thumbnails supply the visual energy, not chrome.
export const colors = {
  background: '#FBF7EF', // warm cream
  surface: '#FFFFFF',
  surfaceMuted: '#F4EEE0',
  border: '#E9E1CE',
  navy: '#1F2937',
  navySoft: '#33415C',
  gold: '#C69A45',
  goldSoft: '#EFDFB8',
  textPrimary: '#241F16',
  textSecondary: '#6B6455',
  textInverse: '#FBF7EF',
  success: '#3F7D58',
  warning: '#B9762F',
  danger: '#B4483A',
  info: '#3E6FA6',

  // status pills
  stageIdea: '#8E7CC3',
  stageScript: '#3E6FA6',
  stageToFilm: '#B9762F',
  stageEditing: '#C69A45',
  stageApproval: '#B4483A',
  stageApproved: '#3F7D58',
  stageScheduled: '#2E7D8C',
  stagePublished: '#1F2937',

  priorityLow: '#8A8474',
  priorityNormal: '#3E6FA6',
  priorityHigh: '#B9762F',
  priorityUrgent: '#B4483A',

  instagram: '#C1447E',
  tiktok: '#1F2937',
  linkedin: '#2E6CA4'
};

export const radii = { sm: 8, md: 14, lg: 20, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const shadow = {
  card: {
    shadowColor: '#241F16',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  }
};

export const typography = {
  h1: { fontSize: 26, fontWeight: '700' as const, color: colors.textPrimary },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.textPrimary },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.textPrimary },
  caption: { fontSize: 13, fontWeight: '400' as const, color: colors.textSecondary },
  small: { fontSize: 11, fontWeight: '600' as const, color: colors.textSecondary }
};
