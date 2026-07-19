import { useEffect, useRef, useState } from 'react'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Flag,
  Send,
  ArrowRight,
} from 'lucide-react'
import Logo from './Logo'
import { formatCountry } from '../data/countries'

const FILTERS = [
  { key: 'none', label: 'Normal', filter: 'none' },
  { key: 'bw', label: 'NB', filter: 'grayscale(100%)' },
  { key: 'sepia', label: 'Sépia', filter: 'sepia(80%)' },
  { key: 'vintage', label: 'Vintage', filter: 'contrast(1.1) saturate(1.3) sepia(30%)' },
  { key: 'vivid', label: 'Vif', filter: 'saturate(1.5) contrast(1.1)' },
]

function VideoCallScreen({
  status,
  partnerId,
  localVideoRef,
  remoteVideoRef,
  localStream,
  isMicOn,
  isCameraOn,
  toggleMic,
  toggleCamera,
  onReport,
  onNext,
  messages,
  onSendMessage,
  onlineCount,
  partnerCountry,
  activeFilter,
  onSelectFilter,
}) {
  const messagesEndRef = useRef(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, localVideoRef])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const waiting = status === 'En attente...' || status === 'Partenaire parti'
  const connected = status === 'Connecté à un partenaire'

  const statusText = connected ? 'Connecté' : waiting ? 'En attente...' : status

  const canSend = connected && partnerId

  const submitMessage = () => {
    const text = message.trim()
    if (!text || !canSend) return
    onSendMessage(text)
    setMessage('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    submitMessage()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitMessage()
    }
  }

  const countryLabel = formatCountry(partnerCountry)

  return (
    <div className="video-call-screen">
      <header className="video-call-header">
        <Logo size="small" variant="dark" />
        <div className="online-badge">
          <span className="online-dot" aria-hidden="true" />
          <span>{onlineCount} en ligne</span>
        </div>
      </header>

      <div className="video-stage">
        <div className="partner-country-badge" aria-label="Pays du partenaire">
          {countryLabel}
        </div>

        {statusText && (
          <div className={`status-badge ${connected ? 'connected' : 'waiting'}`}>
            {statusText}
          </div>
        )}

        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="remote-video"
          style={{ opacity: connected ? 1 : 0 }}
        />

        {waiting && (
          <div className="waiting-overlay">
            <div className="spinner" />
            <p>Recherche d'un partenaire...</p>
          </div>
        )}

        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="local-video"
        />

        <div className="filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`filter-button ${activeFilter === f.key ? 'active' : ''}`}
              onClick={() => onSelectFilter(f.key)}
              aria-label={`Filtre ${f.label}`}
              title={f.label}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="controls-row">
        <button
          className={`control-button ${!isMicOn ? 'off' : ''}`}
          onClick={toggleMic}
          aria-label={isMicOn ? 'Couper le micro' : 'Activer le micro'}
          type="button"
        >
          {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
        </button>

        <button
          className={`control-button ${!isCameraOn ? 'off' : ''}`}
          onClick={toggleCamera}
          aria-label={isCameraOn ? 'Couper la caméra' : 'Activer la caméra'}
          type="button"
        >
          {isCameraOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
        </button>

        <button
          className="control-button report"
          onClick={onReport}
          aria-label="Signaler"
          type="button"
        >
          <Flag size={22} />
        </button>

        <button className="next-button" onClick={onNext} type="button">
          Suivant
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="chat-section">
        <div className="chat-messages">
          {messages.length === 0 && (
            <p className="chat-empty">Aucun message pour l'instant</p>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`chat-bubble ${msg.self ? 'sent' : 'received'}`}
            >
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="chat-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={canSend ? 'Écrire un message...' : 'En attente...'}
            disabled={!canSend}
            enterKeyHint="send"
          />
          <button
            className="chat-send"
            type="submit"
            disabled={!canSend || !message.trim()}
            aria-label="Envoyer"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  )
}

export default VideoCallScreen
