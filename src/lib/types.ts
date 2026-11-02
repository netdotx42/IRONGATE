export type Status =
  | "Configured"
  | "Needs Review"
  | "Missing"
  | "Not Applicable"
  | "Not Tested";
export type Finding = {
  id: string;
  name: string;
  status: Status;
  severity: "success" | "information" | "warning" | "critical";
  value?: string;
  explanation: string;
  recommendation: string;
  weight: number;
  earned: number;
};
export type ScanResult = {
  id?: string;
  tool: "webshield" | "headerguard";
  hostname: string;
  url: string;
  score: number | null;
  grade: string | null;
  findings: Finding[];
  scoring_version: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  certificate_days?: number;
  limitations: string[];
};
