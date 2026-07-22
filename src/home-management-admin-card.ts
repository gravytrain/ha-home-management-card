import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from './styles.js';
import type { ChildConfig, HomeAssistant, HomeManagementCardConfig } from './types.js';

type ScheduleMode = 'today' | 'date' | 'daily' | 'weekdays';
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SHORT_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

@customElement('home-management-admin-card')
export class HomeManagementAdminCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config!: HomeManagementCardConfig;
  @state() private _kid = 0;
  @state() private _kind: 'chores' | 'schoolwork' = 'chores';
  @state() private _mode: ScheduleMode = 'today';
  @state() private _task = '';
  @state() private _date = new Date().toISOString().slice(0, 10);
  @state() private _days = new Set<string>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  @state() private _message = '';
  @state() private _saving = false;

  setConfig(config: HomeManagementCardConfig) {
    if (!config.kids?.length) throw new Error('Add one or more kids to home-management-admin-card.');
    this._config = { title: 'Parent Console', kids: [], ...config };
  }
  private _selected(): ChildConfig { return this._config.kids![this._kid]; }
  private _entity() { return this._kind === 'chores' ? this._selected().chores_entity : this._selected().schoolwork_entity; }
  private _toggleDay(day: string) { const next = new Set(this._days); next.has(day) ? next.delete(day) : next.add(day); this._days = next; }
  private async _save() {
    const entityId = this._entity(); const task = this._task.trim();
    if (!task) { this._message = 'Add a task name first.'; return; }
    if (!entityId) { this._message = `No ${this._kind} list is connected for ${this._selected().name}.`; return; }
    if (this._mode === 'weekdays' && !this._days.size) { this._message = 'Choose at least one weekday.'; return; }
    if (!this.hass) return;
    this._saving = true; this._message = '';
    try {
      if (this._mode === 'today' || this._mode === 'date') {
        const dueDate = this._mode === 'today' ? new Date().toISOString().slice(0, 10) : this._date;
        await this.hass.callService('todo', 'add_item', { item: task, due_date: dueDate }, { entity_id: entityId });
      } else {
        await this.hass.callService('home_management', 'schedule_item', { list_entity: entityId, item: task, recurrence: this._mode, weekdays: this._mode === 'weekdays' ? [...this._days] : [] });
      }
      this._task = '';
      this._message = this._mode === 'today' || this._mode === 'date' ? `Added to ${this._selected().name}'s ${this._kind}.` : `Repeating task scheduled for ${this._selected().name}.`;
    } catch { this._message = this._mode === 'daily' || this._mode === 'weekdays' ? 'Install and enable the Home Management companion integration to use repeating tasks.' : 'Could not add this task. Check the To-do list supports due dates.'; }
    finally { this._saving = false; }
  }
  render() {
    const child = this._selected(); const entity = this._entity();
    return html`<ha-card><main><header><div><p class="eyebrow">FAMILY OPERATIONS</p><h1>${this._config.title}</h1><p class="subhead">Assign work without interrupting the children’s dashboard.</p></div><span class="badge">PARENT</span></header>
      <section><p class="label">WHO IS THIS FOR?</p><div class="choices">${this._config.kids!.map((kid, index) => html`<button class="choice ${index === this._kid ? 'selected' : ''}" @click=${() => { this._kid = index; this._message = ''; }}>${kid.icon || kid.name.slice(0, 1)}<span>${kid.name}</span></button>`)}</div></section>
      <section><p class="label">WHAT KIND OF WORK?</p><div class="segmented"><button class=${this._kind === 'chores' ? 'selected' : ''} @click=${() => this._kind = 'chores'}>CHORE</button><button class=${this._kind === 'schoolwork' ? 'selected' : ''} @click=${() => this._kind = 'schoolwork'}>SCHOOLWORK</button></div></section>
      <section><label class="label" for="task">TASK</label><input id="task" .value=${this._task} @input=${(event: InputEvent) => this._task = (event.target as HTMLInputElement).value} @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && this._save()} placeholder=${`Add a task for ${child.name}`} /></section>
      <section><p class="label">WHEN SHOULD IT APPEAR?</p><div class="schedule"><button class=${this._mode === 'today' ? 'selected' : ''} @click=${() => this._mode = 'today'}>TODAY</button><button class=${this._mode === 'date' ? 'selected' : ''} @click=${() => this._mode = 'date'}>DATE</button><button class=${this._mode === 'daily' ? 'selected' : ''} @click=${() => this._mode = 'daily'}>EVERY DAY</button><button class=${this._mode === 'weekdays' ? 'selected' : ''} @click=${() => this._mode = 'weekdays'}>WEEKLY</button></div>${this._mode === 'date' ? html`<input class="date" type="date" .value=${this._date} @input=${(event: InputEvent) => this._date = (event.target as HTMLInputElement).value} />` : nothing}${this._mode === 'weekdays' ? html`<div class="weekdays">${DAYS.map((day, index) => html`<button class=${this._days.has(day) ? 'selected' : ''} @click=${() => this._toggleDay(day)} aria-label=${day}>${SHORT_DAYS[index]}</button>`)}</div>` : nothing}</section>
      <footer><div class="status ${this._message ? 'visible' : ''}">${this._message}</div><button class="submit" ?disabled=${this._saving || !entity} @click=${this._save}>${this._saving ? 'SAVING…' : `ADD TO ${child.name.toUpperCase()}'S ${this._kind.toUpperCase()}`}</button></footer></main></ha-card>`;
  }
  static styles = [tokens, css`
    :host { display:block; color:var(--ink); font-family:var(--font-body); } ha-card { overflow:hidden; border:1px solid var(--bezel); border-radius:14px; background:var(--housing); box-shadow:0 12px 32px #0005; } main { padding:clamp(18px,3vw,28px); background:radial-gradient(circle at 92% 0%,#2d26193d,transparent 34%),var(--housing); } header { display:flex; justify-content:space-between; gap:14px; padding-bottom:20px; border-bottom:1px solid var(--hairline); } h1,p { margin:0; } h1 { font:700 clamp(25px,6vw,35px) var(--font-display); letter-spacing:.035em; } .eyebrow,.label,.badge,.schedule button,.segmented button,.submit { font:700 10px var(--font-mono); letter-spacing:.08em; } .eyebrow { color:var(--brass); margin-bottom:4px; } .subhead { margin-top:5px; color:var(--ink-dim); font-size:13px; } .badge { align-self:start; color:var(--brass); border:1px solid var(--brass-dim); padding:5px 8px; border-radius:4px; } section { padding:18px 0; border-bottom:1px solid var(--hairline); } .label { display:block; color:var(--ink-dim); margin-bottom:10px; } .choices,.segmented,.schedule,.weekdays { display:flex; gap:8px; flex-wrap:wrap; } button { cursor:pointer; } .choice { display:flex; align-items:center; gap:7px; padding:7px 11px 7px 8px; background:var(--well); color:var(--ink-dim); border:1px solid var(--bezel); border-radius:22px; font:600 13px var(--font-body); } .choice.selected { color:var(--ink); border-color:var(--brass-dim); background:#2b261a; } .segmented button,.schedule button { padding:9px 11px; color:var(--ink-dim); border:1px solid var(--bezel); background:var(--well); border-radius:4px; } .segmented .selected,.schedule .selected,.weekdays .selected { color:var(--housing); background:var(--brass); border-color:var(--brass); } input { width:100%; color:var(--ink); background:var(--well); border:1px solid var(--bezel); border-radius:5px; padding:12px; font:15px var(--font-body); outline:none; } input:focus { border-color:var(--brass-dim); } input.date { width:auto; margin-top:12px; font-family:var(--font-mono); } .weekdays { margin-top:12px; } .weekdays button { width:33px; height:33px; color:var(--ink-dim); background:var(--well); border:1px solid var(--bezel); border-radius:50%; font:700 11px var(--font-mono); } footer { padding-top:18px; } .status { min-height:19px; margin-bottom:9px; color:var(--ledger); font-size:12px; opacity:0; } .status.visible { opacity:1; } .submit { width:100%; padding:14px; color:#18150e; background:var(--brass); border:0; border-radius:5px; } .submit:disabled { cursor:not-allowed; opacity:.45; }
  `];
}
declare global { interface HTMLElementTagNameMap { 'home-management-admin-card': HomeManagementAdminCard; } }
