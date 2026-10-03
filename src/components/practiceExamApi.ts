import axios from "axios";
import { API_BASE_URL } from "../config/api";
export interface Part {
  id: string;
  label: string;
  type: "mcq" | "tf" | "numeric" | "short_answer" | "long_answer";
  prompt: string;
  choices: string[] | null;
  points: number;
  depends_on: string[];
}
export interface Exam {
  id: string;
  title: string;
  created_at: string;
  total_points: number;
  exam: {
    instructions?: string;
    time_limit_minutes?: number;
    sections: {
      name: string;
      instructions?: string;
      questions: { id: string; label: string; stem: string; parts: Part[] }[];
    }[];
  };
}
export interface Answer {
  part_id: string;
  user_answer: string;
}
export interface Attempt {
  id: string;
  status: "draft" | "grading" | "submitted" | "grading_failed";
  revision: number;
  answers: Answer[];
  created_at: string;
  error?: string;
  grading?: {
    score: number;
    total: number;
    results: {
      part_id: string;
      points_earned: number;
      points_possible: number;
      feedback: string;
      correct_answer: string;
      explanation: string;
    }[];
  };
}
export const examApi = axios.create({
  baseURL: `${API_BASE_URL}/api/practice-exams`,
  withCredentials: true,
  timeout: 600_000,
});
export function errorText(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === "string") return message;
    if (error.response?.status === 401) return "Please sign in to continue.";
    return error.response
      ? `Request failed (${error.response.status}). Please try again.`
      : "Connection interrupted. Reload saved exams or the attempt before retrying.";
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
