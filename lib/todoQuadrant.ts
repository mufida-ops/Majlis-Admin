import type { TodoQuadrant } from '@/types/db';

/** Display order for the Urgent/Important matrix — most pressing first. */
export const TODO_QUADRANTS: TodoQuadrant[] = ['urgent_important', 'urgent', 'important', 'neither'];

export const TODO_QUADRANT_LABEL: Record<TodoQuadrant, string> = {
  urgent_important: 'Urgent & Important',
  urgent: 'Urgent, Not Important',
  important: 'Important, Not Urgent',
  neither: 'Neither'
};
