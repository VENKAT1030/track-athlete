import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  Search,
  Filter,
  Users,
  MessageCircle,
  Eye,
  Award,
  MapPin,
  Building2,
  FileText,
  X,
  Send,
  Check,
  CheckCheck,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  Clock,
  Briefcase
} from 'lucide-react';

export default function CoachConnectionsSection({ currentCoachUser }) {
  const { socket } = useSocket();

  // Discover & Filter States
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedAcademy, setSelectedAcademy] = useState('');

  // Filter options derived from real MongoDB database
  const [sportsOptions, setSportsOptions] = useState([]);
  const [locationsOptions, setLocationsOptions] = useState([]);
  const [academiesOptions, setAcademiesOptions] = useState([]);

  // Profile Modal State
  const [profileModalCoach, setProfileModalCoach] = useState(null);
  const [loadingProfileModal, setLoadingProfileModal] = useState(false);
  const [certViewerModal, setCertViewerModal] = useState(null);

  // Chat State
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);

  // ── 1. Fetch Discoverable Coaches ──────────────────────────────────────────
  const fetchCoaches = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedSport) params.sport = selectedSport;
      if (selectedLocation) params.location = selectedLocation;
      if (selectedAcademy) params.academy = selectedAcademy;

      const res = await api.get('/coach/connections/discover', { params });
      if (res.data) {
        setCoaches(res.data.coaches || []);
        setSportsOptions(res.data.sportsFilter || []);
        setLocationsOptions(res.data.locationsFilter || []);
        setAcademiesOptions(res.data.academiesFilter || []);
      }
    } catch (err) {
      console.error('Error fetching coach connections:', err);
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSport, selectedLocation, selectedAcademy]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  // ── 2. Fetch Conversations ──────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/coach/chats/conversations');
      if (Array.isArray(res.data)) {
        setConversations(res.data);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── 3. Fetch Conversation Messages ─────────────────────────────────────────
  const fetchMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const res = await api.get(`/coach/chats/conversations/${convId}/messages`);
      setMessages(Array.isArray(res.data) ? res.data : []);
      fetchConversations(); // refresh unread count
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, [fetchConversations]);

  // Auto-polling for active chat every 4 seconds (Vercel serverless friendly)
  useEffect(() => {
    if (!activeConversation?._id) return;
    fetchMessages(activeConversation._id);
    const interval = setInterval(() => {
      fetchMessages(activeConversation._id);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeConversation?._id, fetchMessages]);

  // Socket.IO live message listener
  useEffect(() => {
    if (!socket) return;
    const handleIncoming = (data) => {
      if (data?.conversationId && activeConversation?._id === data.conversationId) {
        fetchMessages(data.conversationId);
      } else {
        fetchConversations();
      }
    };
    socket.on('coach-message-received', handleIncoming);
    return () => socket.off('coach-message-received', handleIncoming);
  }, [socket, activeConversation?._id, fetchMessages, fetchConversations]);

  // ── 4. Open Detailed Profile Modal ──────────────────────────────────────────
  const handleOpenProfileModal = async (coachItem) => {
    const coachId = coachItem._id || coachItem.coachId;
    setLoadingProfileModal(true);
    setProfileModalCoach(coachItem);
    try {
      const res = await api.get(`/coach/connections/details/${encodeURIComponent(coachId)}`);
      if (res.data) {
        setProfileModalCoach(res.data);
      }
    } catch (err) {
      console.error('Error fetching coach profile details:', err);
    } finally {
      setLoadingProfileModal(false);
    }
  };

  // ── 5. Start / Open Chat ────────────────────────────────────────────────────
  const handleStartChat = async (recipientCoach) => {
    try {
      const recipientId = recipientCoach._id || recipientCoach.coachId;
      const res = await api.post('/coach/chats/conversations', { recipientCoachId: recipientId });
      if (res.data) {
        setActiveConversation(res.data);
        setShowChatDrawer(true);
        fetchMessages(res.data._id);
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
      alert(err.response?.data?.error || 'Failed to start conversation.');
    }
  };

  // ── 6. Send Message ─────────────────────────────────────────────────────────
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageInput.trim() || !activeConversation?._id || sendingMsg) return;
    const msgText = messageInput.trim();
    setMessageInput('');
    setSendingMsg(true);
    try {
      const res = await api.post(`/coach/chats/conversations/${activeConversation._id}/messages`, {
        message: msgText
      });
      if (res.data) {
        setMessages(prev => [...prev, res.data]);
        fetchConversations();
      }
    } catch (err) {
      console.error('Error sending message:', err);
      alert(err.response?.data?.error || 'Failed to send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  const totalUnreadChatCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* SECTION HEADER & QUICK CHAT BUTTON */}
      <div className="bg-white border border-[#e2e8f0] p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#173235] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2f6d5a]" />
            TrackAthlete Coach Connections & Professional Roster
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Discover real certified TrackAthlete coaches across India. Search by discipline, location, or academy and start direct coach-to-coach conversations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowChatDrawer(!showChatDrawer);
            fetchConversations();
          }}
          className="relative px-4 py-2.5 rounded-xl bg-[#173d3c] hover:bg-[#0c292c] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-sm self-start md:self-auto transition-all"
        >
          <MessageCircle className="w-4 h-4 text-[#b9d9bf]" />
          <span>Coach Messenger</span>
          {totalUnreadChatCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#e07050] text-white animate-pulse">
              {totalUnreadChatCount}
            </span>
          )}
        </button>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, NIS ID..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-[#2f6d5a]"
            />
          </div>

          {/* Sport Filter */}
          <div>
            <select
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-[#2f6d5a] bg-white font-semibold text-gray-700"
            >
              <option value="">-- All Sports ({sportsOptions.length}) --</option>
              {sportsOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-[#2f6d5a] bg-white font-semibold text-gray-700"
            >
              <option value="">-- All Locations ({locationsOptions.length}) --</option>
              {locationsOptions.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Academy Filter */}
          <div>
            <select
              value={selectedAcademy}
              onChange={(e) => setSelectedAcademy(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-[#2f6d5a] bg-white font-semibold text-gray-700"
            >
              <option value="">-- All Academies ({academiesOptions.length}) --</option>
              {academiesOptions.map(ac => (
                <option key={ac} value={ac}>{ac}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Reset Filters button */}
        {(searchQuery || selectedSport || selectedLocation || selectedAcademy) && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedSport('');
                setSelectedLocation('');
                setSelectedAcademy('');
              }}
              className="text-xs text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* DISCOVERABLE COACHES GRID */}
      {loading ? (
        <div className="text-center py-12 bg-white border border-[#e2e8f0] rounded-2xl text-xs text-gray-500">
          Loading discoverable coach connections...
        </div>
      ) : coaches.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#e2e8f0] rounded-2xl space-y-2">
          <Users className="w-10 h-10 text-gray-300 mx-auto" />
          <h4 className="font-bold text-sm text-[#173235]">NO OTHER COACHES FOUND</h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            No registered TrackAthlete coaches match your selected search criteria. Try clearing filters to view available coaches.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coaches.map((c) => {
            const sportsList = c.sports && c.sports.length > 0 ? c.sports : (c.sport ? [c.sport] : []);
            const assignments = c.academyAssignments || [];

            return (
              <div
                key={c._id}
                className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-[#2f6d5a] transition-all"
              >
                <div>
                  {/* Top Badge & Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#eef6f2] text-[#2f6d5a] border border-[#b9d9bf]">
                          ID: {c.coachId || c.trackAthleteId || 'COA-N/A'}
                        </span>
                        {c.nisId && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                            NIS: {c.nisId}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-[#173235] mt-1.5 flex items-center gap-1.5">
                        <span>{c.name}</span>
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" title="Verified TrackAthlete Coach" />
                      </h3>
                    </div>

                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-[#f4f6f4] text-[#173235] border border-[#dce4de] shrink-0">
                      {c.yearsExperience ? `${c.yearsExperience} yrs exp` : 'Certified Coach'}
                    </span>
                  </div>

                  {/* Sports Tags */}
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {sportsList.map((sp, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#173d3c]/10 text-[#173d3c] border border-[#173d3c]/20"
                      >
                        [ {sp} ]
                      </span>
                    ))}
                  </div>

                  {/* Location & Academy Details */}
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-600">
                    {(c.city || c.state) && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#e07050]" />
                        <span>{c.city ? `${c.city}, ` : ''}{c.state || 'India'}</span>
                      </div>
                    )}

                    {assignments.length > 0 ? (
                      <div className="flex items-start gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#2f6d5a] shrink-0 mt-0.5" />
                        <span>
                          Affiliated with: <strong>{assignments.map(a => a.academyName).join(', ')}</strong>
                        </span>
                      </div>
                    ) : c.academyName ? (
                      <div className="flex items-start gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#2f6d5a] shrink-0 mt-0.5" />
                        <span>Academy: <strong>{c.academyName}</strong></span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenProfileModal(c)}
                    className="flex-1 py-1.5 px-3 rounded-xl border border-[#2f6d5a] text-[#2f6d5a] hover:bg-[#f0f7f4] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Profile
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartChat(c)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-[#2f6d5a] hover:bg-[#235344] text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Start Chat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAILED COACH PROFILE MODAL */}
      {profileModalCoach && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-[#2f6d5a] max-w-xl w-full overflow-hidden shadow-2xl space-y-0">
            <div className="p-4 bg-[#173d3c] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#b9d9bf]" />
                <div>
                  <h3 className="text-base font-bold">{profileModalCoach.name}</h3>
                  <p className="text-[11px] text-[#c5d3ce]">
                    Coach ID: {profileModalCoach.coachId || profileModalCoach.trackAthleteId || 'COA-N/A'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalCoach(null)}
                className="p-1 rounded-lg text-[#b9d9bf] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {loadingProfileModal ? (
                <div className="text-center py-8 text-xs text-gray-500">Loading complete coach credentials...</div>
              ) : (
                <>
                  {/* Grid details */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#f8faf8] p-3 rounded-xl border border-gray-200">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Primary Sport</span>
                      <strong className="font-mono text-[#173235] text-sm">
                        {profileModalCoach.sport || (profileModalCoach.sports?.[0] || 'Sports')}
                      </strong>
                    </div>

                    <div className="bg-[#f8faf8] p-3 rounded-xl border border-gray-200">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">NIS Certificate ID</span>
                      <strong className="font-mono text-[#173235] text-sm">
                        {profileModalCoach.nisId || profileModalCoach.nisNumber || 'Not Uploaded'}
                      </strong>
                    </div>

                    <div className="bg-[#f8faf8] p-3 rounded-xl border border-gray-200">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Coaching Experience</span>
                      <strong className="text-[#173235]">
                        {profileModalCoach.yearsExperience || profileModalCoach.yearsOfExperience || 0} Years
                      </strong>
                    </div>

                    <div className="bg-[#f8faf8] p-3 rounded-xl border border-gray-200">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Location</span>
                      <strong className="text-[#173235]">
                        {profileModalCoach.city ? `${profileModalCoach.city}, ` : ''}{profileModalCoach.state || 'India'}
                      </strong>
                    </div>
                  </div>

                  {/* Certifications */}
                  {profileModalCoach.certifications && profileModalCoach.certifications.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-[#2f6d5a]" /> Certifications
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {profileModalCoach.certifications.map((cert, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-lg bg-[#eef6f2] text-[#2f6d5a] font-semibold text-xs border border-[#b9d9bf]">
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bio */}
                  {profileModalCoach.bio && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-1">Professional Bio</h4>
                      <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-200">
                        {profileModalCoach.bio}
                      </p>
                    </div>
                  )}

                  {/* Affiliated Academies */}
                  {profileModalCoach.academyAssignments && profileModalCoach.academyAssignments.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-[#2f6d5a]" /> Linked Sports Academies
                      </h4>
                      <div className="space-y-1.5">
                        {profileModalCoach.academyAssignments.map((a, i) => (
                          <div key={i} className="p-2.5 rounded-xl border border-gray-200 bg-[#fbfdfb] text-xs flex justify-between items-center">
                            <span className="font-bold text-[#173235]">{a.academyName}</span>
                            <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                              {a.sportName} · {a.role || 'Coach'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certificate PDF download */}
                  {profileModalCoach.hasCertificate && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          api.get(`/coach/${profileModalCoach._id || profileModalCoach.coachId}/certificate`)
                            .then(res => {
                              if (res.data?.certificateData) {
                                setCertViewerModal({ title: `${profileModalCoach.name} Certificate`, data: res.data.certificateData });
                              }
                            })
                            .catch(() => alert('Could not load certificate file.'));
                        }}
                        className="w-full py-2 px-3 rounded-xl border border-[#2f6d5a] bg-[#eef6f2] text-[#2f6d5a] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#dcefe5]"
                      >
                        <FileText className="w-4 h-4" /> View NIS Certificate PDF
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setProfileModalCoach(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold cursor-pointer hover:bg-gray-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = profileModalCoach;
                  setProfileModalCoach(null);
                  handleStartChat(target);
                }}
                className="px-4 py-2 rounded-xl bg-[#2f6d5a] text-white text-xs font-bold cursor-pointer hover:bg-[#235344] flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Start Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF VIEWER MODAL */}
      {certViewerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#d8ded5]">
            <div className="p-4 bg-[#173235] text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#cc694e]" /> {certViewerModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setCertViewerModal(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 bg-[#f4f8f5] overflow-auto">
              <iframe
                src={certViewerModal.data}
                className="w-full h-[60vh] border rounded-xl bg-white"
                title="Certificate PDF Viewer"
              />
            </div>
            <div className="p-3 bg-white border-t flex justify-end">
              <button
                type="button"
                onClick={() => setCertViewerModal(null)}
                className="h-9 px-4 rounded-lg bg-[#173235] text-white font-bold text-xs cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COACH-TO-COACH MESSENGER DRAWER */}
      {showChatDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl border-l border-[#2f6d5a] flex flex-col justify-between animate-in slide-in-from-right duration-200">
          {/* Messenger Header */}
          <div className="p-4 bg-[#173d3c] text-white flex items-center justify-between border-b border-[#2f6d5a]">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#b9d9bf]" />
              <div>
                <h3 className="font-bold text-sm">Coach Direct Messenger</h3>
                <p className="text-[10px] text-[#c5d3ce]">End-to-End Direct Messages</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowChatDrawer(false)}
              className="p-1 rounded-lg text-[#b9d9bf] hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conversations Selector Bar */}
          <div className="bg-[#f0f7f4] border-b border-gray-200 p-2 overflow-x-auto flex items-center gap-2 scrollbar-none">
            {conversations.length === 0 ? (
              <span className="text-[11px] text-gray-500 italic px-2">No conversations started yet.</span>
            ) : (
              conversations.map(conv => {
                const isSelected = activeConversation?._id === conv._id;
                const otherName = conv.otherParticipant?.name || 'Coach';
                return (
                  <button
                    key={conv._id}
                    type="button"
                    onClick={() => {
                      setActiveConversation(conv);
                      fetchMessages(conv._id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#2f6d5a] text-white shadow-xs'
                        : 'bg-white text-[#173235] hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <span>{otherName}</span>
                    {conv.unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#e07050] text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Chat Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#fbfdfb]">
            {!activeConversation ? (
              <div className="text-center py-12 text-xs text-gray-500 space-y-2">
                <MessageCircle className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="font-semibold text-[#173235]">Select a conversation or click "Start Chat" on a coach card above.</p>
              </div>
            ) : (
              <>
                {/* Active Receiver Info Banner */}
                <div className="p-2.5 rounded-xl bg-white border border-[#b9d9bf] flex items-center justify-between text-xs text-[#173235] mb-2 shadow-2xs">
                  <div>
                    <span className="font-bold">{activeConversation.otherParticipant?.name || 'Coach'}</span>
                    <span className="text-[10px] text-gray-500 block">
                      ID: {activeConversation.otherParticipant?.coachId || activeConversation.otherParticipant?.trackAthleteId || 'COA-N/A'} · {activeConversation.otherParticipant?.sport || 'Sports'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#2f6d5a] bg-[#eef6f2] px-2 py-0.5 rounded border border-[#b9d9bf]">
                    {activeConversation.otherParticipant?.city || 'India'}
                  </span>
                </div>

                {messages.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-400 italic">
                    No messages in this conversation yet. Send a message below!
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = String(msg.sender) === String(currentCoachUser?._id);
                    const msgTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={msg._id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-xs shadow-2xs ${
                            isMe
                              ? 'bg-[#173d3c] text-white rounded-br-none'
                              : 'bg-white border border-gray-200 text-[#173235] rounded-bl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                          <div className={`mt-1 text-[9px] flex items-center justify-end gap-1 ${isMe ? 'text-[#b9d9bf]' : 'text-gray-400'}`}>
                            <span>{msgTime}</span>
                            {isMe && (
                              msg.read ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Check className="w-3 h-3 text-gray-300" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* Message Input Form */}
          {activeConversation && (
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your message to coach..."
                className="flex-1 px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-[#2f6d5a]"
              />
              <button
                type="submit"
                disabled={sendingMsg || !messageInput.trim()}
                className="px-4 py-2 rounded-xl bg-[#2f6d5a] hover:bg-[#235344] text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
