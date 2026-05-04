// ================================================================
//  CONTAFÁCIL SQ — Types
// ================================================================

export type Role = 'SUPERADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  universityId: string | null;
  avatarUrl: string | null;
}

export interface AuthResponse {
  access_token:       string;
  refresh_token?:     string; // Moved to httpOnly cookie — not in body anymore
  token_type:         string;
  expires_in:         number;
  mustChangePassword?: boolean;
  user: User;
}

export type ExerciseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
export type ExerciseDifficulty = 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
export type ExerciseType = 'FULL_CYCLE' | 'JOURNAL_ONLY' | 'INVOICING_ONLY' | 'INVENTORY_ONLY';

export interface Exercise {
  id: string;
  courseId: string;
  teacherId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  difficulty: ExerciseDifficulty;
  type: ExerciseType;
  maxScore: string;
  dueDate: string | null;
  isPublished: boolean;
  createdAt: string;
  course?: {
    id: string;
    name: string;
    period: string | null;
  };
  rubrics?: ExerciseRubric[];
}

export interface ExerciseRubric {
  id: string;
  criterion: string;
  description: string;
  expectedValue: string | null;
  points: string;
  order: number;
}

export interface StudentProgress {
  id: string;
  attemptId: string;
  progressPct: string;
  invoicesCount: number;
  entriesCount: number;
  clientsCount: number;
  productsCount: number;
  timeSpentMin: number;
  lastActivity: string | null;
}

export interface ExerciseAttempt {
  id: string;
  exerciseId: string;
  studentId: string;
  status: ExerciseStatus;
  score: string | null;
  maxScore: string;
  feedback: string | null;
  gradedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  exercise?: Exercise;
  studentProgress?: StudentProgress | null;
  company?: { id: string; name: string } | null;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  type: 'INFO' | 'WARNING' | 'EXERCISE_ASSIGNED' | 'EXERCISE_DUE' | 'GRADED' | 'SYSTEM';
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

export interface Course {
  id: string;
  universityId: string;
  teacherId: string;
  name: string;
  description: string | null;
  code: string | null;
  period: string | null;
  isActive: boolean;
  createdAt: string;
  teacher?: { id: string; name: string; email: string };
  _count?: { enrollments: number; exercises: number };
}

export interface University {
  id: string;
  name: string;
  shortName: string | null;
  country: string;
  isActive: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}
