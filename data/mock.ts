import { CrmAccount, Decision, Project, DropItem } from '@/types';

export const projects: Project[] = [
  {
    id: 'school-offer',
    title: 'School Offer',
    owner: 'Both',
    status: 'Active',
    progress: 68,
    nextAction: 'Lock Phase 2 structure',
    tasks: [
      { id: 'p2', title: 'Phase 2 structure', owner: 'Both', start: '2026-08-20', end: '2026-08-23', status: 'Doing' },
      { id: 'pricing', title: 'Pricing', owner: 'Mufida', start: '2026-08-24', end: '2026-08-27', status: 'Todo', dependsOn: ['p2'] },
      { id: 'sales', title: 'Sales materials', owner: 'Victoria', start: '2026-08-28', end: '2026-09-02', status: 'Todo', dependsOn: ['pricing'] }
    ]
  },
  {
    id: 'website',
    title: 'Website',
    owner: 'Victoria',
    status: 'Blocked',
    progress: 42,
    nextAction: 'Agree resource architecture',
    tasks: [
      { id: 'structure', title: 'Information architecture', owner: 'Victoria', start: '2026-08-20', end: '2026-08-25', status: 'Doing' },
      { id: 'design', title: 'Design', owner: 'Both', start: '2026-08-26', end: '2026-09-02', status: 'Todo', dependsOn: ['structure'] }
    ]
  },
  {
    id: 'magrudys',
    title: 'Magrudy’s Partnership',
    owner: 'Mufida',
    status: 'Active',
    progress: 30,
    nextAction: 'Clarify stock / distribution model',
    tasks: [
      { id: 'terms', title: 'Clarify commercial terms', owner: 'Mufida', start: '2026-08-20', end: '2026-08-22', status: 'Doing' },
      { id: 'agreement', title: 'Agree model', owner: 'Both', start: '2026-08-23', end: '2026-08-27', status: 'Todo', dependsOn: ['terms'] }
    ]
  }
];

export const decisions: Decision[] = [
  { id: 'd1', title: 'Should Phase 2 include the cultural box before CPD?', project: 'School Offer', date: '20 Aug', status: 'Waiting', owner: 'Mufida' },
  { id: 'd2', title: 'Characters appear throughout the website without a corporate layout.', project: 'Website', date: '19 Aug', status: 'Agreed', owner: 'Both' }
];

export const crmAccounts: CrmAccount[] = [
  { id: 'c1', organisation: 'Magrudy’s', stage: 'Negotiating', owner: 'Mufida', nextAction: 'Clarify stock / distribution model', nextActionDate: '2026-08-21', lastContact: 'Yesterday', contact: 'Richard' },
  { id: 'c2', organisation: 'Regent International School', stage: 'Active Partner', owner: 'Victoria', nextAction: 'Review delivery and resource access', nextActionDate: '2026-08-24', lastContact: '3 days ago' },
  { id: 'c3', organisation: 'Sunmarke', stage: 'Follow-up', owner: 'Both', nextAction: 'Identify next cohort opportunity', lastContact: '2 weeks ago' }
];

export const drops: DropItem[] = [
  { id: 'drop1', text: 'We should review the Phase 2 cultural box placement.', createdBy: 'Mufida', createdAt: '22:41', urgent: false, status: 'Unprocessed' },
  { id: 'drop2', text: 'Website resource groupings updated — needs review.', createdBy: 'Victoria', createdAt: '18:12', urgent: false, status: 'Unprocessed' }
];
