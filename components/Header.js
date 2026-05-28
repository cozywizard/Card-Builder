import { h } from 'https://esm.sh/preact@10.19.6';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

export default function Header({ activeTab, setActiveTab, libraryCount, theme, onToggleTheme }) {
  const isDark = theme === 'dark';

  return html`
    <header class="app-header glass-panel">
      <!-- App Brand Logo -->
      <div class="brand-logo-group">
        <div class="brand-glowing-logo">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <path d="M12 8l4 4-4 4-4-4z"/>
          </svg>
        </div>
        <div class="brand-text-block">
          <h1 class="brand-title">CardForge</h1>
          <span class="brand-subtitle">Game Design Suite</span>
        </div>
      </div>

      <!-- Tab Navigation Navigation -->
      <nav class="app-navigation">
        <button
          class="nav-tab-link ${activeTab === 'creator' ? 'active' : ''}"
          onClick=${() => setActiveTab('creator')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
          Card Creator
        </button>

        <button
          class="nav-tab-link ${activeTab === 'library' ? 'active' : ''}"
          onClick=${() => setActiveTab('library')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          Card Library
          ${libraryCount > 0 && html`
            <span class="nav-badge animate-scale-in">${libraryCount}</span>
          `}
        </button>

        <button
          class="nav-tab-link ${activeTab === 'sheet-builder' ? 'active' : ''}"
          onClick=${() => setActiveTab('sheet-builder')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          Sheet Builder
        </button>
      </nav>
      
      <!-- Right side: status + theme toggle -->
      <div class="system-status-indicator">
        <span class="pulse-glowing-dot"></span>
        <span class="status-lbl">Print Engine Active</span>

        <!-- Animated Dark / Light Mode Toggle -->
        <button
          class="theme-toggle-btn"
          onClick=${onToggleTheme}
          aria-label=${isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title=${isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span class="theme-toggle-track">
            <!-- Moon icon (dark side) -->
            <span>🌙</span>
            <!-- Sun icon (light side) -->
            <span>☀️</span>
          </span>
          <span class="theme-toggle-thumb"></span>
        </button>
      </div>
    </header>
  `;
}

