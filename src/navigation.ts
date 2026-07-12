// Navigation param lists + typed screen-prop helpers.

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { AssignmentType } from './types';

/** Prefilled values handed from Quick Add's "All details" to the full editor. */
export interface AssignmentDraft {
  title: string;
  subjectId: number | null;
  type: AssignmentType;
  dueAt: number;
}

export type TabParamList = {
  Today: undefined;
  Subjects: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  SubjectDetail: { subjectId: number };
  /** Omit assignmentId to create; pass subjectId to preselect the subject. */
  AssignmentEdit:
    | { assignmentId?: number; subjectId?: number; draft?: AssignmentDraft }
    | undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
