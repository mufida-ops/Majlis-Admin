export type Owner = 'Mufida' | 'Victoria' | 'Both';

export type Project = {
  id: string;
  title: string;
  owner: Owner;
  status: 'Active' | 'Blocked' | 'Complete';
  progress: number;
  nextAction: string;
  tasks: ProjectTask[];
};

export type ProjectTask = {
  id: string;
  title: string;
  owner: Owner;
  start: string;
  end: string;
  status: 'Todo' | 'Doing' | 'Waiting' | 'Done';
  dependsOn?: string[];
};

export type Decision = {
  id: string;
  title: string;
  project: string;
  date: string;
  status: 'Waiting' | 'Agreed' | 'Discuss';
  owner?: Owner;
};

export type CrmAccount = {
  id: string;
  organisation: string;
  stage: 'Lead' | 'Contacted' | 'Meeting Booked' | 'Proposal Sent' | 'Negotiating' | 'Won' | 'Onboarding' | 'Active Partner' | 'Follow-up';
  owner: Owner;
  nextAction: string;
  nextActionDate?: string;
  lastContact: string;
  contact?: string;
};

export type DropItem = {
  id: string;
  text: string;
  createdBy: Exclude<Owner, 'Both'>;
  createdAt: string;
  urgent: boolean;
  status: 'Unprocessed' | 'Processed';
};
