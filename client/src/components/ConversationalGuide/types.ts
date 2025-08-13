export type AvatarType = 'smiling' | 'neutral' | 'explaining' | 'enthusiastic' | 'excited' | 'thoughtful';

export interface GuideStep {
  id: string;
  avatar: AvatarType;
  message: string;
  actions?: GuideAction[];
  uiHint?: string;
  validation?: (data: any) => boolean;
  confetti?: boolean;
  requiresAction?: boolean;
  canProceed?: () => boolean;
}

export interface GuideAction {
  id: string;
  label: string;
  type: 'button' | 'input' | 'datepicker' | 'checkbox';
  required?: boolean;
  action: (value?: any) => void;
  disabled?: () => boolean;
}

export interface LeadData {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  eventDate?: string;
  notes?: string;
  gdprAccepted?: boolean;
}

export interface GuideState {
  currentStep: number;
  leadData: LeadData;
  isActive: boolean;
  showChat?: boolean;
}