# Home Management Card

A cohesive family command-center card for Home Assistant: one shared calendar, clear daily work lists for each child, and direct check-off interaction. Its visual system follows the **Meter Register** language from the RV Energy Card — graphite housing, brass labels, ledger-green completion states, compact field labels, and deliberately quiet supporting information.

This is a custom Lovelace card, not an arrangement of native cards. The interface makes the day legible at a glance and keeps each child’s action area focused:

- Each child’s task board appears first with progress, chores, and schoolwork.
- The shared schedule follows, sorted across every connected calendar.
- The household status pulse appears last, showing who’s home and battery levels.
- Tasks can be reordered via drag-and-drop for custom prioritization.
- Tasks marked as "tech time" requirements trigger optional completion notifications.
- A task is checked off directly in the card; it updates the corresponding native Home Assistant To-do list.
- Completed tasks remain visible but subdued, so a child sees what they accomplished without it competing with what remains.

## Requirements

- Home Assistant 2023.7 or newer, for native To-do entities.
- One `todo.*` entity per work category you want to show. A simple setup gives every child a `chores` list and a `schoolwork` list.
- Optional `calendar.*` entities from Google Calendar, CalDAV, Local Calendar, or another Home Assistant calendar integration.

## Install

1. Add this repository to HACS as a **Lovelace** custom repository.
2. Install **Home Management Card**.
3. Reload the browser, then add the card to a dashboard.

## Dashboard configuration

```yaml
type: custom:home-management-card
title: Home Base
calendar_entities:
  - calendar.family
  - calendar.school
  - calendar.activities
days_ahead: 7
kids:
  - name: Ada
    icon: A
    accent: '#d9a441'
    chores_entity: todo.ada_chores
    schoolwork_entity: todo.ada_schoolwork
    enable_tech_time_notifications: true
  - name: Theo
    icon: T
    accent: '#6bbf7b'
    chores_entity: todo.theo_chores
    schoolwork_entity: todo.theo_schoolwork
    enable_tech_time_notifications: true
```

## Options

| Option | Default | Purpose |
| --- | --- | --- |
| `title` | `Home Base` | The dashboard title. |
| `calendar_entities` | `[]` | Calendar entities to combine into one chronological schedule. |
| `days_ahead` | `7` | Number of upcoming days displayed. |
| `kids` | `[]` | Child panels. Each includes `name`, optional `icon` and `accent`, plus optional To-do entities and `enable_tech_time_notifications`. |
| `family_members` | `[]` | Optional household-presence cards. Each includes a `person_entity`, with optional `battery_entity`, `name`, and `icon`. |
| `show_calendar` | `true` | Hide the shared schedule when desired. |
| `show_chores` | `true` | Hide chore sections. |
| `show_schoolwork` | `true` | Hide schoolwork sections. |

### Child Configuration Options

Each child in the `kids` array supports:

| Option | Required | Purpose |
| --- | --- | --- |
| `name` | Yes | The child's display name. |
| `icon` | No | Custom icon or initial to display. Defaults to first letter of name. |
| `accent` | No | Hex color for the child's accent color. Auto-assigned from palette if omitted. |
| `chores_entity` | No | Todo list entity for daily chores. |
| `schoolwork_entity` | No | Todo list entity for schoolwork. |
| `enable_tech_time_notifications` | No | Enable popup confirmation when all tech-time tasks are complete. Defaults to `false`. |

The card gracefully handles an empty or not-yet-connected list. Configure only the categories you use; for example, omit `schoolwork_entity` during summer break.

## Tech Time Feature

Tasks can be marked as "tech time" requirements in the Parent Console (admin card). When all tech-time tasks for a child are completed:

1. A modal appears asking if you want to send a notification
2. If confirmed, a Home Assistant notification is sent to the `notify.notify` service
3. Tasks marked as tech-time show a ⚡ badge in both the main card and admin card

To use this feature:

1. Set `enable_tech_time_notifications: true` for each child in the card config
2. In the Parent Console, check the "⚡ Required for tech time" box when adding or editing tasks
3. When the child completes all tech-time tasks, you'll be prompted to send a notification

The tech-time counter appears below each child's name showing progress (e.g., "⚡ 3/5 tech-time").

## Drag-and-Drop Reordering

Tasks can be reordered by dragging and dropping within each list section. The order is automatically persisted to Home Assistant and will be maintained across sessions. This allows you to prioritize tasks or group related items together.

## Development

```bash
npm install
npm run build
```

The distributable bundle is committed at `dist/home-management-card.js`. Edit TypeScript only in `src/`.
