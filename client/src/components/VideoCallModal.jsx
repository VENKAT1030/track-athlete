import React, { useState, useEffect, useRef } from 'react';
import { Camera, CameraOff, Mic, MicOff, PhoneOff, Video, Volume2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function VideoCallModal({ connectionId, recipientName, isIncoming, callData, onClose }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [callState, setCallState] = useState(isIncoming ? 'incoming' : 'calling'); // 'calling', 'incoming', 'connected', 'ended'
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    async function setupLocalMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).catch(() => null);
        if (stream) {
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.error('Media devices error:', err);
      }
    }
    setupLocalMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleStartCall = async () => {
    if (!socket || !connectionId) return;
    try {
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', { connectionId, candidate: event.candidate });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc-call-user', {
        connectionId,
        offer,
        callerName: user?.name || 'User'
      });
      setCallState('calling');
    } catch (err) {
      console.error('Error starting WebRTC call:', err);
    }
  };

  const handleAcceptCall = async () => {
    if (!socket || !callData?.offer) return;
    try {
      setCallState('connected');
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', { connectionId, candidate: event.candidate });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc-answer-call', { connectionId, answer });
    } catch (err) {
      console.error('Error accepting WebRTC call:', err);
    }
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('webrtc-call-answered', async (data) => {
      if (peerConnectionRef.current && data.answer) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallState('connected');
      }
    });

    socket.on('webrtc-ice-candidate', async (data) => {
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      }
    });

    socket.on('webrtc-call-ended', () => {
      endCallCleanup();
    });

    if (!isIncoming) {
      handleStartCall();
    }

    return () => {
      socket.off('webrtc-call-answered');
      socket.off('webrtc-ice-candidate');
      socket.off('webrtc-call-ended');
    };
  }, [socket, connectionId]);

  const endCallCleanup = () => {
    setCallState('ended');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (socket && connectionId) {
      socket.emit('webrtc-end-call', { connectionId });
    }
    onClose();
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOn(videoTrack.enabled);
      }
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(12, 41, 44, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#123130', border: '1px solid #2f6d5a', borderRadius: 20, width: '100%', maxWidth: 720, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Call Header */}
        <div style={{ padding: '16px 20px', background: '#173d3c', borderBottom: '1px solid #2f6d5a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Video size={18} color="#e07050" />
            <span style={{ fontSize: 14, fontWeight: 700 }}>1-on-1 Mentorship Video Session</span>
            <span style={{ fontSize: 11, background: '#2f6d5a', padding: '2px 8px', borderRadius: 12, color: '#b9d9bf' }}>
              {callState === 'calling' ? 'Calling...' : callState === 'incoming' ? 'Incoming Call' : callState === 'connected' ? 'Connected' : 'Ended'}
            </span>
          </div>
          <button onClick={endCallCleanup} style={{ background: 'none', border: 'none', color: '#b9d9bf', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Video Area */}
        <div style={{ position: 'relative', width: '100%', height: '420px', background: '#091e1d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Remote Video Stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Fallback Display if Remote Video is not streaming yet */}
          {callState !== 'connected' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center', gap: 12, background: 'linear-gradient(135deg, #173d3c, #0c292c)' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e2eee4', color: '#194e42', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {recipientName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{recipientName}</div>
                <div style={{ fontSize: 12, color: '#b9d9bf', marginTop: 4 }}>
                  {callState === 'calling' ? 'Waiting for answer...' : 'Mentorship Video Call'}
                </div>
              </div>

              {callState === 'incoming' && (
                <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                  <button onClick={endCallCleanup} style={{ padding: '10px 24px', borderRadius: 12, background: '#e07050', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Decline</button>
                  <button onClick={handleAcceptCall} style={{ padding: '10px 28px', borderRadius: 12, background: '#2f6d5a', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Accept Call</button>
                </div>
              )}
            </div>
          )}

          {/* Local PIP Video */}
          <div style={{ position: 'absolute', bottom: 16, right: 16, width: 140, height: 100, borderRadius: 12, overflow: 'hidden', border: '2px solid #2f6d5a', background: '#000', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>

        {/* Call Controls */}
        <div style={{ padding: 16, background: '#173d3c', borderTop: '1px solid #2f6d5a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <button
            onClick={toggleMic}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: micOn ? '#2f6d5a' : '#e07050', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            title={micOn ? 'Mute Mic' : 'Unmute Mic'}
          >
            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <button
            onClick={toggleCamera}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: cameraOn ? '#2f6d5a' : '#e07050', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            title={cameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {cameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
          </button>

          <button
            onClick={endCallCleanup}
            style={{ height: 44, padding: '0 24px', borderRadius: 22, border: 'none', background: '#e07050', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <PhoneOff size={18} /> End Call
          </button>
        </div>

      </div>
    </div>
  );
}
