# Parent Management Page

Use a separate dashboard view for parents and add the following card. It uses the same child/list configuration as the family page.

```yaml
type: custom:home-management-admin-card
title: Parent Console
kids:
  - name: Ada
    icon: A
    chores_entity: todo.ada_chores
    schoolwork_entity: todo.ada_schoolwork
  - name: Theo
    icon: T
    chores_entity: todo.theo_chores
    schoolwork_entity: todo.theo_schoolwork
```

## Scheduling behavior

| Choice | Result |
| --- | --- |
| Today | Adds one task now, due today. |
| Date | Adds one task with the selected due date. |
| Every day | Adds a task each day, including today. |
| Weekly | Adds a task on the selected weekdays, including today when selected. |

The **Today** and **Date** options work with any Home Assistant To-do list that supports `todo.add_item` and due dates. Repeating options need the included companion integration, because recurrence must run on Home Assistant—not in a browser tab.

## Manage assigned tasks

The selected child and work type also show their current To-do list in the parent console. Use **Remove** beside any task to delete it from that child’s configured list. The control uses Home Assistant’s `todo.remove_item` service, so the task is removed from the same list shown to the child.

## Enable recurring schedules

1. Copy `custom_components/home_management` from this repository into your Home Assistant `config/custom_components/` directory.
2. Add the following to `configuration.yaml` and restart Home Assistant:

```yaml
home_management:
```

The integration saves repeating schedules in Home Assistant’s private storage. It materializes due items when Home Assistant starts and just after midnight. It remembers the recent dates it has run, which prevents duplicate daily items after a restart.

The card and the schedule engine deliberately keep the actual work in the configured `todo.*` lists. That means children continue to check tasks off from the family page, and parents can still inspect the lists in Home Assistant’s native To-do dashboard.
