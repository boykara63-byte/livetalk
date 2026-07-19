function Logo({ size = 'small', variant = 'dark' }) {
  const liveColor = variant === 'light' ? 'var(--color-white)' : 'var(--color-ink)'

  return (
    <div className={`logo logo--${size}`}>
      <svg
        className="logo-icon"
        style={{ color: liveColor }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="6" width="13" height="12" rx="2" ry="2" />
        <path d="M17 10l5-3v10l-5-3V10z" />
      </svg>
      <span className="logo-text">
        <span className="logo-live" style={{ color: liveColor }}>
          Live
        </span>
        <span className="logo-talk">Talk</span>
      </span>
    </div>
  )
}

export default Logo
