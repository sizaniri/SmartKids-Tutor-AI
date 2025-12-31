
export enum Language {
  ARABIC = 'ar',
  ENGLISH = 'en',
  FRENCH = 'fr',
}

export enum UserRole {
  KID = 'kid',
  PARENT = 'parent',
}

export type VoicePreference = 'male' | 'female';
export type LearningPace = 'slow' | 'normal' | 'fast';
export type StudyTimePreference = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ExerciseType = 'multiple_choice' | 'dialogue' | 'sentence_correction' | 'general';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  age?: number;
  gradeLevel?: string;
  avatar: string; // Emoji or URL
  preferredVoice?: VoicePreference;
  learningPace?: LearningPace;
  favoriteSubject?: string;
  studyTimePreference?: StudyTimePreference;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isError?: boolean;
}

export interface Subject {
  id: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  icon: string; // Emoji
  color: string;
  descriptionAr: string;
  descriptionEn: string;
  descriptionFr: string;
}

export interface ResourceLink {
  title: string;
  url: string;
  source: string; // e.g., "Khan Academy", "YouTube"
}

export interface SavedLesson {
  id: string;
  title: string;
  bookName?: string;
  pageNumber?: string;
  imageData?: string; // Base64 string
  explanation: string;
  recognizedText?: string;
  exerciseType?: ExerciseType;
  resources?: ResourceLink[];
  timestamp: number;
  subjectId?: string;
  lastScrollPosition?: number;
  isCompleted?: boolean;
}

export interface PremiumContentResponse {
  question: string;
  options?: string[]; // Only for games/science
  answer: string; // The correct answer string
  explanation: string; // Why it is correct
  difficulty: string;
  imagePrompt?: string; // Prompt to generate an object image for identification games
}