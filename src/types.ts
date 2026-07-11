// Core domain types for ClassTrack Layer 1.

export type AssignmentType = 'homework' | 'test' | 'project';

export const ASSIGNMENT_TYPES: AssignmentType[] = ['homework', 'test', 'project'];

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  homework: 'Homework',
  test: 'Test',
  project: 'Project',
};

export interface Subject {
  id: number;
  name: string;
  color: string;
  createdAt: number; // epoch ms
}

export interface Assignment {
  id: number;
  subjectId: number;
  title: string;
  type: AssignmentType;
  dueAt: number; // epoch ms, local due date & time
  notes: string;
  completed: boolean;
  notificationIds: string[]; // ids of scheduled local reminders
  createdAt: number; // epoch ms
}

/** Assignment joined with its subject's display fields (for Today / rows). */
export interface AssignmentWithSubject extends Assignment {
  subjectName: string;
  subjectColor: string;
}

/** Fields the user edits; everything else is managed by the DB layer. */
export interface AssignmentInput {
  subjectId: number;
  title: string;
  type: AssignmentType;
  dueAt: number;
  notes: string;
}
