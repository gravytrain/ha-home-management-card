export interface HassEntity {
  state: string;
  attributes: Record<string, unknown> & { friendly_name?: string };
}

export interface TodoItem {
  uid: string;
  summary: string;
  status: 'needs_action' | 'completed' | string;
  due?: string;
  description?: string;
}

export interface CalendarEvent {
  summary?: string;
  start: string | { date?: string; dateTime?: string };
  end?: string | { date?: string; dateTime?: string };
  description?: string;
}

export interface ChildConfig {
  name: string;
  icon?: string;
  accent?: string;
  chores_entity?: string;
  schoolwork_entity?: string;
}

export interface HomeManagementCardConfig {
  type: string;
  title?: string;
  calendar_entities?: string[];
  kids?: ChildConfig[];
  days_ahead?: number;
  show_calendar?: boolean;
  show_chores?: boolean;
  show_schoolwork?: boolean;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  callService(domain: string, service: string, serviceData?: Record<string, unknown>, target?: Record<string, unknown>): Promise<unknown>;
}
