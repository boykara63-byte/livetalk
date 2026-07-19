import { useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Flag,
  Send,
} from 'lucide-react'

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
  input,
  setInput,
  onSendMessage,
}) {
  const messagesEndRef = useRef(null)

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

  const statusLabel = connected ? 'Connecté' : waiting ? status : ''

  const handleSubmit = (e) => {
    e.preventDefault()
    onSendMessage()
  }

  return (
    <div className="video-call-screen">
      <div className="video-stage">
        {statusLabel && (
          <div className={`status-badge ${connected ? 'connected' : 'waiting'}`}>
            {statusLabel}
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
      </div>

      <div className="controls-row">
        <button
          className={`control-button ${!isMicOn ? 'off' : ''}`}
          onClick={toggleMic}
          aria-label={isMicOn ? 'Couper le micro' : 'Activer le micro'}
        >
          {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
        </button>

        <button
          className={`control-button ${!isCameraOn ? 'off' : ''}`}
          onClick={toggleCamera}
          aria-label={isCameraOn ? 'Couper la caméra' : 'Activer la caméra'}
        >
          {isCameraOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
        </button>

        <button className="control-button report" onClick={onReport} aria-label="Signaler">
          <Flag size={22} />
        </button>

        <button className="next-button" onClick={onNext}>
          Suivant
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Écrire un message..."
            disabled={!partnerId}
          />
          <button type="submit" disabled={!partnerId || !input.trim()}>
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  )
}

export default VideoCallScreen
