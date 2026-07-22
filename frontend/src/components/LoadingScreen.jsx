function LoadingScreen() {
  return (
    <div className="loading-screen screen-gradient">
      <div className="loading-spinner" aria-label="Chargement" />
      <p className="loading-text">Chargement...</p>
    </div>
  )
}

export default LoadingScreen
