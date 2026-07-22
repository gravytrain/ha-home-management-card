# Home Management Card

A cohesive family command-center card for Home Assistant: one shared calendar, clear daily work lists for each child, and direct check-off interaction. Its visual system follows the **Meter Register** language from the RV Energy Card — graphite housing, brass labels, ledger-green completion states, compact field labels, and deliberately quiet supporting information.

This is a custom Lovelace card, not an arrangement of native cards. The interface makes the day legible at a glance and keeps each child’s action area focused:

- The shared schedule appears once at the top, sorted across every connected calendar.
- Each child has an independent work ledger with progress, chores, and schoolwork.
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
title: Home Ledger
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
  - name: Theo
    icon: T
    accent: '#6bbf7b'
    chores_entity: todo.theo_chores
    schoolwork_entity: todo.theo_schoolwork
```

## Options

| Option | Default | Purpose |
| --- | --- | --- |
| `title` | `Home Ledger` | The dashboard title. |
| `calendar_entities` | `[]` | Calendar entities to combine into one chronological schedule. |
| `days_ahead` | `7` | Number of upcoming days displayed. |
| `kids` | `[]` | Child panels. Each includes `name`, optional `icon` and `accent`, plus optional To-do entities. |
| `family_members` | `[]` | Optional household-presence cards. Each includes a `person_entity`, with optional `battery_entity`, `name`, and `icon`. |
| `show_calendar` | `true` | Hide the shared schedule when desired. |
| `show_chores` | `true` | Hide chore sections. |
| `show_schoolwork` | `true` | Hide schoolwork sections. |

The card gracefully handles an empty or not-yet-connected list. Configure only the categories you use; for example, omit `schoolwork_entity` during summer break.

## Development

```bash
npm install
npm run build
```

The distributable bundle is committed at `dist/home-management-card.js`. Edit TypeScript only in `src/`.
