# Home Management Card - Feature Updates

## Summary

This update adds tech-time tracking, drag-and-drop task reordering, and UI reorganization to the Home Management Card.

## Changes

### 1. UI Reordering
- **Kids' tasks** section now appears first
- **Family schedule** (calendar) section moved to middle
- **Household pulse** section moved to bottom

This prioritizes the children's daily tasks, making them immediately visible when opening the dashboard.

### 2. Tech-Time Feature

#### Main Card (`home-management-card`)
- Tasks can now be marked as "tech-time" requirements
- Tech-time tasks display a ⚡ lightning badge
- Progress indicator shows "⚡ X/Y tech-time" below each child's name
- When all tech-time tasks are complete, a modal confirmation appears
- Optional notification sent via `notify.notify` service when confirmed
- Enable per-child with `enable_tech_time_notifications: true` config option

#### Admin Card (`home-management-admin-card`)
- New "⚡ Required for tech time" checkbox when adding tasks
- Tech-time checkbox available when editing existing tasks
- Tasks with tech-time show ⚡ badge in the task list
- Tech-time metadata stored in task description field as JSON

### 3. Drag-and-Drop Reordering

- Tasks can be reordered by dragging the drag handle (⋮⋮)
- Order is persisted to Home Assistant via task description field
- Works within each list section (chores, schoolwork)
- Visual feedback during drag operations
- Order maintained across page reloads and sessions

### 4. Data Model Changes

#### TodoItem interface (`types.ts`)
```typescript
export interface TodoItem {
  uid: string;
  summary: string;
  status: 'needs_action' | 'completed' | string;
  due?: string;
  description?: string;
  tech_time?: boolean;    // NEW
  order?: number;         // NEW
}
```

#### ChildConfig interface (`types.ts`)
```typescript
export interface ChildConfig {
  name: string;
  icon?: string;
  accent?: string;
  chores_entity?: string;
  schoolwork_entity?: string;
  enable_tech_time_notifications?: boolean;  // NEW
}
```

### 5. Styling Updates

#### Main Card
- New `.drag-handle` styles for reorder grip
- New `.tech-badge` styles for lightning bolt indicator
- New `.tech-time-status` styles for progress text
- Modal styles for confirmation dialog:
  - `.modal-backdrop` with fade-in animation
  - `.modal` with slide-up animation
  - `.modal-actions` button group
  - `.btn-cancel` and `.btn-confirm` button styles
- Improved task hover states

#### Admin Card
- New `.checkbox-label` styles for tech-time toggle
- New `.tech-badge-admin` styles for list display
- Consistent styling with main card

## Technical Implementation Notes

### Data Storage
Tech-time and order data are stored in the task's `description` field as JSON:
```json
{
  "tech_time": true,
  "order": 3
}
```

This approach avoids requiring custom fields in Home Assistant's todo entities.

### Notification Service
When tech-time completion is confirmed, the card calls:
```javascript
hass.callService('notify', 'notify', {
  message: `${childName} has completed all tech-time requirements!`,
  title: 'Tech Time Earned',
});
```

Ensure your Home Assistant instance has the `notify.notify` service configured.

### Drag-and-Drop Implementation
- Uses native HTML5 drag-and-drop API
- Draggable attribute on task buttons
- Event handlers: `dragstart`, `dragover`, `drop`, `dragend`
- Prevents cross-list dragging
- Updates all task orders on drop to maintain consistency

## Migration Guide

### Existing Installations
1. No database changes required
2. Existing tasks will work without modification
3. To use tech-time:
   - Add `enable_tech_time_notifications: true` to child configs
   - Use Parent Console to mark tasks as tech-time
4. Task ordering will default to 0 for existing tasks

### Configuration Updates
Update your dashboard YAML to include the new option:

```yaml
type: custom:home-management-card
title: Home Base
kids:
  - name: Ada
    chores_entity: todo.ada_chores
    schoolwork_entity: todo.ada_schoolwork
    enable_tech_time_notifications: true  # Add this line
```

## Testing Recommendations

1. **Tech-Time Flow**
   - Mark several tasks as tech-time in Parent Console
   - Complete all but one tech-time task
   - Verify counter updates correctly
   - Complete final tech-time task
   - Verify modal appears
   - Test both confirmation and cancellation

2. **Drag-and-Drop**
   - Drag tasks within chores section
   - Drag tasks within schoolwork section
   - Verify order persists after page reload
   - Verify order maintained across different devices

3. **UI Layout**
   - Verify sections appear in correct order:
     1. Kids' tasks
     2. Calendar
     3. Household pulse
   - Test on mobile and desktop viewports
   - Verify modal is responsive

4. **Backward Compatibility**
   - Test with children who don't have `enable_tech_time_notifications`
   - Test with tasks that don't have tech_time metadata
   - Verify existing functionality still works

## Known Limitations

1. Drag-and-drop only works within same list (can't drag from chores to schoolwork)
2. Tech-time and order data stored in description field, may conflict with user-entered descriptions
3. Notification uses default notify service - customize per your setup
4. No undo for drag-and-drop reordering (refresh to revert)

## Future Enhancements

Potential features for future versions:
- Custom notification targets per child
- Visual rewards/animations for tech-time completion
- Parent override to manually trigger tech-time notification
- Bulk operations for marking multiple tasks as tech-time
- Import/export task templates with tech-time settings
