// Use Home Assistant's one-shot WebSocket service protocol for calendar data.
import './calendar-service-entry.js';

type Card = HTMLElement & { [key: string]: any };

function patchCalendarLoading() {
  const CardClass = customElements.get('home-management-card') as { prototype: Card } | undefined;
  if (!CardClass) return;
  CardClass.prototype._load = async function load() {
    if (!this.hass || !this._config || this._loading) return;
    this._loading = true;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + (this._config.days_ahead ?? 7));
    const calendarIds = this._config.calendar_entities ?? [];
    const listIds = (this._config.kids ?? []).flatMap((kid: any) => [kid.chores_entity, kid.schoolwork_entity]).filter(Boolean) as string[];
    try {
      const [calendarResults, todoResults] = await Promise.all([
        Promise.all(calendarIds.map(async (entityId: string) => {
          try {
            const result = await this.hass.callWS({
              type: 'call_service', domain: 'calendar', service: 'get_events',
              service_data: { start_date_time: start.toISOString(), end_date_time: end.toISOString() },
              target: { entity_id: entityId }, return_response: true,
            });
            const response = result.response ?? result.service_response ?? result;
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
    } finally { this._loading = false; }
  };
}

patchCalendarLoading();
