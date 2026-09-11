import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Label, Badge, useToast } from './ui';
import { Search, HeartHandshake, Eye, Send, X, RefreshCw, Award, MapPin, CheckCircle, ShieldCheck, MessageCircle, AlertCircle } from 'lucide-react';

export default function SponsorDiscoverySection({ athleteProfile, onProfileUpdate }) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('discover'); // 'discover' | 'my-requests' | 'active' | 'preference'

  // Preferences form state
  const [seekingToggle, setSeekingToggle] = useState(Boolean(athleteProfile?.activelySeekingSponsorship || athleteProfile?.seekingSponsorship));
  const [upcomingEvent, setUpcomingEvent] = useState(athleteProfile?.sponsorshipDetails?.upcomingEvent || '');
  const [eventLevel, setEventLevel] = useState(athleteProfile?.sponsorshipDetails?.eventLevel || 'NATIONAL');
  const [expectedEventDate, setExpectedEventDate] = useState(athleteProfile?.sponsorshipDetails?.expectedEventDate ? new Date(athleteProfile.sponsorshipDetails.expectedEventDate).toISOString().split('T')[0] : '');
  const [requirementDesc, setRequirementDesc] = useState(athleteProfile?.sponsorshipDetails?.requirementDescription || athleteProfile?.sponsorshipReason || '');
  const [savingPref, setSavingPref] = useState(false);

  // Discover Sponsors State
  const [sponsors, setSponsors] = useState([]);
  const [loadingSponsors, setLoadingSponsors] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSportFilter, setSelectedSportFilter] = useState('all');
  const [selectedCityFilter, setSelectedCityFilter] = useState('all');

  // Selected Sponsor for Modal & Request
  const [selectedSponsor, setSelectedSponsor] = useState(null);
  const [requestSponsor, setRequestSponsor] = useState(null);

  // Request Form State
  const [reqSport, setReqSport] = useState('');
  const [reqEvent, setReqEvent] = useState('');
  const [reqLevel, setReqLevel] = useState('NATIONAL');
  const [reqDate, setReqDate] = useState('');
  const [reqRequirement, setReqRequirement] = useState('');
  const [reqAmount, setReqAmount] = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  // My Sponsorship Requests State
  const [myRequests, setMyRequests] = useState([]);
  const [loadingMyRequests, setLoadingMyRequests] = useState(false);

  // Direct 1-on-1 Chat State
  const [activeChat, setActiveChat] = useState(null); // { conversationId, otherUser }
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const athleteSports = athleteProfile?.sports && athleteProfile.sports.length > 0
    ? athleteProfile.sports.map(s => s.toUpperCase())
    : (athleteProfile?.sport ? [athleteProfile.sport.toUpperCase()] : ['ATHLETICS']);

  // Update form fields when athleteProfile updates
  useEffect(() => {
    if (athleteProfile) {
      setSeekingToggle(Boolean(athleteProfile.activelySeekingSponsorship || athleteProfile.seekingSponsorship));
      setUpcomingEvent(athleteProfile.sponsorshipDetails?.upcomingEvent || '');
      setEventLevel(athleteProfile.sponsorshipDetails?.eventLevel || 'NATIONAL');
      if (athleteProfile.sponsorshipDetails?.expectedEventDate) {
        setExpectedEventDate(new Date(athleteProfile.sponsorshipDetails.expectedEventDate).toISOString().split('T')[0]);
      }
      setRequirementDesc(athleteProfile.sponsorshipDetails?.requirementDescription || athleteProfile.sponsorshipReason || '');
    }
  }, [athleteProfile]);

  // Fetch real registered sponsors from MongoDB
  const fetchSponsors = useCallback(async () => {
    try {
      setLoadingSponsors(true);
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedSportFilter !== 'all') params.sport = selectedSportFilter;
      if (selectedCityFilter !== 'all') params.city = selectedCityFilter;

      const { data } = await api.get('/sponsor/sponsors', { params });
      setSponsors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching sponsors:', err);
      toast({ title: 'Error', description: 'Failed to fetch registered sponsors.', variant: 'destructive' });
    } finally {
      setLoadingSponsors(false);
    }
  }, [searchQuery, selectedSportFilter, selectedCityFilter, toast]);

  // Fetch athlete's sent requests & active sponsorships
  const fetchMyRequests = useCallback(async () => {
    try {
      setLoadingMyRequests(true);
      const { data } = await api.get('/sponsor/my-requests');
      setMyRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching my sponsorship requests:', err);
    } finally {
      setLoadingMyRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchSponsors();
    fetchMyRequests();
  }, [fetchSponsors, fetchMyRequests]);

  // Save Sponsorship Preferences
  const handleSavePreferences = async (e) => {
    e?.preventDefault();
    try {
      setSavingPref(true);
      const { data } = await api.put('/sponsor/athlete-preference', {
        activelySeekingSponsorship: seekingToggle,
        upcomingEvent,
        eventLevel,
        expectedEventDate,
        requirementDescription: requirementDesc
      });
      toast({ title: 'Preferences Updated', description: 'Your sponsorship requirements & availability were saved.', variant: 'success' });
      if (onProfileUpdate) onProfileUpdate(data);
    } catch (err) {
      toast({ title: 'Save Failed', description: err.response?.data?.error || 'Failed to update preferences.', variant: 'destructive' });
    } finally {
      setSavingPref(false);
    }
  };

  // Open Request Modal for a Sponsor
  const handleOpenRequestModal = (sp) => {
    setRequestSponsor(sp);
    setReqSport(athleteSports[0] || 'ATHLETICS');
    setReqEvent(upcomingEvent || '');
    setReqLevel(eventLevel || 'NATIONAL');
    setReqDate(expectedEventDate || '');
    setReqRequirement(requirementDesc || '');
    setReqAmount('');
    setReqMessage('');
  };

  // Submit Sponsorship Request
  const handleSendRequest = async (e) => {
    e?.preventDefault();
    if (!requestSponsor?._id || submittingReq) return;

    try {
      setSubmittingReq(true);
      await api.post('/sponsor/request', {
        sponsorId: requestSponsor._id,
        sport: reqSport,
        upcomingEvent: reqEvent,
        eventLevel: reqLevel,
        expectedEventDate: reqDate,
        requirementDescription: reqRequirement,
        proposedAmount: reqAmount ? Number(reqAmount) : undefined,
        message: reqMessage
      });

      toast({ title: 'Sponsorship Request Sent! 🎉', description: `Your request was sent to ${requestSponsor.organizationName || requestSponsor.name}.`, variant: 'success' });
      setRequestSponsor(null);
      fetchMyRequests();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to send sponsorship request.';
      toast({ title: 'Request Error', description: msg, variant: 'destructive' });
    } finally {
      setSubmittingReq(false);
    }
  };

  // Start 1-on-1 Direct Chat with Sponsor
  const startChatWithSponsor = async (sponsorUserId, sponsorshipId) => {
    try {
      const { data } = await api.post('/sponsor/chats/conversations', { targetUserId: sponsorUserId, sponsorshipId });
      setActiveChat(data);
      loadMessages(data.conversationId);
    } catch (err) {
      toast({ title: 'Chat Error', description: err.response?.data?.error || 'Could not start chat.', variant: 'destructive' });
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const { data } = await api.get(`/sponsor/chats/conversations/${conversationId}/messages`);
      setChatMessages(Array.isArray(data) ? data : []);
      await api.patch(`/sponsor/chats/conversations/${conversationId}/read`).catch(() => {});
    } catch (err) {
      console.error('Error loading chat messages:', err);
    }
  };

  useEffect(() => {
    if (!activeChat?.conversationId) return;
    const interval = setInterval(() => loadMessages(activeChat.conversationId), 3000);
    return () => clearInterval(interval);
  }, [activeChat?.conversationId]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !activeChat?.conversationId || sendingMsg) return;

    try {
      setSendingMsg(true);
      const { data } = await api.post(`/sponsor/chats/conversations/${activeChat.conversationId}/messages`, {
        message: newMessage.trim()
      });
      setChatMessages(prev => [...prev, data]);
      setNewMessage('');
    } catch (err) {
      toast({ title: 'Failed', description: err.response?.data?.error || 'Message failed.', variant: 'destructive' });
    } finally {
      setSendingMsg(false);
    }
  };

  const activeSponsorships = myRequests.filter(r => r.status === 'ACTIVE' || r.status === 'ACCEPTED');
  const pendingRequests = myRequests.filter(r => r.status === 'PENDING' || r.status === 'Proposed' || r.status === 'NEGOTIATING');

  return (
    <div className="space-y-6">
      {/* NAVIGATION SUB-TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-[#e2eee4] rounded-2xl border border-[#2f6d5a]/30">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'discover'
                ? 'bg-[#173d3c] text-white shadow-xs'
                : 'bg-white text-[#173235] hover:bg-[#d4e6d7]'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 inline mr-1.5 text-[#cc694e]" /> Discover Sponsors ({sponsors.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'my-requests'
                ? 'bg-[#173d3c] text-white shadow-xs'
                : 'bg-white text-[#173235] hover:bg-[#d4e6d7]'
            }`}
          >
            <Send className="w-3.5 h-3.5 inline mr-1.5 text-[#cc694e]" /> My Sent Requests ({myRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-[#173d3c] text-white shadow-xs'
                : 'bg-white text-[#173235] hover:bg-[#d4e6d7]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 inline mr-1.5 text-[#cc694e]" /> Active Sponsorships ({activeSponsorships.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preference')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'preference'
                ? 'bg-[#173d3c] text-white shadow-xs'
                : 'bg-white text-[#173235] hover:bg-[#d4e6d7]'
            }`}
          >
            <Award className="w-3.5 h-3.5 inline mr-1.5 text-[#cc694e]" /> My Sponsorship Requirement
          </button>
        </div>

        <button
          type="button"
          onClick={() => { fetchSponsors(); fetchMyRequests(); }}
          className="px-3 py-1.5 rounded-lg border border-[#d8ded5] bg-white hover:bg-[#f4f8f3] text-xs font-bold text-[#173235] transition flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#194e42]" /> Refresh
        </button>
      </div>

      {/* DISCOVER SPONSORS TAB */}
      {activeTab === 'discover' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-[#cc694e]" /> Registered Corporate & Individual Sponsors
              </CardTitle>
              <CardDescription>
                Discover verified corporate sponsors across India and send direct sponsorship applications for your upcoming championship.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Search by Sponsor Name, ID, or Location</Label>
                  <div className="relative mt-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-[#798e8b]" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. Tata Sports, SPN-1234, Mumbai..."
                      className="pl-9 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Sport Specialization</Label>
                  <select
                    value={selectedSportFilter}
                    onChange={(e) => setSelectedSportFilter(e.target.value)}
                    className="mt-1 w-full h-9 rounded-lg border border-[#d2dad2] bg-white text-xs px-2.5 text-[#173235] focus:outline-none focus:border-[#4a8a70]"
                  >
                    <option value="all">All Sports Supported</option>
                    {athleteSports.map(sp => (
                      <option key={sp} value={sp}>{sp}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SPONSOR CARDS GRID */}
          {loadingSponsors ? (
            <div className="text-center py-12 text-xs text-[#697c7c]">Querying registered sponsors from database…</div>
          ) : sponsors.length === 0 ? (
            <div className="text-center py-12 bg-[#f8faf7] rounded-2xl border border-dashed border-[#d8ded5] space-y-2">
              <HeartHandshake className="w-10 h-10 text-[#8a9d9a] mx-auto" />
              <div className="text-base font-bold text-[#173235]">NO SPONSORS AVAILABLE</div>
              <p className="text-xs text-[#697c7c] max-w-sm mx-auto">
                No corporate sponsors match your current search filters. Check back soon or reset filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sponsors.map((sp) => {
                const isSent = myRequests.some(r => r.sponsor?._id === sp._id && (r.status === 'PENDING' || r.status === 'Proposed' || r.status === 'NEGOTIATING'));

                return (
                  <div key={sp._id} className="p-5 rounded-2xl border border-[#d8ded5] bg-white shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-extrabold text-[#173235] text-base leading-tight">{sp.organizationName || sp.name}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[11px] font-mono bg-[#e2eee4] text-[#194e42] px-2 py-0.5 rounded font-bold">
                              {sp.sponsorId}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] bg-[#e6f4ea] text-[#137333] px-2 py-0.5 rounded-full font-bold">
                              <ShieldCheck className="w-3 h-3 text-[#137333]" /> Verified Sponsor
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-[#526668] space-y-1">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#798e8b]" />
                          {sp.city ? `${sp.city}, ` : ''}{sp.state || 'India'}
                        </p>
                        <p className="flex items-center gap-1.5 font-semibold text-[#194e42]">
                          <Award className="w-3.5 h-3.5 text-[#cc694e]" />
                          Budget Range: {sp.budgetRange || '₹50,000 - ₹5,00,000'}
                        </p>
                      </div>

                      {/* SPORTS SUPPORTED */}
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#798e8b] block mb-1">
                          SPORTS SUPPORTED
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {sp.targetSports && sp.targetSports.length > 0 ? (
                            sp.targetSports.map((spTag, idx) => (
                              <span key={idx} className="text-[10px] font-extrabold uppercase bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]/40 px-2 py-0.5 rounded">
                                [ {spTag} ]
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] font-extrabold uppercase bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]/40 px-2 py-0.5 rounded">
                              [ ALL SPORTS ]
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-[#f0f4f0]">
                      <button
                        type="button"
                        onClick={() => setSelectedSponsor(sp)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-[#d8ded5] bg-white hover:bg-[#f4f8f3] text-xs font-bold text-[#173235] transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#194e42]" /> Profile
                      </button>

                      {isSent ? (
                        <span className="flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-lg bg-[#fef9e7] text-[#9a6c00] border border-[#f0d060] text-xs font-bold">
                          <CheckCircle className="w-3.5 h-3.5" /> REQUEST SENT
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenRequestModal(sp)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-extrabold transition cursor-pointer shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" /> REQUEST SPONSORSHIP
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MY SENT REQUESTS TAB */}
      {activeTab === 'my-requests' && (
        <Card>
          <CardHeader>
            <CardTitle>MY SPONSORSHIP REQUESTS</CardTitle>
            <CardDescription>Track status of sponsorship applications sent to corporate sponsors</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMyRequests ? (
              <div className="text-center py-8 text-xs text-[#697c7c]">Loading sent requests…</div>
            ) : myRequests.length === 0 ? (
              <div className="text-center py-10 bg-[#f8faf7] rounded-xl border border-dashed border-[#d8ded5]">
                <Send className="w-8 h-8 text-[#8a9d9a] mx-auto mb-2" />
                <div className="text-sm font-bold text-[#173235]">NO SPONSORSHIP REQUESTS</div>
                <p className="text-xs text-[#697c7c] mt-1">Browse registered sponsors and submit your first sponsorship application.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myRequests.map((req) => {
                  const spName = req.sponsorProfile?.organizationName || req.sponsor?.organizationName || req.sponsor?.name || 'Sponsor';
                  const spId = req.sponsorProfile?.sponsorId || req.sponsor?.sponsorId || '';

                  return (
                    <div key={req._id} className="p-4 rounded-xl border border-[#d8ded5] bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-[#173235] text-base">{spName}</h4>
                          {spId && <span className="text-[10px] font-mono bg-[#e2eee4] text-[#194e42] px-2 py-0.5 rounded font-bold">{spId}</span>}
                          <Badge className="bg-[#173d3c] text-[#b9d9bf] text-xs">[ {req.sport || 'SPORTS'} ]</Badge>
                        </div>

                        <p className="text-xs text-[#526668] mt-1">
                          Upcoming Event: <strong>{req.upcomingEvent || 'National Championship'}</strong> ({req.eventLevel || 'NATIONAL'})
                          {req.expectedEventDate ? ` · Date: ${new Date(req.expectedEventDate).toLocaleDateString('en-IN')}` : ''}
                        </p>

                        {req.requirementDescription && (
                          <p className="text-xs italic text-[#697c7c] mt-1 bg-[#f8faf7] p-2 rounded border border-[#d8ded5]">
                            "{req.requirementDescription}"
                          </p>
                        )}

                        {req.rejectionNote && (
                          <p className="text-xs text-[#c85c40] bg-[#fff5f2] p-2 rounded border border-[#efcbc3] mt-2 font-medium">
                            Decline Reason: {req.rejectionNote}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {req.status === 'PENDING' || req.status === 'Proposed' ? (
                          <Badge variant="outline" className="bg-[#fef9e7] text-[#9a6c00] border-[#f0d060] font-bold text-xs">PENDING</Badge>
                        ) : req.status === 'ACTIVE' || req.status === 'ACCEPTED' ? (
                          <Badge className="bg-[#e2eee4] text-[#194e42] border-[#2f6d5a] font-bold text-xs">ACTIVE</Badge>
                        ) : req.status === 'REJECTED' ? (
                          <Badge variant="destructive" className="font-bold text-xs">REJECTED</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">{req.status}</Badge>
                        )}

                        <button
                          type="button"
                          onClick={() => startChatWithSponsor(req.sponsor?._id || req.sponsor, req._id)}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#173d3c] text-[#b9d9bf] text-xs font-bold cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Chat
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ACTIVE SPONSORSHIPS TAB */}
      {activeTab === 'active' && (
        <Card>
          <CardHeader>
            <CardTitle>MY SPONSORSHIPS</CardTitle>
            <CardDescription>Verified active corporate sponsors supporting your athletic career</CardDescription>
          </CardHeader>
          <CardContent>
            {activeSponsorships.length === 0 ? (
              <div className="text-center py-10 bg-[#f8faf7] rounded-xl border border-dashed border-[#d8ded5]">
                <ShieldCheck className="w-8 h-8 text-[#8a9d9a] mx-auto mb-2" />
                <div className="text-sm font-bold text-[#173235]">NO ACTIVE SPONSORSHIPS</div>
                <p className="text-xs text-[#697c7c] mt-1">Submit sponsorship applications to active corporate sponsors to gain support.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSponsorships.map((s) => {
                  const spName = s.sponsorProfile?.organizationName || s.sponsor?.organizationName || s.sponsor?.name || 'Sponsor';
                  const spId = s.sponsorProfile?.sponsorId || s.sponsor?.sponsorId || '';

                  return (
                    <div key={s._id} className="p-4 rounded-2xl border border-[#2f6d5a]/40 bg-[#f4f8f5] space-y-3 shadow-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-[#173235] text-base">{spName}</h4>
                          <span className="text-[10px] font-mono bg-[#e2eee4] text-[#194e42] px-2 py-0.5 rounded font-bold">
                            {spId}
                          </span>
                        </div>
                        <Badge className="bg-[#194e42] text-white font-bold text-xs">ACTIVE</Badge>
                      </div>

                      <div className="text-xs text-[#526668] space-y-1">
                        <p>Sport: <strong>[ {s.sport || 'SPORTS'} ]</strong></p>
                        <p>Agreed Support: <strong>{s.supportType || 'Equipment & Championship Support'}</strong></p>
                        {s.amount && <p className="text-[#cc694e] font-extrabold">Agreed Amount: ₹{s.amount.toLocaleString('en-IN')}</p>}
                      </div>

                      <div className="pt-2 border-t border-[#d8ded5] flex justify-end">
                        <button
                          type="button"
                          onClick={() => startChatWithSponsor(s.sponsor?._id || s.sponsor, s._id)}
                          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#173d3c] text-white text-xs font-bold cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> 1-on-1 Direct Chat
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MY REQUIREMENT PREFERENCE FORM TAB */}
      {activeTab === 'preference' && (
        <Card>
          <CardHeader>
            <CardTitle>Actively Seeking Sponsorship Preferences</CardTitle>
            <CardDescription>
              Configure your funding requirement details so registered sponsors can discover your profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSavePreferences} className="space-y-4">
              <div className="p-4 rounded-xl border border-[#d8ded5] bg-[#f8faf7] flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#173235] text-sm">Actively Seeking Sponsorship</h4>
                  <p className="text-xs text-[#526668]">When set to YES, your profile appears in the Sponsor Discovery ledger.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSeekingToggle(!seekingToggle)}
                  className={`px-4 py-1.5 rounded-full text-xs font-extrabold border transition-all cursor-pointer ${
                    seekingToggle
                      ? 'bg-[#194e42] text-white border-[#2f6d5a]'
                      : 'bg-white text-[#798e8b] border-[#d8ded5]'
                  }`}
                >
                  {seekingToggle ? 'YES — SEEKING SPONSORSHIP' : 'NO — NOT SEEKING'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Upcoming Championship / Tournament Event</Label>
                  <Input
                    value={upcomingEvent}
                    onChange={e => setUpcomingEvent(e.target.value)}
                    placeholder="e.g. National Athletics Championship 2026"
                  />
                </div>

                <div>
                  <Label>Event Competition Level</Label>
                  <select
                    value={eventLevel}
                    onChange={e => setEventLevel(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#d2dad2] bg-white text-xs text-[#173235]"
                  >
                    <option value="NATIONAL">NATIONAL</option>
                    <option value="INTERNATIONAL">INTERNATIONAL</option>
                    <option value="STATE">STATE</option>
                    <option value="DISTRICT">DISTRICT</option>
                  </select>
                </div>

                <div>
                  <Label>Expected Event Date</Label>
                  <Input
                    type="date"
                    value={expectedEventDate}
                    onChange={e => setExpectedEventDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Sponsorship Requirement Description</Label>
                <textarea
                  value={requirementDesc}
                  onChange={e => setRequirementDesc(e.target.value)}
                  rows={3}
                  placeholder="Detail your equipment, travel expenses, professional coaching fees, or dietary support requirements..."
                  className="w-full p-3 rounded-lg border border-[#d2dad2] bg-white text-xs text-[#173235] focus:outline-none focus:border-[#4a8a70]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPref}
                  className="h-10 px-6 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-extrabold uppercase tracking-wider shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingPref ? 'Saving…' : 'Save Requirement Specs'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* VIEW SPONSOR PROFILE MODAL */}
      {selectedSponsor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#d8ded5]">
            <div className="p-5 bg-gradient-to-r from-[#173d3c] to-[#0c292c] text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#a5c5bd]">Verified Sponsor Profile</span>
                <h3 className="text-xl font-bold text-white mt-0.5">{selectedSponsor.organizationName || selectedSponsor.name}</h3>
                <p className="text-xs text-[#c5d3ce] font-mono mt-0.5">{selectedSponsor.sponsorId}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSponsor(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#f8faf7] rounded-xl border border-[#d8ded5]">
                  <span className="text-[#697c7c] font-medium block">Location</span>
                  <span className="font-bold text-[#173235]">{selectedSponsor.city || 'India'}, {selectedSponsor.state || ''}</span>
                </div>
                <div className="p-3 bg-[#f8faf7] rounded-xl border border-[#d8ded5]">
                  <span className="text-[#697c7c] font-medium block">Budget Range</span>
                  <span className="font-bold text-[#194e42]">{selectedSponsor.budgetRange || '₹50,000 - ₹5,00,000'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#173235] mb-1.5">Sports Supported</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSponsor.targetSports && selectedSponsor.targetSports.length > 0 ? (
                    selectedSponsor.targetSports.map((spTag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-[#e2eee4] text-[#194e42]">
                        [ {spTag} ]
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-xs bg-[#e2eee4] text-[#194e42]">
                      [ ALL SPORTS ]
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#f8faf7] border-t border-[#d8ded5] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedSponsor(null)}
                className="h-9 px-4 rounded-lg border border-[#d8ded5] bg-white text-xs font-bold text-[#173235] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetSp = selectedSponsor;
                  setSelectedSponsor(null);
                  handleOpenRequestModal(targetSp);
                }}
                className="h-9 px-5 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-extrabold uppercase cursor-pointer"
              >
                Request Sponsorship
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST SPONSORSHIP FORM MODAL */}
      {requestSponsor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-[#d8ded5]">
            <div className="p-5 bg-gradient-to-r from-[#173d3c] to-[#0c292c] text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#a5c5bd]">New Sponsorship Request</span>
                <h3 className="text-lg font-bold text-white mt-0.5">Sponsor: {requestSponsor.organizationName || requestSponsor.name}</h3>
                <p className="text-xs text-[#c5d3ce] font-mono mt-0.5">{requestSponsor.sponsorId}</p>
              </div>
              <button
                type="button"
                onClick={() => setRequestSponsor(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendRequest} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label required>Select Sport</Label>
                  <select
                    value={reqSport}
                    onChange={e => setReqSport(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#d2dad2] bg-white text-xs px-2.5 text-[#173235]"
                  >
                    {athleteSports.map(sp => (
                      <option key={sp} value={sp}>{sp}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label required>Event Competition Level</Label>
                  <select
                    value={reqLevel}
                    onChange={e => setReqLevel(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#d2dad2] bg-white text-xs px-2.5 text-[#173235]"
                  >
                    <option value="NATIONAL">NATIONAL</option>
                    <option value="INTERNATIONAL">INTERNATIONAL</option>
                    <option value="STATE">STATE</option>
                    <option value="DISTRICT">DISTRICT</option>
                  </select>
                </div>

                <div>
                  <Label>Upcoming Event / Championship Name</Label>
                  <Input
                    value={reqEvent}
                    onChange={e => setReqEvent(e.target.value)}
                    placeholder="e.g. National Athletics Championship 2026"
                  />
                </div>

                <div>
                  <Label>Expected Event Date</Label>
                  <Input
                    type="date"
                    value={reqDate}
                    onChange={e => setReqDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label required>Sponsorship Support Requirement</Label>
                <Input
                  value={reqRequirement}
                  onChange={e => setReqRequirement(e.target.value)}
                  placeholder="e.g. Flight travel & equipment support"
                />
              </div>

              <div>
                <Label>Proposed Amount (INR)</Label>
                <Input
                  type="number"
                  value={reqAmount}
                  onChange={e => setReqAmount(e.target.value)}
                  placeholder="e.g. 50000"
                />
              </div>

              <div>
                <Label>Personal Message to Sponsor</Label>
                <textarea
                  value={reqMessage}
                  onChange={e => setReqMessage(e.target.value)}
                  rows={3}
                  placeholder="Write a message explaining your championship goals and how their support will impact your performance..."
                  className="w-full p-2.5 rounded-lg border border-[#d2dad2] bg-white text-xs text-[#173235] focus:outline-none focus:border-[#4a8a70]"
                />
              </div>

              <div className="p-3 bg-[#f8faf7] border border-[#d8ded5] rounded-xl flex items-center justify-between">
                <span className="text-xs text-[#526668]">Logged-in Athlete:</span>
                <span className="font-bold text-[#173235]">{athleteProfile?.name} ({athleteProfile?.athleteId || 'ATH-N/A'})</span>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRequestSponsor(null)}
                  className="h-9 px-4 rounded-lg border border-[#d8ded5] bg-white text-xs font-bold text-[#173235] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReq}
                  className="h-9 px-5 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-extrabold uppercase cursor-pointer disabled:opacity-50"
                >
                  {submittingReq ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING DIRECT 1-ON-1 CHAT DRAWER */}
      {activeChat && (
        <div className="fixed bottom-4 right-4 z-50 w-96 maxWidth-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl border border-[#2f6d5a] overflow-hidden flex flex-col h-[480px]">
          <div className="p-3 bg-[#173d3c] text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#2f6d5a] flex items-center justify-center text-white text-xs font-bold">
                {activeChat.otherUser?.organizationName?.charAt(0) || activeChat.otherUser?.name?.charAt(0) || 'S'}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white line-clamp-1">{activeChat.otherUser?.organizationName || activeChat.otherUser?.name || 'Sponsor Chat'}</h4>
                <p className="text-[10px] text-[#a5c5bd]">1-on-1 Direct Chat</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveChat(null)}
              className="p-1 rounded hover:bg-white/10 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 p-3 bg-[#f8faf7] overflow-y-auto space-y-2 text-xs">
            {chatMessages.length === 0 ? (
              <div className="text-center py-10 text-[#798e8b]">
                <MessageCircle className="w-6 h-6 mx-auto mb-1 opacity-50" />
                <p>No messages yet. Send a greeting to initiate conversation.</p>
              </div>
            ) : (
              chatMessages.map((msg, index) => {
                const isMine = msg.sender?.toString() === athleteProfile?._id?.toString();
                return (
                  <div key={msg._id || index} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] p-2.5 rounded-xl text-xs ${
                        isMine
                          ? 'bg-[#173d3c] text-white rounded-br-none'
                          : 'bg-white text-[#173235] border border-[#d8ded5] rounded-bl-none shadow-2xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                      <span className={`text-[9px] block mt-1 text-right ${isMine ? 'text-[#a5c5bd]' : 'text-[#798e8b]'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-2.5 bg-white border-t border-[#d8ded5] flex items-center gap-2 shrink-0">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Write direct message…"
              className="flex-1 text-xs h-9"
            />
            <button
              type="submit"
              disabled={sendingMsg || !newMessage.trim()}
              className="h-9 w-9 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
