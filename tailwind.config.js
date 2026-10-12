export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: { colors: {
    bg: 'var(--bg)', 'bg-elevated': 'var(--bg-elevated)', surface: 'var(--surface)', 'surface-2': 'var(--surface-2)',
    border: 'var(--border-strong)', text: 'var(--text)', muted: 'var(--text-muted)', faint: 'var(--text-faint)',
    violet: 'var(--accent-1)', cyan: 'var(--accent-2)', success: 'var(--success)', warning: 'var(--warning)', error: 'var(--error)', info: 'var(--info)',
  } } },
  plugins: [],
}
