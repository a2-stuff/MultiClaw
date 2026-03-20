export interface AgentTemplate {
  id: string;
  name: string;
  description: string | null;
  provider: string | null;
  model: string | null;
  systemPrompt: string | null;
  skills: string | null; // JSON string
  plugins: string | null; // JSON string
  envVars: string | null; // JSON string
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFormData {
  name: string;
  description: string;
  provider: string;
  model: string;
  systemPrompt: string;
}
