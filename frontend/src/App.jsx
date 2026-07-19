import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import AgeGateScreen from './components/AgeGateScreen'
import StartScreen from './components/StartScreen'
import VideoCallScreen from './components/VideoCallScreen'
import { EFFECTS, loadFaceLandmarker, drawEffect } from './effects/faceEffects'
import './theme.css'
import './App.css'

const DEVICE_ID_KEY = 'livetalk-device-id'
const AGE_VERIFIED_KEY = 'livetalk-age-verified'

const ICE_SERVERS = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:standard.relay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:standard.relay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

function getOrCreateDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id =
        (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function App() {
  const deviceIdRef = useRef(getOrCreateDeviceId())
  const socketRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const pendingCandidatesRef = useRef([])
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const canvasRef = useRef(null)
  const canvasStreamRef = useRef(null)
  const videoElementRef = useRef(null)
  const rafIdRef = useRef(null)
  const faceLandmarkerRef = useRef(null)
  const faceLandmarkResultRef = useRef(null)
  const lastDetectionTimeRef = useRef(0)
  const videoSenderRef = useRef(null)
  const activeEffectRef = useRef('none')

  const [status, setStatus] = useState('Déconnecté')
  const [partnerId, setPartnerId] = useState(null)
  const [partnerDeviceId, setPartnerDeviceId] = useState(null)
  const [partnerCountry, setPartnerCountry] = useState(null)
  const [messages, setMessages] = useState([])
  const [rawStream, setRawStream] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [mediaReady, setMediaReady] = useState(false)
  const [mediaError, setMediaError] = useState(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [hasJoined, setHasJoined] = useState(false)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [activeEffect, setActiveEffect] = useState('none')
  const [faceEffectsReady, setFaceEffectsReady] = useState(false)
  const [faceEffectsError, setFaceEffectsError] = useState(false)
  const [ageVerified, setAgeVerified] = useState(() => {
    try {
      return localStorage.getItem(AGE_VERIFIED_KEY) === 'true'
    } catch {
      return false
    }
  })

  const socketUrl = import.meta.env.VITE_SOCKET_URL || 'https://livetalk-hlii.onrender.com'

  if (!import.meta.env.VITE_SOCKET_URL) {
    console.warn('[Socket] VITE_SOCKET_URL not set; using fallback Render URL')
  }

  useEffect(() => {
    if (!ageVerified) return

    let stream = null
    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24 },
      },
      audio: true,
    }

    console.log('[Media] Requesting getUserMedia...')
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((s) => {
        stream = s
        localStreamRef.current = s
        setRawStream(s)
        setMediaReady(true)
        console.log('[Media] getUserMedia success')
      })
      .catch((err) => {
        console.error('[Media] getUserMedia error', err)
        setMediaError(err.message)
      })

    return () => {
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [ageVerified])

  useEffect(() => {
    activeEffectRef.current = activeEffect
  }, [activeEffect])

  const replaceVideoTrack = (track) => {
    if (!peerConnectionRef.current || !track) return
    const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === 'video')
    if (sender) {
      sender.replaceTrack(track).catch((err) => {
        console.error('[WebRTC] replaceTrack failed:', err)
      })
    }
  }

  useEffect(() => {
    if (!rawStream) return

    let cancelled = false

    const video = document.createElement('video')
    video.srcObject = rawStream
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    video.play().catch(() => {})
    videoElementRef.current = video

    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')
    const canvasStream = canvas.captureStream(24)
    canvasStreamRef.current = canvasStream

    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...rawStream.getAudioTracks(),
    ])
    setLocalStream(combinedStream)

    loadFaceLandmarker()
      .then((fl) => {
        if (cancelled) return
        faceLandmarkerRef.current = fl
        setFaceEffectsReady(true)
        console.log('[FaceEffects] FaceLandmarker loaded')
      })
      .catch((err) => {
        console.error('[FaceEffects] Could not load FaceLandmarker:', err)
        setFaceEffectsError(true)
      })

    const DETECTION_INTERVAL_MS = 66 // ~15 FPS

    let rafId
    const draw = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        ctx.filter = 'none'
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const fl = faceLandmarkerRef.current
        const now = performance.now()
        if (fl && now - lastDetectionTimeRef.current >= DETECTION_INTERVAL_MS) {
          try {
            const result = fl.detectForVideo(video, now)
            faceLandmarkResultRef.current = result
            lastDetectionTimeRef.current = now
          } catch (err) {
            console.error('[FaceEffects] detection error:', err)
          }
        }

        const result = faceLandmarkResultRef.current
        const landmarks = result?.faceLandmarks?.[0]
        if (landmarks) {
          drawEffect(ctx, landmarks, activeEffectRef.current, canvas.width, canvas.height)
        }
      }
      rafId = requestAnimationFrame(draw)
      rafIdRef.current = rafId
    }
    draw()

    replaceVideoTrack(canvasStream.getVideoTracks()[0])

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      video.pause()
      video.srcObject = null
      canvasStream.getTracks().forEach((track) => track.stop())
      canvasStreamRef.current = null
      canvasRef.current = null
      rafIdRef.current = null
      faceLandmarkerRef.current = null
      faceLandmarkResultRef.current = null
    }
  }, [rawStream])

  const closePeerConnection = () => {
    pendingCandidatesRef.current = []
    videoSenderRef.current = null
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    if (!socketUrl) {
      console.error('[Socket] VITE_SOCKET_URL is not defined')
      return
    }

    console.log('[Socket] Connecting to', socketUrl)
    const socket = io(socketUrl, { autoConnect: false })
    socketRef.current = socket

    const createPeerConnection = () => {
      console.log(
        '[WebRTC] createPeerConnection, iceServers:',
        ICE_SERVERS.map((s) => ({ ...s, credential: s.credential ? '***' : undefined }))
      )
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      peerConnectionRef.current = pc

      const sendTracks = []
      if (canvasStreamRef.current) {
        sendTracks.push(...canvasStreamRef.current.getVideoTracks())
      } else if (localStreamRef.current) {
        sendTracks.push(...localStreamRef.current.getVideoTracks())
      }
      if (localStreamRef.current) {
        sendTracks.push(...localStreamRef.current.getAudioTracks())
      }
      const sendStream = new MediaStream(sendTracks)
      sendStream.getTracks().forEach((track) => {
        pc.addTrack(track, sendStream)
      })

      const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (videoSender) {
        videoSenderRef.current = videoSender
        const canvasTrack = canvasStreamRef.current?.getVideoTracks()[0]
        if (canvasTrack) {
          videoSender.replaceTrack(canvasTrack).catch((err) => console.error('[WebRTC] replaceTrack error:', err))
        }
      }

      pc.ontrack = (event) => {
        console.log('[WebRTC] remote track received', event.streams)
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          console.log('[WebRTC] sending ICE candidate')
          socketRef.current.emit('webrtc-ice-candidate', { candidate: event.candidate })
        }
      }

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', pc.iceConnectionState)
      }

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] connection state:', pc.connectionState)
      }

      return pc
    }

    const addPendingCandidates = async (pc) => {
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift()
        try {
          await pc.addIceCandidate(candidate)
        } catch (err) {
          console.error('[WebRTC] Error adding pending ICE candidate', err)
        }
      }
    }

    socket.on('connect', () => {
      console.log('[Socket] connected, id:', socket.id)
    })

    socket.on('online-count', (count) => {
      console.log('[Socket] online-count received:', count)
      setOnlineCount(count)
    })

    socket.on('join-error', ({ reason, message }) => {
      console.error('[Socket] join-error:', reason, message)
      setStatus(`Erreur : ${message}`)
      setPartnerId(null)
      setPartnerDeviceId(null)
      setHasJoined(false)
      if (reason === 'not-verified') {
        try {
          localStorage.removeItem(AGE_VERIFIED_KEY)
        } catch {}
        setAgeVerified(false)
      }
    })

    socket.on('matched', async ({ partnerId, partnerDeviceId, partnerCountry, initiator }) => {
      console.log('[Socket] matched', { partnerId, partnerDeviceId, partnerCountry, initiator })
      setPartnerId(partnerId)
      setPartnerDeviceId(partnerDeviceId)
      setPartnerCountry(partnerCountry || null)
      setStatus('Connecté à un partenaire')

      const pc = createPeerConnection()
      if (initiator) {
        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          console.log('[WebRTC] offer created, sending')
          socket.emit('webrtc-offer', { offer })
        } catch (err) {
          console.error('[WebRTC] Error creating offer', err)
        }
      }
    })

    socket.on('partner-left', () => {
      console.log('[Socket] partner-left')
      setPartnerId(null)
      setPartnerDeviceId(null)
      setPartnerCountry(null)
      closePeerConnection()
      setStatus('Partenaire parti')
      setTimeout(() => {
        setStatus('En attente...')
        console.log('[Socket] re-joining queue after partner left')
        socket.emit('join-queue', { deviceId: deviceIdRef.current })
      }, 500)
    })

    socket.on('chat-message', (text) => {
      console.log('[Chat] received:', text)
      setMessages((prev) => [...prev, { text, self: false }])
    })

    socket.on('webrtc-offer', async ({ offer }) => {
      console.log('[WebRTC] offer received')
      const pc = peerConnectionRef.current || createPeerConnection()
      try {
        await pc.setRemoteDescription(offer)
        await addPendingCandidates(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        console.log('[WebRTC] answer created, sending')
        socket.emit('webrtc-answer', { answer })
      } catch (err) {
        console.error('[WebRTC] Error handling offer', err)
      }
    })

    socket.on('webrtc-answer', async ({ answer }) => {
      console.log('[WebRTC] answer received')
      const pc = peerConnectionRef.current
      if (!pc) return
      try {
        await pc.setRemoteDescription(answer)
        await addPendingCandidates(pc)
      } catch (err) {
        console.error('[WebRTC] Error setting remote answer', err)
      }
    })

    socket.on('webrtc-ice-candidate', async ({ candidate }) => {
      console.log('[WebRTC] ICE candidate received')
      const pc = peerConnectionRef.current
      if (pc) {
        try {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate)
          } else {
            pendingCandidatesRef.current.push(candidate)
          }
        } catch (err) {
          console.error('[WebRTC] Error adding ICE candidate', err)
        }
      } else {
        pendingCandidatesRef.current.push(candidate)
      }
    })

    socket.connect()

    return () => {
      closePeerConnection()
      socket.disconnect()
    }
  }, [socketUrl])

  const handleAgeVerified = () => {
    try {
      localStorage.setItem(AGE_VERIFIED_KEY, 'true')
    } catch {}
    setAgeVerified(true)
  }

  const joinQueue = () => {
    closePeerConnection()
    console.log('[Socket] emit join-queue, deviceId:', deviceIdRef.current)
    socketRef.current?.emit('join-queue', { deviceId: deviceIdRef.current })
    setStatus('En attente...')
    setPartnerId(null)
    setPartnerDeviceId(null)
  }

  const handleStart = () => {
    setMessages([])
    setHasJoined(true)
    joinQueue()
  }

  const handleNext = () => {
    setMessages([])
    closePeerConnection()
    console.log('[Socket] emit next')
    socketRef.current?.emit('next')
    setStatus('En attente...')
    setPartnerId(null)
    setPartnerDeviceId(null)
    setPartnerCountry(null)
  }

  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsMicOn(audioTrack.enabled)
    }
  }

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setIsCameraOn(videoTrack.enabled)
    }
  }

  const handleReport = async () => {
    if (!partnerDeviceId) return
    if (!window.confirm('Signaler cet utilisateur ?')) return
    console.log('[Report] reporting partnerDeviceId:', partnerDeviceId)
    try {
      await fetch(`${socketUrl}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterDeviceId: deviceIdRef.current,
          reportedDeviceId: partnerDeviceId,
          reason: 'Signalement utilisateur',
        }),
      })
    } catch (err) {
      console.error('[Report] Error', err)
    }
  }

  const sendMessage = (text) => {
    const trimmed = text?.trim()
    if (!trimmed || !partnerId) return

    console.log('[Chat] sending:', trimmed)
    socketRef.current?.emit('chat-message', trimmed)
    setMessages((prev) => [...prev, { text: trimmed, self: true }])
  }

  const handleSelectEffect = (key) => {
    setActiveEffect(key)
  }

  return (
    <div className="app">
      <main className="app-main">
        {!ageVerified ? (
          <AgeGateScreen socketUrl={socketUrl} deviceId={deviceIdRef.current} onVerified={handleAgeVerified} />
        ) : (
          <>
            {!mediaReady && !mediaError && (
              <p className="media-loading">Activation caméra/micro...</p>
            )}
            {mediaError && (
              <p className="media-error">Erreur caméra/micro : {mediaError}</p>
            )}

            {!hasJoined ? (
              <StartScreen onStart={handleStart} disabled={!mediaReady} onlineCount={onlineCount} />
            ) : (
              <VideoCallScreen
                status={status}
                partnerId={partnerId}
                localVideoRef={localVideoRef}
                remoteVideoRef={remoteVideoRef}
                localStream={localStream}
                isMicOn={isMicOn}
                isCameraOn={isCameraOn}
                toggleMic={toggleMic}
                toggleCamera={toggleCamera}
                onReport={handleReport}
                onNext={handleNext}
                messages={messages}
                onSendMessage={sendMessage}
                onlineCount={onlineCount}
                partnerCountry={partnerCountry}
                activeEffect={activeEffect}
                effects={EFFECTS}
                onSelectEffect={handleSelectEffect}
                faceEffectsReady={faceEffectsReady}
                faceEffectsError={faceEffectsError}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
