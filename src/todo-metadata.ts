// The admin card stores tech_time and order as JSON in a todo item's description
// field, because HA's todo entities have no custom-field support. Both the card's
// own _load and the calendar-ws _load patch must decode it, or the fields stay
// undefined and reordering/tech-time silently do nothing.
import type { TodoItem } from './types.js';

interface TodoMetadata {
  tech_time?: boolean;
  order?: number;
}

/**
 * Decode the metadata JSON a todo item's description may carry.
 *
 * A description is only metadata if it parses to a JSON object. Parents can also
 * type free-text notes into that field, so anything that is not valid JSON —
 * or is valid JSON but not an object (e.g. the bare string "shopping") — is
 * treated as having no metadata rather than raising.
 */
function parseMetadata(description?: string): TodoMetadata {
  if (!description) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(description);
  } catch {
    return {}; // Free-text note, not metadata.
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

  const candidate = parsed as Record<string, unknown>;
  const metadata: TodoMetadata = {};
  if (typeof candidate.tech_time === 'boolean') metadata.tech_time = candidate.tech_time;
  if (typeof candidate.order === 'number' && Number.isFinite(candidate.order)) metadata.order = candidate.order;
  return metadata;
}

/**
 * Hydrate raw todo items from HA with their decoded tech_time/order metadata,
 * preserving list position as a fallback order so items saved before the
 * reordering feature existed still sort deterministically.
 */
export function hydrateTodoItems(items: TodoItem[]): TodoItem[] {
  return items.map((item, index) => {
    const { tech_time, order } = parseMetadata(item.description);
    return { ...item, tech_time: tech_time ?? false, order: order ?? index };
  });
}
