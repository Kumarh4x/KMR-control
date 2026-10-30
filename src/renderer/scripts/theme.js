// Theme Manager for KMR Control

const ThemeManager = {
  currentMode: 'system', // 'system' | 'light' | 'dark'

  async init() {
    // Query saved theme setting from backend
    try {
      if (window.kmrApi && window.kmrApi.getTheme) {
        const themeInfo = await window.kmrApi.getTheme();
        this.applyTheme(themeInfo.mode, themeInfo.resolved);
      } else {
        // Fallback for standalone/preview
        const saved = localStorage.getItem('kmr_theme') || 'system';
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.applyTheme(saved, saved === 'system' ? (prefersDark ? 'dark' : 'light') : saved);
      }
    } catch (e) {
      console.error('[ThemeManager] Init error:', e);
      this.applyTheme('dark', 'dark');
    }

    // Bind segmented control buttons
    const buttons = document.querySelectorAll('[data-theme-btn]');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetMode = btn.getAttribute('data-theme-btn');
        this.setTheme(targetMode);
      });
    });

    // Listen for live system theme updates from main process
    if (window.kmrApi && window.kmrApi.onThemeChanged) {
      window.kmrApi.onThemeChanged(({ mode, resolved }) => {
        this.applyTheme(mode, resolved);
      });
    }
  },

  applyTheme(mode, resolved) {
    this.currentMode = mode;
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-mode', mode);

    // Update active state in segmented control
    const buttons = document.querySelectorAll('[data-theme-btn]');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-theme-btn') === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    try {
      localStorage.setItem('kmr_theme', mode);
    } catch (err) {}
  },

  async setTheme(mode) {
    if (['system', 'light', 'dark'].includes(mode)) {
      if (window.kmrApi && window.kmrApi.setTheme) {
        const result = await window.kmrApi.setTheme(mode);
        this.applyTheme(result.mode, result.resolved);
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
        this.applyTheme(mode, resolved);
      }
    }
  }
};

window.ThemeManager = ThemeManager;
