// Study & assistant personas. These mirror the backend's mode enum (spec §7.6).
// `category` biases the Auto router toward a model class.

import {
  Sparkles,
  GraduationCap,
  Code2,
  Sigma,
  Briefcase,
  Baby,
} from 'lucide-react';

export const MODES = [
  {
    id: 'general',
    label: 'General',
    short: 'Helpful all-round assistant',
    description: 'A balanced, helpful default assistant for any task.',
    icon: Sparkles,
    category: 'general',
  },
  {
    id: 'exam_tutor',
    label: 'Exam Tutor',
    short: 'Concept → worked solution → practice',
    description:
      'Tutors for competitive exams: core concept and intuition, a full step-by-step solution, then one practice question.',
    icon: GraduationCap,
    category: 'reasoning',
  },
  {
    id: 'code_mentor',
    label: 'Code Mentor',
    short: 'Senior-engineer code review',
    description:
      'Writes and reviews code, explains trade-offs, complexity, edge cases and bugs.',
    icon: Code2,
    category: 'code',
  },
  {
    id: 'math_solver',
    label: 'Math Solver',
    short: 'Rigorous, every step in LaTeX',
    description:
      'Solves rigorously, shows every step in clean LaTeX, states assumptions and verifies the answer.',
    icon: Sigma,
    category: 'reasoning',
  },
  {
    id: 'interview_prep',
    label: 'Interview Prep',
    short: 'One question at a time, with feedback',
    description:
      'Acts as a technical interviewer — asks one question, waits, then gives targeted feedback and a follow-up.',
    icon: Briefcase,
    category: 'general',
  },
  {
    id: 'explain_simply',
    label: 'Explain Simply',
    short: 'Beginner-friendly analogies',
    description:
      'Explains like you are a curious beginner, using a concrete analogy and a tiny example.',
    icon: Baby,
    category: 'general',
  },
];

export const DEFAULT_MODE = 'general';

export function getMode(id) {
  return MODES.find((m) => m.id === id) || MODES[0];
}
