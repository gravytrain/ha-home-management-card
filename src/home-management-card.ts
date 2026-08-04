import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from './styles.js';
import { hydrateTodoItems } from './todo-metadata.js';
import type { CalendarEvent, ChildConfig, FamilyMemberConfig, HomeAssistant, HomeManagementCardConfig, TodoItem } from './types.js';

type TodoGroups = Record<string, TodoItem[]>;

@customElement('home-management-card')
export class HomeManagementCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config!: HomeManagementCardConfig;
  @state() private _events: Array<CalendarEvent & { calendar: string }> = [];
  @state() private _todos: TodoGroups = {};
  @state() private _loading = false;
  @state() private _showTechTimeConfirm = false;
  @state() private _techTimeChild: string | null = null;

  setConfig(config: HomeManagementCardConfig) {
    if (!config.kids?.length && !config.calendar_entities?.length) {
      throw new Error('Add at least one calendar entity or child list to home-management-card.');
    }
    this._config = {
      title: 'Home Base',
      calendar_entities: [],
      kids: [],
      family_members: [],
      days_ahead: 7,
      show_calendar: true,
      show_chores: true,
      show_schoolwork: true,
      ...config,
    };
  }

  connectedCallback() {
    super.connectedCallback();
    queueMicrotask(() => this._load());
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('hass') && this.hass && !this._loading && !this._events.length && !Object.keys(this._todos).length) {
      this._load();
    }
  }

  private async _load() {
    if (!this.hass || !this._config || this._loading) return;
    this._loading = true;
    const end = new Date();
    end.setDate(end.getDate() + (this._config.days_ahead ?? 7));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const calendarIds = this._config.calendar_entities ?? [];
    const listIds = (this._config.kids ?? []).flatMap((kid) => [kid.chores_entity, kid.schoolwork_entity]).filter(Boolean) as string[];
    try {
      const [calendarResults, todoResults] = await Promise.all([
        Promise.all(calendarIds.map(async (entityId) => {
          try {
            const events = await this.hass!.callWS<CalendarEvent[]>({ type: 'calendar/event/list', entity_id: entityId, start: start.toISOString(), end: end.toISOString() });
            return (events ?? []).map((event) => ({ ...event, calendar: this._name(entityId) }));
          } catch { return []; }
        })),
        Promise.all(listIds.map(async (entityId) => {
          try {
            const result = await this.hass!.callWS<{ items?: TodoItem[] }>({ type: 'todo/item/list', entity_id: entityId });
            return [entityId, hydrateTodoItems(result.items ?? [])] as const;
          } catch { return [entityId, []] as const; }
        })),
      ]);
      this._events = calendarResults.flat().sort((a, b) => this._date(a.start).getTime() - this._date(b.start).getTime());
      this._todos = Object.fromEntries(todoResults);
    } finally {
      this._loading = false;
    }
  }

  private _name(entityId: string) { return this.hass?.states[entityId]?.attributes.friendly_name || entityId.replace(/^calendar\.|^todo\./, '').replaceAll('_', ' '); }
  private _date(value: CalendarEvent['start'] | string) {
    const raw = typeof value === 'string' ? value : value.dateTime || value.date || '';
    return new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
  }
  private _day(value: CalendarEvent['start'] | string) {
    const date = this._date(value);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'TODAY';
    if (date.toDateString() === tomorrow.toDateString()) return 'TOMORROW';
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date).toUpperCase();
  }
  private _time(value: CalendarEvent['start']) {
    const raw = typeof value === 'string' ? value : value.dateTime || value.date || '';
    if (raw.length === 10) return 'ALL DAY';
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(this._date(value));
  }
  private _todayKey() { const value = new Date(); return String(value.getFullYear()) + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0'); }
  private _isPastDue(item: TodoItem) { const due = item.due?.slice(0, 10); return !!due && due < this._todayKey(); }
  private _openItems(entity?: string) { return entity ? (this._todos[entity] ?? []).filter((item) => item.status !== 'completed') : []; }
  private _doneItems(entity?: string) { return entity ? (this._todos[entity] ?? []).filter((item) => item.status === 'completed') : []; }
  private _member(member: FamilyMemberConfig) {
    const person = this.hass?.states[member.person_entity];
    const battery = member.battery_entity ? this.hass?.states[member.battery_entity]?.state : undefined;
    const name = member.name || person?.attributes.friendly_name || member.person_entity.replace(/^person\./, '').replaceAll('_', ' ');
    const home = person?.state === 'home';
    const location = home ? 'HOME' : person?.state ? person.state.replaceAll('_', ' ').toUpperCase() : 'UNKNOWN';
    return html`<div class="member"><span class="member-avatar ${home ? 'home' : ''}">${member.icon || name.slice(0, 1)}</span><div class="member-main"><strong>${name}</strong><small>${location}</small></div>${battery && !Number.isNaN(Number(battery)) ? html`<span class="battery">${battery}%</span>` : nothing}</div>`;
  }

  private async _toggle(entityId: string, item: TodoItem, kidName?: string, enableNotifications?: boolean) {
    if (!this.hass) return;
    const completed = item.status === 'completed';
    this._todos = { ...this._todos, [entityId]: (this._todos[entityId] ?? []).map((entry) => entry.uid === item.uid ? { ...entry, status: completed ? 'needs_action' : 'completed' } : entry) };
    try {
      await this.hass.callService('todo', 'update_item', { item: item.uid, status: completed ? 'needs_action' : 'completed' }, { entity_id: entityId });

      // Check if all tech-time items are complete after this toggle
      if (!completed && item.tech_time && kidName && enableNotifications) {
        this._checkTechTimeCompletion(kidName);
      }
    } catch { await this._load(); }
  }

  private _checkTechTimeCompletion(kidName: string) {
    const kid = this._config.kids?.find(k => k.name === kidName);
    if (!kid) return;

    const allTechTimeItems = [
      ...(this._todos[kid.chores_entity || ''] ?? []).filter(item => item.tech_time),
      ...(this._todos[kid.schoolwork_entity || ''] ?? []).filter(item => item.tech_time),
    ];

    const allComplete = allTechTimeItems.length > 0 && allTechTimeItems.every(item => item.status === 'completed');

    if (allComplete) {
      this._techTimeChild = kidName;
      this._showTechTimeConfirm = true;
    }
  }

  private async _sendTechTimeNotification() {
    if (!this.hass || !this._techTimeChild) return;

    try {
      await this.hass.callService('notify', 'notify', {
        message: `${this._techTimeChild} has completed all tech-time requirements!`,
        title: 'Tech Time Earned',
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

    this._showTechTimeConfirm = false;
    this._techTimeChild = null;
  }

  private _cancelTechTimeNotification() {
    this._showTechTimeConfirm = false;
    this._techTimeChild = null;
  }

  private _taskList(entityId: string | undefined, empty: string, hidePastDue = false, kidName?: string, enableNotifications?: boolean) {
    if (!entityId) return html`<p class="empty">No list connected</p>`;
    const visible = (item: TodoItem) => !hidePastDue || !this._isPastDue(item);
    const open = this._openItems(entityId).filter(visible).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const done = this._doneItems(entityId).filter(visible).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!open.length && !done.length) return html`<p class="empty">${empty}</p>`;
    return html`${open.map((item) => this._task(entityId, item, kidName, enableNotifications))}${done.map((item) => this._task(entityId, item, kidName, enableNotifications))}`;
  }

  private _task(entityId: string, item: TodoItem, kidName?: string, enableNotifications?: boolean) {
    const done = item.status === 'completed';
    return html`<button
      class="task ${done ? 'complete' : ''} ${item.tech_time ? 'tech-time' : ''}"
      @click=${() => this._toggle(entityId, item, kidName, enableNotifications)}
      aria-pressed=${done}
      aria-label="Mark ${item.summary} ${done ? 'not complete' : 'complete'}">
      <span class="check">${done ? '✓' : ''}</span>
      <span class="task-name">${item.summary}</span>
      ${item.tech_time ? html`<span class="tech-badge">⚡</span>` : nothing}
      ${item.due ? html`<span class="due">${item.due.slice(0, 10)}</span>` : nothing}
    </button>`;
  }

  private _kid(kid: ChildConfig, index: number) {
    const choreOpen = this._openItems(kid.chores_entity).filter((item) => !this._isPastDue(item)); const choreDone = this._doneItems(kid.chores_entity).filter((item) => !this._isPastDue(item));
    const schoolOpen = this._openItems(kid.schoolwork_entity); const schoolDone = this._doneItems(kid.schoolwork_entity);
    const total = choreOpen.length + choreDone.length + schoolOpen.length + schoolDone.length;
    const complete = choreDone.length + schoolDone.length;
    const progress = total ? Math.round((complete / total) * 100) : 0;
    const accent = kid.accent || ['#d9a441', '#6bbf7b', '#5b9bd5', '#a681c4'][index % 4];

    // Count tech-time items
    const techTimeChores = [...choreOpen, ...choreDone].filter(item => item.tech_time);
    const techTimeSchool = [...schoolOpen, ...schoolDone].filter(item => item.tech_time);
    const techTimeComplete = [...techTimeChores, ...techTimeSchool].filter(item => item.status === 'completed').length;
    const techTimeTotal = techTimeChores.length + techTimeSchool.length;

    return html`<article class="kid" style=${`--kid-accent:${accent}`}>
      <header class="kid-head">
        <div class="avatar">${kid.icon || kid.name.slice(0, 1)}</div>
        <div>
          <h3>${kid.name}</h3>
          <p>${complete} OF ${total} COMPLETE</p>
          ${techTimeTotal > 0 ? html`<p class="tech-time-status">⚡ ${techTimeComplete}/${techTimeTotal} tech-time</p>` : nothing}
        </div>
        <div class="progress" aria-label="${progress}% complete"><span>${progress}%</span></div>
      </header>
      <div class="progress-track"><i style=${`width:${progress}%`}></i></div>
      ${this._config.show_chores ? html`<section class="task-section"><h4>DAILY CHORES <span>${choreDone.length}/${choreOpen.length + choreDone.length}</span></h4>${this._taskList(kid.chores_entity, 'All chores are complete.', true, kid.name, kid.enable_tech_time_notifications)}</section>` : nothing}
      ${this._config.show_schoolwork ? html`<section class="task-section"><h4>SCHOOLWORK <span>${schoolDone.length}/${schoolOpen.length + schoolDone.length}</span></h4>${this._taskList(kid.schoolwork_entity, 'No schoolwork due.', false, kid.name, kid.enable_tech_time_notifications)}</section>` : nothing}
    </article>`;
  }

  render() {
    const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
    return html`<ha-card><div class="shell">
      <header class="masthead"><div><p class="eyebrow">FAMILY OPERATIONS</p><h1>${this._config.title}</h1><p class="date">${today}</p></div><button class="refresh" @click=${this._load} ?disabled=${this._loading} aria-label="Refresh dashboard">↻</button></header>

      <section class="kids"><div class="section-head"><div><p class="eyebrow">TODAY'S PLAN</p><h2>Kids' tasks</h2></div><span class="count">TAP TO CHECK OFF</span></div><div class="kid-grid">${(this._config.kids ?? []).map((kid, index) => this._kid(kid, index))}</div></section>


      ${this._config.show_calendar ? html`<section class="calendar panel"><div class="section-head"><div><p class="eyebrow">THE WEEK AHEAD</p><h2>Family schedule</h2></div><span class="count">${this._events.length} EVENTS</span></div><div class="events">${this._events.length ? this._events.slice(0, 8).map((event) => html`<div class="event"><span class="event-day">${this._day(event.start)}</span><div class="event-main"><strong>${event.summary || 'Untitled event'}</strong><small>${event.calendar}</small></div><span class="event-time">${this._time(event.start)}</span></div>`) : html`<p class="empty">No upcoming events on connected calendars.</p>`}</div></section>` : nothing}

      ${(this._config.family_members ?? []).length ? html`<section class="household panel"><div class="section-head"><div><p class="eyebrow">HOUSEHOLD PULSE</p><h2>Family status</h2></div><span class="count">${(this._config.family_members ?? []).filter((member) => this.hass?.states[member.person_entity]?.state === 'home').length} HOME</span></div><div class="member-grid">${(this._config.family_members ?? []).map((member) => this._member(member))}</div></section>` : nothing}

      ${this._showTechTimeConfirm ? html`
        <div class="modal-backdrop" @click=${this._cancelTechTimeNotification}>
          <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
            <h2>🎉 Tech Time Earned!</h2>
            <p>${this._techTimeChild} has completed all tech-time requirements.</p>
            <p>Send a notification?</p>
            <div class="modal-actions">
              <button class="btn-cancel" @click=${this._cancelTechTimeNotification}>Not Now</button>
              <button class="btn-confirm" @click=${this._sendTechTimeNotification}>Send Notification</button>
            </div>
          </div>
        </div>
      ` : nothing}
    </div></ha-card>`;
  }

  static styles = [tokens, css`
    :host { display: block; color: var(--ink); font-family: var(--font-body); }
    ha-card { overflow: hidden; background: var(--housing); border: 1px solid var(--bezel); border-radius: 14px; box-shadow: 0 12px 32px #0005; }
    .shell { padding: clamp(16px, 3vw, 28px); background: radial-gradient(circle at 92% 0%, #2d26193d, transparent 34%), var(--housing); }
    .masthead, .section-head, .kid-head, .event { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
    .masthead { padding-bottom: 22px; border-bottom: 1px solid var(--hairline); margin-bottom: 20px; }
    h1, h2, h3, h4, p { margin: 0; } h1, h2, h3 { font-family: var(--font-display); font-weight: 700; letter-spacing: .035em; } h1 { font-size: clamp(26px, 6vw, 36px); color: var(--ink); } h2 { font-size: 20px; } h3 { font-size: 20px; }
    .eyebrow, .count, .kid-head p, h4, .event-day, .event-time, small, .due { font-family: var(--font-mono); letter-spacing: .08em; font-weight: 700; font-size: 10px; }
    .eyebrow { color: var(--brass); margin-bottom: 4px; } .date { color: var(--ink-dim); margin-top: 4px; font-size: 13px; } .count { color: var(--ink-faint); white-space: nowrap; }
    .refresh { width: 36px; height: 36px; color: var(--brass); background: var(--well); border: 1px solid var(--brass-dim); border-radius: 50%; font-size: 21px; cursor: pointer; } .refresh:disabled { opacity: .45; }
    .panel, .kid { background: linear-gradient(145deg, var(--panel-2), var(--panel)); border: 1px solid var(--bezel); border-radius: 10px; }
    .panel { padding: 17px; margin-bottom: 26px; } .events { margin-top: 14px; }
    .kids { margin-bottom: 26px; }
    .event { padding: 11px 0; border-top: 1px solid var(--hairline); } .event:first-child { border-top: 0; } .event-day { color: var(--brass); min-width: 78px; } .event-main { flex: 1; min-width: 0; } .event-main strong { display: block; font-size: 14px; color: var(--ink); } small { display: block; color: var(--ink-faint); margin-top: 3px; text-transform: uppercase; } .event-time { color: var(--ledger); text-align: right; }
    .member-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin-top: 14px; } .member { display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--well); border: 1px solid var(--bezel); border-radius: 7px; } .member-avatar { display: grid; place-items: center; flex: 0 0 31px; width: 31px; height: 31px; color: var(--ink-dim); border: 1px solid var(--ink-faint); border-radius: 50%; font: 700 14px var(--font-display); } .member-avatar.home { color: var(--ledger); border-color: var(--ledger); background: color-mix(in srgb, var(--ledger) 14%, transparent); } .member-main { min-width: 0; } .member-main strong { display: block; font-size: 13px; } .member-main small { margin-top: 2px; color: var(--ink-faint); font-size: 9px; } .member-avatar.home + .member-main small { color: var(--ledger); } .battery { margin-left: auto; color: var(--brass); font: 700 11px var(--font-mono); }
    .kid-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 14px; margin-top: 14px; } .kid { overflow: hidden; } .kid-head { padding: 16px 16px 12px; justify-content: flex-start; } .avatar { display: grid; place-items: center; flex: 0 0 38px; width: 38px; height: 38px; border-radius: 50%; background: color-mix(in srgb, var(--kid-accent) 20%, var(--well)); color: var(--kid-accent); border: 1px solid var(--kid-accent); font-family: var(--font-display); font-size: 19px; } .kid-head p { color: var(--ink-faint); margin-top: 3px; }
    .progress { margin-left: auto; display: grid; place-items: center; width: 42px; height: 42px; border: 3px solid var(--kid-accent); border-radius: 50%; color: var(--kid-accent); font: 700 10px var(--font-mono); } .progress-track { height: 3px; background: var(--well); } .progress-track i { display: block; height: 100%; background: var(--kid-accent); transition: width .35s ease; }
    .task-section { padding: 14px 16px 4px; } .task-section + .task-section { border-top: 1px solid var(--hairline); padding-top: 14px; } h4 { display: flex; justify-content: space-between; color: var(--ink-dim); margin-bottom: 8px; } h4 span { color: var(--kid-accent); }
    .task { display: flex; align-items: center; width: 100%; gap: 9px; padding: 9px 0; color: var(--ink); background: none; border: 0; border-top: 1px solid #333a4460; font: 14px var(--font-body); text-align: left; cursor: pointer; position: relative; } .task:first-of-type { border-top: 0; } .task:hover .task-name { color: var(--kid-accent); } .check { display: grid; place-items: center; flex: 0 0 17px; width: 17px; height: 17px; border: 1px solid var(--ink-faint); border-radius: 3px; color: var(--housing); font: 800 12px var(--font-mono); } .complete .check { background: var(--ledger); border-color: var(--ledger); } .complete .task-name { color: var(--ink-faint); text-decoration: line-through; } .tech-badge { display: inline-block; padding: 2px 6px; background: color-mix(in srgb, var(--kid-accent) 20%, transparent); color: var(--kid-accent); border: 1px solid var(--kid-accent); border-radius: 4px; font-size: 10px; margin-left: auto; } .due { margin-left: 8px; color: var(--brass-dim); font-size: 9px; } .empty { padding: 8px 0 13px; color: var(--ink-faint); font-size: 13px; }
    .tech-time-status { color: var(--kid-accent); font-size: 9px; margin-top: 2px; }
    .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); display: grid; place-items: center; z-index: 1000; animation: fadeIn 0.2s ease; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal { background: var(--panel); border: 2px solid var(--brass); border-radius: 12px; padding: 28px; max-width: 400px; text-align: center; animation: slideUp 0.3s ease; } @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal h2 { margin: 0 0 16px; color: var(--ink); font-size: 24px; } .modal p { color: var(--ink-dim); margin: 8px 0; font-size: 14px; }
    .modal-actions { display: flex; gap: 12px; margin-top: 24px; justify-content: center; }
    .modal-actions button { padding: 12px 24px; border-radius: 8px; font: 700 13px var(--font-mono); letter-spacing: .08em; cursor: pointer; border: none; transition: all 0.2s ease; }
    .btn-cancel { background: var(--well); color: var(--ink-dim); border: 1px solid var(--bezel); } .btn-cancel:hover { background: var(--housing); }
    .btn-confirm { background: var(--brass); color: var(--housing); border: 1px solid var(--brass); } .btn-confirm:hover { background: var(--ledger); border-color: var(--ledger); }
    @media (max-width: 480px) { .shell { padding: 16px; } .event-day { min-width: 62px; font-size: 9px; } .event-time { font-size: 9px; } .section-head { align-items: flex-end; } .modal { padding: 20px; max-width: 320px; } }
  `];
}

declare global { interface HTMLElementTagNameMap { 'home-management-card': HomeManagementCard; } }
