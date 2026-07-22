import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { tokens } from './styles.js';
import type { ChildConfig, HomeAssistant, HomeManagementCardConfig, TodoItem } from './types.js';

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
  @state() private _items: TodoItem[] = [];
  @state() private _loadingItems = false;
  @state() private _removing?: string;
  @state() private _editing?: TodoItem;
  @state() private _editTask = '';
  @state() private _editDate = '';
  @state() private _updating = false;

  setConfig(config: HomeManagementCardConfig) {
    if (!config.kids?.length) throw new Error('Add one or more kids to home-management-admin-card.');
    this._config = { title: 'Parent Console', kids: [], ...config };
  }
  connectedCallback() {
    super.connectedCallback();
    queueMicrotask(() => this._loadItems());
  }
  protected updated(changed: Map<string, unknown>) {
    if (changed.has('hass') && this.hass && !this._items.length && !this._loadingItems) this._loadItems();
  }
  private _selected(): ChildConfig { return this._config.kids![this._kid]; }
  private _entity() { return this._kind === 'chores' ? this._selected().chores_entity : this._selected().schoolwork_entity; }
  private _toggleDay(day: string) { const next = new Set(this._days); next.has(day) ? next.delete(day) : next.add(day); this._days = next; }
  private async _loadItems() {
    if (!this._config) return;
    const entityId = this._entity();
    if (!this.hass || !entityId || this._loadingItems) { this._items = []; return; }
    this._loadingItems = true;
    try {
      const result = await this.hass.callWS<{ items?: TodoItem[] }>({ type: 'todo/item/list', entity_id: entityId });
      if (this._entity() === entityId) this._items = result.items ?? [];
    } catch { this._items = []; }
    finally { this._loadingItems = false; }
  }
  private _chooseKid(index: number) { this._kid = index; this._message = ''; this._items = []; this._loadItems(); }
  private _chooseKind(kind: 'chores' | 'schoolwork') { this._kind = kind; this._message = ''; this._items = []; this._loadItems(); }
  private _startEdit(item: TodoItem) {
    this._editing = item;
    this._editTask = item.summary;
    this._editDate = item.due?.slice(0, 10) ?? '';
    this._message = '';
  }
  private _cancelEdit() { this._editing = undefined; this._editTask = ''; this._editDate = ''; }
  private async _update() {
    const entityId = this._entity(); const item = this._editing; const task = this._editTask.trim();
    if (!item || !entityId || !this.hass) return;
    if (!task) { this._message = 'Add a task name first.'; return; }
    this._updating = true; this._message = '';
    try {
      const data: Record<string, unknown> = { item: item.uid, rename: task };
      if (this._editDate && this._editDate !== item.due?.slice(0, 10)) data.due_date = this._editDate;
      await this.hass.callService('todo', 'update_item', data, { entity_id: entityId });
      this._items = this._items.map((entry) => entry.uid === item.uid ? { ...entry, summary: task, due: this._editDate || entry.due } : entry);
      this._cancelEdit();
      this._message = `Updated “${task}”.`;
    } catch { this._message = 'Could not update this task. Check the To-do list supports item updates.'; }
    finally { this._updating = false; }
  }
  private async _remove(item: TodoItem) {
    const entityId = this._entity();
    if (!this.hass || !entityId) return;
    this._removing = item.uid; this._message = '';
    try {
      await this.hass.callService('todo', 'remove_item', { item: item.uid }, { entity_id: entityId });
      this._items = this._items.filter((entry) => entry.uid !== item.uid);
      this._message = `Removed “${item.summary}”.`;
    } catch { this._message = 'Could not remove this task. Check the To-do list supports item removal.'; }
    finally { this._removing = undefined; }
  }
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
      await this._loadItems();
    } catch { this._message = this._mode === 'daily' || this._mode === 'weekdays' ? 'Install and enable the Home Management companion integration to use repeating tasks.' : 'Could not add this task. Check the To-do list supports due dates.'; }
    finally { this._saving = false; }
  }
  render() {
    const child = this._selected(); const entity = this._entity();
    return html`<ha-card><main><header><div><p class="eyebrow">FAMILY OPERATIONS</p><h1>${this._config.title}</h1><p class="subhead">Assign work without interrupting the children’s dashboard.</p></div><span class="badge">PARENT</span></header>
      <section><p class="label">WHO IS THIS FOR?</p><div class="choices">${this._config.kids!.map((kid, index) => html`<button class="choice ${index === this._kid ? 'selected' : ''}" @click=${() => this._chooseKid(index)}>${kid.icon || kid.name.slice(0, 1)}<span>${kid.name}</span></button>`)}</div></section>
      <section><p class="label">WHAT KIND OF WORK?</p><div class="segmented"><button class=${this._kind === 'chores' ? 'selected' : ''} @click=${() => this._chooseKind('chores')}>CHORE</button><button class=${this._kind === 'schoolwork' ? 'selected' : ''} @click=${() => this._chooseKind('schoolwork')}>SCHOOLWORK</button></div></section>
      <section><label class="label" for="task">TASK</label><input id="task" .value=${this._task} @input=${(event: InputEvent) => this._task = (event.target as HTMLInputElement).value} @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && this._save()} placeholder=${`Add a task for ${child.name}`} /></section>
      <section><p class="label">WHEN SHOULD IT APPEAR?</p><div class="schedule"><button class=${this._mode === 'today' ? 'selected' : ''} @click=${() => this._mode = 'today'}>TODAY</button><button class=${this._mode === 'date' ? 'selected' : ''} @click=${() => this._mode = 'date'}>DATE</button><button class=${this._mode === 'daily' ? 'selected' : ''} @click=${() => this._mode = 'daily'}>EVERY DAY</button><button class=${this._mode === 'weekdays' ? 'selected' : ''} @click=${() => this._mode = 'weekdays'}>WEEKLY</button></div>${this._mode === 'date' ? html`<input class="date" type="date" .value=${this._date} @input=${(event: InputEvent) => this._date = (event.target as HTMLInputElement).value} />` : nothing}${this._mode === 'weekdays' ? html`<div class="weekdays">${DAYS.map((day, index) => html`<button class=${this._days.has(day) ? 'selected' : ''} @click=${() => this._toggleDay(day)} aria-label=${day}>${SHORT_DAYS[index]}</button>`)}</div>` : nothing}</section>
      <section class="list"><div class="list-heading"><p class="label">${child.name.toUpperCase()}’S ${this._kind.toUpperCase()} LIST</p><button class="refresh" ?disabled=${this._loadingItems} @click=${() => this._loadItems()} aria-label="Refresh task list">↻</button></div>${this._editing ? html`<form class="edit" @submit=${(event: SubmitEvent) => { event.preventDefault(); this._update(); }}><label class="label" for="edit-task">EDIT TASK</label><input id="edit-task" .value=${this._editTask} @input=${(event: InputEvent) => this._editTask = (event.target as HTMLInputElement).value} /><label class="label" for="edit-date">DUE DATE <span>(OPTIONAL)</span></label><input id="edit-date" class="date" type="date" .value=${this._editDate} @input=${(event: InputEvent) => this._editDate = (event.target as HTMLInputElement).value} /><div class="edit-actions"><button class="cancel" type="button" ?disabled=${this._updating} @click=${this._cancelEdit}>CANCEL</button><button class="update" ?disabled=${this._updating}>${this._updating ? 'UPDATING…' : 'SAVE CHANGES'}</button></div></form>` : nothing}${!entity ? html`<p class="empty">No list connected.</p>` : this._loadingItems ? html`<p class="empty">Loading tasks…</p>` : this._items.length ? html`<div class="items">${this._items.map((item) => html`<div class="item ${item.status === 'completed' ? 'complete' : ''}"><span class="item-name">${item.summary}${item.due ? html`<small>${item.due.slice(0, 10)}</small>` : nothing}</span><div class="item-actions"><button class="edit-button" ?disabled=${this._updating} @click=${() => this._startEdit(item)} aria-label=${`Edit ${item.summary}`}>EDIT</button><button class="remove" ?disabled=${this._removing === item.uid || this._updating} @click=${() => this._remove(item)} aria-label=${`Remove ${item.summary}`}>${this._removing === item.uid ? 'REMOVING…' : 'REMOVE'}</button></div></div>`)}</div>` : html`<p class="empty">No tasks in this list.</p>`}</section>
      <footer><div class="status ${this._message ? 'visible' : ''}">${this._message}</div><button class="submit" ?disabled=${this._saving || !entity} @click=${this._save}>${this._saving ? 'SAVING…' : `ADD TO ${child.name.toUpperCase()}'S ${this._kind.toUpperCase()}`}</button></footer></main></ha-card>`;
  }
  static styles = [tokens, css`
    :host { display:block; color:var(--ink); font-family:var(--font-body); } ha-card { overflow:hidden; border:1px solid var(--bezel); border-radius:14px; background:var(--housing); box-shadow:0 12px 32px #0005; } main { padding:clamp(18px,3vw,28px); background:radial-gradient(circle at 92% 0%,#2d26193d,transparent 34%),var(--housing); } header { display:flex; justify-content:space-between; gap:14px; padding-bottom:20px; border-bottom:1px solid var(--hairline); } h1,p { margin:0; } h1 { font:700 clamp(25px,6vw,35px) var(--font-display); letter-spacing:.035em; } .eyebrow,.label,.badge,.schedule button,.segmented button,.submit,.remove,.edit-button,.cancel,.update { font:700 10px var(--font-mono); letter-spacing:.08em; } .eyebrow { color:var(--brass); margin-bottom:4px; } .subhead { margin-top:5px; color:var(--ink-dim); font-size:13px; } .badge { align-self:start; color:var(--brass); border:1px solid var(--brass-dim); padding:5px 8px; border-radius:4px; } section { padding:18px 0; border-bottom:1px solid var(--hairline); } .label { display:block; color:var(--ink-dim); margin-bottom:10px; } .label span { color:var(--ink-faint); } .choices,.segmented,.schedule,.weekdays { display:flex; gap:8px; flex-wrap:wrap; } button { cursor:pointer; } .choice { display:flex; align-items:center; gap:7px; padding:7px 11px 7px 8px; background:var(--well); color:var(--ink-dim); border:1px solid var(--bezel); border-radius:22px; font:600 13px var(--font-body); } .choice.selected { color:var(--ink); border-color:var(--brass-dim); background:#2b261a; } .segmented button,.schedule button { padding:9px 11px; color:var(--ink-dim); border:1px solid var(--bezel); background:var(--well); border-radius:4px; } .segmented .selected,.schedule .selected,.weekdays .selected { color:var(--housing); background:var(--brass); border-color:var(--brass); } input { width:100%; color:var(--ink); background:var(--well); border:1px solid var(--bezel); border-radius:5px; padding:12px; font:15px var(--font-body); outline:none; } input:focus { border-color:var(--brass-dim); } input.date { width:auto; margin-top:12px; font-family:var(--font-mono); } .weekdays { margin-top:12px; } .weekdays button { width:33px; height:33px; color:var(--ink-dim); background:var(--well); border:1px solid var(--bezel); border-radius:50%; font:700 11px var(--font-mono); } .list-heading,.item,.item-actions,.edit-actions { display:flex; align-items:center; justify-content:space-between; gap:8px; } .list-heading .label { margin-bottom:0; } .refresh { width:30px; height:30px; color:var(--brass); background:var(--well); border:1px solid var(--brass-dim); border-radius:50%; font-size:17px; } .refresh:disabled,.remove:disabled,.edit-button:disabled,.cancel:disabled,.update:disabled { cursor:not-allowed; opacity:.5; } .edit { margin-top:14px; padding:14px; background:var(--well); border:1px solid var(--bezel); border-radius:5px; } .edit .date { margin-top:0; margin-bottom:14px; } .edit-actions { justify-content:flex-end; } .cancel,.edit-button { color:var(--ink-dim); background:transparent; border:1px solid var(--bezel); border-radius:4px; padding:6px 8px; } .update { color:#18150e; background:var(--brass); border:1px solid var(--brass); border-radius:4px; padding:7px 9px; } .items { margin-top:10px; border-top:1px solid var(--hairline); } .item { padding:10px 0; border-bottom:1px solid var(--hairline); font-size:14px; } .item-name { min-width:0; } .item-name small { display:block; margin-top:3px; color:var(--brass-dim); font:700 9px var(--font-mono); letter-spacing:.08em; } .item.complete .item-name { color:var(--ink-faint); text-decoration:line-through; } .item-actions { flex:0 0 auto; } .remove { color:var(--needle); background:transparent; border:1px solid color-mix(in srgb, var(--needle) 55%, var(--bezel)); border-radius:4px; padding:6px 8px; } .empty { margin-top:10px; color:var(--ink-faint); font-size:13px; } footer { padding-top:18px; } .status { min-height:19px; margin-bottom:9px; color:var(--ledger); font-size:12px; opacity:0; } .status.visible { opacity:1; } .submit { width:100%; padding:14px; color:#18150e; background:var(--brass); border:0; border-radius:5px; } .submit:disabled { cursor:not-allowed; opacity:.45; }
  `];
}
declare global { interface HTMLElementTagNameMap { 'home-management-admin-card': HomeManagementAdminCard; } }
