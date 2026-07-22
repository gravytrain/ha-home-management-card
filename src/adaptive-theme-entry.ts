// HACS entry point. The existing cards stay self-contained; this layer adds the
// optional Farmhouse Ledger palette and follows Home Assistant's active mode.
import './home-management-card.js';
import './home-management-admin-card.js';

type CardConfig = { theme?: string; appearance?: 'auto' | 'light' | 'dark' };
type ThemedCard = HTMLElement & {
  hass?: { themes?: { darkMode?: boolean } };
  setConfig(config: CardConfig): void;
  updated?(changed: Map<string, unknown>): void;
  __homeManagementConfig?: CardConfig;
};

const DARK = {
  '--housing': '#2c3527', '--panel': '#374134', '--panel-2': '#4a5540', '--well': '#263022',
  '--bezel': '#6b7a5e', '--hairline': '#718068', '--brass': '#c9944a', '--brass-dim': '#a57636',
  '--needle': '#c1623b', '--ledger': '#b6c6a7', '--ink': '#faf6f0', '--ink-dim': '#d6d1c7',
  '--ink-faint': '#abb2a4', '--font-display': "'Playfair Display', Georgia, serif",
};
const LIGHT = {
  '--housing': '#f0e9df', '--panel': '#faf6f0', '--panel-2': '#fffdf9', '--well': '#f4ede3',
  '--bezel': '#d6cabc', '--hairline': '#e2d8cb', '--brass': '#a66f2e', '--brass-dim': '#8c5d26',
  '--needle': '#b54f31', '--ledger': '#476449', '--ink': '#2a2a26', '--ink-dim': '#5c5c54',
  '--ink-faint': '#77776f', '--font-display': "'Playfair Display', Georgia, serif",
};

function applyTheme(card: ThemedCard) {
  const config = card.__homeManagementConfig;
  if (config?.theme !== 'farm') return;
  const mode = config.appearance === 'auto' || !config.appearance
    ? (card.hass?.themes?.darkMode ? 'dark' : 'light')
    : config.appearance;
  card.dataset.theme = 'farm';
  card.dataset.appearance = mode;
  const palette = mode === 'dark' ? DARK : LIGHT;
  for (const [name, value] of Object.entries(palette)) card.style.setProperty(name, value);
}

function patchCard(tagName: string) {
  const Card = customElements.get(tagName) as { prototype: ThemedCard } | undefined;
  if (!Card) return;
  const prototype = Card.prototype;
  const originalSetConfig = prototype.setConfig;
  prototype.setConfig = function setConfig(config: CardConfig) {
    this.__homeManagementConfig = config;
    originalSetConfig.call(this, config);
    applyTheme(this);
  };
  const originalUpdated = prototype.updated;
  prototype.updated = function updated(changed: Map<string, unknown>) {
    originalUpdated?.call(this, changed);
    applyTheme(this);
  };
}

patchCard('home-management-card');
patchCard('home-management-admin-card');
