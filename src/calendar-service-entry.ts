// Calendar event retrieval changed in Home Assistant; use the supported
// calendar.get_events action (with its response) instead of a retired WS call.
import './spacious-entry.js';

type CalendarResponse = Record<string, { events?: unknown[] }>;
type Card = HTMLElement & { [key: string]: any };

function patchCalendarLoading() {
  const CardClass = customElements.get('home-management-card') as { prototype: Card } | undefined;
  if (!CardClass) return;
  const prototype = CardClass.prototype;
  prototype._load = async function load() {
    if (!this.hass || !this._config || this._loading) return;
    this._loading = true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + (this._config.days_ahead ?? 7));
    const calendarIds = this._config.calendar_entities ?? [];
    const listIds = (this._config.kids ?? []).flatMap((kid: any) => [kid.chores_entity, kid.schoolwork_entity]).filter(Boolean) as string[];
    try {
      const [calendarResults, todoResults] = await Promise.all([
        Promise.all(calendarIds.map(async (entityId: string) => {
          try {
            const response = await this.hass.callService(
              'calendar', 'get_events',
              { start_date_time: start.toISOString(), end_date_time: end.toISOString() },
              { entity_id: entityId }, true,
            ) as CalendarResponse;
            const events = response?.[entityId]?.events ?? [];
            return events.map((event: any) => ({ ...event, calendar: this._name(entityId) }));
          } catch { return []; }
        })),
        Promise.all(listIds.map(async (entityId: string) => {
          try {
            const result = await this.hass.callWS({ type: 'todo/item/list', entity_id: entityId });
            return [entityId, result.items ?? []] as const;
          } catch { return [entityId, []] as const; }
        })),
      ]);
      this._events = calendarResults.flat().sort((a: any, b: any) => this._date(a.start).getTime() - this._date(b.start).getTime());
      this._todos = Object.fromEntries(todoResults);
    } finally {
      this._loading = false;
    }
  };
}

patchCalendarLoading();
