// Adds a consistent, responsive canvas around the two full-panel cards.
import './adaptive-theme-entry.js';

type SpaciousCard = HTMLElement & { updated?(changed: Map<string, unknown>): void };

const LAYOUT_ID = 'home-management-spacious-layout';
const LAYOUT_CSS = `
  :host {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding: clamp(12px, 2.4vw, 34px);
  }
  ha-card {
    width: 100%;
    max-width: 1320px;
    margin: 0 auto;
  }
  @media (max-width: 480px) {
    :host { padding: 8px; }
  }
`;

function applyLayout(card: SpaciousCard) {
  const root = card.shadowRoot;
  if (!root || root.getElementById(LAYOUT_ID)) return;
  const style = document.createElement('style');
  style.id = LAYOUT_ID;
  style.textContent = LAYOUT_CSS;
  root.append(style);
}

function patchCard(tagName: string) {
  const Card = customElements.get(tagName) as { prototype: SpaciousCard } | undefined;
  if (!Card) return;
  const prototype = Card.prototype;
  const originalUpdated = prototype.updated;
  prototype.updated = function updated(changed: Map<string, unknown>) {
    originalUpdated?.call(this, changed);
    applyLayout(this);
  };
}

patchCard('home-management-card');
patchCard('home-management-admin-card');
