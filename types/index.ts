export type User = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  activity: string;
};

export type TimerState = {
  phase: "work" | "break";
  secondsLeft: number;
  isRunning: boolean;
};

export type TimerConfig = {
  workMinutes: number;
  breakMinutes: number;
};

export type SessionMetrics = {
  sessionStart: number;
  studySeconds: number;
  breakSeconds: number;
};

export type SessionSummary = {
  totalSeconds: number;
  studySeconds: number;
  breakSeconds: number;
};

export type RoomState = {
  users: User[];
  currentMateIndex: number;
  hostId: string;
  timer: TimerState;
  timerConfig: TimerConfig;
  metrics: SessionMetrics;
};

export type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
};
