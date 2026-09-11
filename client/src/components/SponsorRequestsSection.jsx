import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Label, Badge, useToast } from './ui';
import { Eye, Check, X, MessageCircle, ShieldCheck, Award, HeartHandshake, RefreshCw, Send, Calendar } from 'lucide-react';
import AthleteProfileModal from './AthleteProfileModal';

export default function SponsorRequestsSection({ currentSponsorUser }) {
  const { toast } = useToast();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' | 'active'

  // Selected Athlete Profile Modal
  const [selectedAthlete, setSelectedAthlete] = useState(null);

  // Accept/Reject Action Modal
  const [actionModal, setActionModal] = useState(null); // { reqId, actionType: 'accept' | 'reject', athleteName }
  const [agreedAmount, setAgreedAmount] = useState('');
  const [supportType, setSupportType] = useState('Equipment & Travel Support');
  const [rejectionNote, setRejectionNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Direct 1-on-1 Chat State
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Fetch incoming sponsorship requests from backend
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/sponsor/incoming-requests');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching incoming sponsorship requests:', err);
      toast({ title: 'Error', description: 'Failed to load sponsorship requests.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Handle Accept or Reject Sponsorship Request
  const handleConfirmAction = async (e) => {
    e?.preventDefault();
    if (!actionModal?.reqId || submittingAction) return;

    try {
      setSubmittingAction(true);
      const newStatus = actionModal.actionType === 'accept' ? 'ACTIVE' : 'REJECTED';
      await api.put(`/sponsor/requests/${actionModal.reqId}`, {
        status: newStatus,
        amount: agreedAmount ? Number(agreedAmount) : undefined,
        supportType,
        rejectionNote: actionModal.actionType === 'reject' ? rejectionNote : undefined
      });

      toast({
        title: actionModal.actionType === 'accept' ? 'Sponsorship Accepted! 🎉' : 'Request Declined',
        description: `Sponsorship status updated for ${actionModal.athleteName}.`,
        variant: actionModal.actionType === 'accept' ? 'success' : 'destructive'
      });

      setActionModal(null);
      fetchRequests();
    } catch (err) {
      toast({ title: 'Action Failed', description: err.response?.data?.error || 'Failed to update request.', variant: 'destructive' });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Start 1-on-1 Direct Chat
  const startChatWithAthlete = async (athleteUserId, sponsorshipId) => {
    try {
      const { data } = await api.post('/sponsor/chats/conversations', { targetUserId: athleteUserId, sponsorshipId });
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
      toast({ title: 'Failed', description: err.response?.data?.error || 'Message failed to send.', variant: 'destructive' });
    } finally {
      setSendingMsg(false);
    }
  };

  const incomingRequests = requests.filter(r => r.status === 'PENDING' || r.status === 'Proposed' || r.status === 'NEGOTIATING');
  const activeSponsoredAthletes = requests.filter(r => r.status === 'ACTIVE' || r.status === 'ACCEPTED');

  return (
    <div className="space-y-6">
      {/* SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-[#e2eee4] rounded-2xl border border-[#2f6d5a]/30">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'incoming'
                ? 'bg-[#173d3c] text-white shadow-xs'
                : 'bg-white text-[#173235] hover:bg-[#d4e6d7]'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 inline mr-1.5 text-[#cc694e]" /> Incoming Requests ({incomingRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'active'
                ? 'bg-[#173d3c] text-white shadow-xs'
                : 'bg-white text-[#173235] hover:bg-[#d4e6d7]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 inline mr-1.5 text-[#cc694e]" /> Active Sponsored Athletes ({activeSponsoredAthletes.length})
          </button>
        </div>

        <button
          type="button"
          onClick={fetchRequests}
          className="px-3 py-1.5 rounded-lg border border-[#d8ded5] bg-white hover:bg-[#f4f8f3] text-xs font-bold text-[#173235] transition flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#194e42]" /> Refresh Ledger
        </button>
      </div>

      {/* INCOMING REQUESTS TAB */}
      {activeTab === 'incoming' && (
        <Card>
          <CardHeader>
            <CardTitle>SPONSORSHIP REQUESTS</CardTitle>
            <CardDescription>Review athlete applications submitted directly to your corporate sponsorship program</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-xs text-[#697c7c]">Loading incoming sponsorship requests…</div>
            ) : incomingRequests.length === 0 ? (
              <div className="text-center py-10 bg-[#f8faf7] rounded-xl border border-dashed border-[#d8ded5]">
                <HeartHandshake className="w-8 h-8 text-[#8a9d9a] mx-auto mb-2" />
                <div className="text-sm font-bold text-[#173235]">NO SPONSORSHIP REQUESTS</div>
                <p className="text-xs text-[#697c7c] mt-1">Direct applications submitted by athletes will appear here dynamically.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incomingRequests.map((req) => {
                  const ath = req.athleteProfile || {};
                  const athName = ath.name || req.athlete?.name || 'Athlete';
                  const athId = ath.athleteId || req.athlete?.athleteId || '';
                  const athSport = req.sport || ath.sport || 'SPORTS';
                  const athCity = ath.city || req.athlete?.city || 'Vijayawada';
                  const athState = ath.state || req.athlete?.state || 'Andhra Pradesh';

                  return (
                    <div key={req._id} className="p-5 rounded-2xl border border-[#d8ded5] bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-[#173235] text-base">{athName}</h4>
                          {athId && <span className="text-[11px] font-mono bg-[#e2eee4] text-[#194e42] px-2 py-0.5 rounded font-bold">{athId}</span>}
                          <Badge className="bg-[#e2eee4] text-[#194e42] border-[#2f6d5a] text-xs">[ {athSport} ]</Badge>
                          <span className="text-xs text-[#526668]">· {athCity}, {athState}</span>
                        </div>

                        <div className="text-xs text-[#526668]">
                          Upcoming Championship: <strong>{req.upcomingEvent || 'National Championship'}</strong> ({req.eventLevel || 'NATIONAL'})
                          {req.expectedEventDate ? ` · Target Date: ${new Date(req.expectedEventDate).toLocaleDateString('en-IN')}` : ''}
                        </div>

                        {req.requirementDescription && (
                          <div className="text-xs text-[#173235] bg-[#f4f8f3] p-2.5 rounded-xl border border-[#d8ded5]">
                            <span className="text-[#526668] font-bold text-[10px] uppercase block">Target Requirement</span>
                            <span className="font-semibold text-[#194e42]">{req.requirementDescription}</span>
                          </div>
                        )}

                        {req.message && (
                          <p className="text-xs italic text-[#697c7c]">
                            "{req.message}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedAthlete(ath)}
                          className="inline-flex items-center gap-1 h-9 px-3.5 rounded-lg border border-[#d8ded5] bg-white hover:bg-[#f4f8f3] text-xs font-bold text-[#173235]"
                        >
                          <Eye size={14} /> View Athlete
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActionModal({ reqId: req._id, actionType: 'reject', athleteName: athName });
                            setRejectionNote('');
                          }}
                          className="inline-flex items-center gap-1 h-9 px-3.5 rounded-lg border border-[#e0705040] bg-[#fff5f2] text-xs font-bold text-[#c85c40]"
                        >
                          <X size={14} /> Decline
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActionModal({ reqId: req._id, actionType: 'accept', athleteName: athName });
                            setAgreedAmount(req.proposedAmount ? String(req.proposedAmount) : '50000');
                            setSupportType('Equipment & Travel Support');
                          }}
                          className="inline-flex items-center gap-1 h-9 px-4 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-extrabold shadow-sm"
                        >
                          <Check size={14} /> Accept Intent
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

      {/* ACTIVE SPONSORED ATHLETES TAB */}
      {activeTab === 'active' && (
        <Card>
          <CardHeader>
            <CardTitle>SPONSORED ATHLETES</CardTitle>
            <CardDescription>Athletes currently supported under your corporate sponsorship portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            {activeSponsoredAthletes.length === 0 ? (
              <div className="text-center py-10 bg-[#f8faf7] rounded-xl border border-dashed border-[#d8ded5]">
                <ShieldCheck className="w-8 h-8 text-[#8a9d9a] mx-auto mb-2" />
                <div className="text-sm font-bold text-[#173235]">NO ACTIVE SPONSORED ATHLETES</div>
                <p className="text-xs text-[#697c7c] mt-1">Accept incoming sponsorship applications to build your sponsored athlete ledger.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSponsoredAthletes.map((s) => {
                  const ath = s.athleteProfile || {};
                  const athName = ath.name || s.athlete?.name || 'Athlete';
                  const athId = ath.athleteId || s.athlete?.athleteId || '';
                  const athSport = s.sport || ath.sport || 'SPORTS';

                  return (
                    <div key={s._id} className="p-4 rounded-2xl border border-[#2f6d5a]/40 bg-[#f4f8f5] space-y-3 shadow-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-[#173235] text-base">{athName}</h4>
                          <span className="text-[10px] font-mono bg-[#e2eee4] text-[#194e42] px-2 py-0.5 rounded font-bold">
                            {athId}
                          </span>
                        </div>
                        <Badge className="bg-[#194e42] text-white font-bold text-xs">ACTIVE</Badge>
                      </div>

                      <div className="text-xs text-[#526668] space-y-1">
                        <p>Sport Discipline: <strong>[ {athSport} ]</strong></p>
                        <p>Support Commit: <strong>{s.supportType || 'Equipment & Championship Support'}</strong></p>
                        {s.amount && <p className="text-[#cc694e] font-extrabold">Agreed Funding: ₹{s.amount.toLocaleString('en-IN')}</p>}
                      </div>

                      <div className="pt-2 border-t border-[#d8ded5] flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() => setSelectedAthlete(ath)}
                          className="text-xs font-bold text-[#194e42] hover:underline flex items-center gap-1"
                        >
                          <Eye size={13} /> View Full Athlete Portfolio
                        </button>
                        <button
                          type="button"
                          onClick={() => startChatWithAthlete(s.athlete?._id || s.athlete, s._id)}
                          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[#173d3c] text-white text-xs font-bold cursor-pointer"
                        >
                          <MessageCircle size={13} /> 1-on-1 Direct Chat
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

      {/* ATHLETE AUTHORITATIVE PROFILE MODAL */}
      {selectedAthlete && (
        <AthleteProfileModal
          athlete={selectedAthlete}
          isOpen={Boolean(selectedAthlete)}
          onClose={() => setSelectedAthlete(null)}
          isAlreadyConnected={true}
          onOpenChat={() => {
            const athId = selectedAthlete._id;
            setSelectedAthlete(null);
            startChatWithAthlete(athId);
          }}
        />
      )}

      {/* ACCEPT / REJECT ACTION MODAL */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-[#d8ded5]">
            <h3 className="font-bold text-base text-[#173235]">
              {actionModal.actionType === 'accept' ? `Accept Sponsorship for ${actionModal.athleteName}` : `Decline Request from ${actionModal.athleteName}`}
            </h3>

            {actionModal.actionType === 'accept' ? (
              <form onSubmit={handleConfirmAction} className="space-y-3 text-xs">
                <div>
                  <Label required>Agreed Funding Amount (INR)</Label>
                  <Input
                    type="number"
                    value={agreedAmount}
                    onChange={e => setAgreedAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label required>Support Type / Description</Label>
                  <Input
                    value={supportType}
                    onChange={e => setSupportType(e.target.value)}
                    placeholder="e.g. Travel & Equipment Support"
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="h-9 px-4 rounded-lg border text-xs font-bold text-[#173235]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="h-9 px-5 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white text-xs font-extrabold uppercase cursor-pointer"
                  >
                    {submittingAction ? 'Confirming…' : 'Confirm & Activate Sponsorship'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmAction} className="space-y-3 text-xs">
                <div>
                  <Label>Decline Note / Feedback (Optional)</Label>
                  <textarea
                    value={rejectionNote}
                    onChange={e => setRejectionNote(e.target.value)}
                    rows={3}
                    placeholder="Optionally provide reason for declining..."
                    className="w-full p-2.5 rounded-lg border border-[#d2dad2] bg-white text-xs text-[#173235]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="h-9 px-4 rounded-lg border text-xs font-bold text-[#173235]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="h-9 px-5 rounded-lg bg-[#c85c40] hover:bg-[#a6452c] text-white text-xs font-extrabold uppercase cursor-pointer"
                  >
                    {submittingAction ? 'Declining…' : 'Decline Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FLOATING DIRECT 1-ON-1 CHAT DRAWER */}
      {activeChat && (
        <div className="fixed bottom-4 right-4 z-50 w-96 maxWidth-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl border border-[#2f6d5a] overflow-hidden flex flex-col h-[480px]">
          <div className="p-3 bg-[#173d3c] text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#2f6d5a] flex items-center justify-center text-white text-xs font-bold">
                {activeChat.otherUser?.name?.charAt(0) || 'A'}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white line-clamp-1">{activeChat.otherUser?.name || 'Athlete Chat'}</h4>
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
                const isMine = msg.sender?.toString() === currentSponsorUser?._id?.toString();
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
