import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Label,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  useToast,
  ProgressChart,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui';
import { HeartHandshake, ShieldCheck, DollarSign, Award, Send, CheckCircle2, Users, Inbox } from 'lucide-react';
import OrganizedEventsSection from '../components/OrganizedEventsSection';
import SponsorRequestsSection from '../components/SponsorRequestsSection';

export default function SponsorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [fundingAmount, setFundingAmount] = useState('50000');
  const [fundingPurpose, setFundingPurpose] = useState('Tournament travel & professional equipment');
  const [submittingPledge, setSubmittingPledge] = useState(false);
  const [athletes, setAthletes] = useState([]);
  const [myOrganizedData, setMyOrganizedData] = useState(null);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'athletes' | 'organized'

  const fetchSeekingAthletes = () => {
    api.get('/sponsor/athletes').then(res => {
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setAthletes(res.data.map(a => ({
          id: a._id,
          name: a.name,
          sport: Array.isArray(a.sports) && a.sports.length > 0 ? a.sports.join(', ') : (a.sport || 'Sports'),
          sports: Array.isArray(a.sports) && a.sports.length > 0 ? a.sports : (a.sport ? [a.sport] : []),
          level: a.beltRank || a.athleteLevel || 'Competitive Athlete',
          athleteId: a.athleteId,
          need: a.sponsorshipReason || (a.bio ? a.bio.slice(0, 140) : 'Funding for National/International Championship Equipment & Travel'),
          verified: !!a.isVerified || !!a.federationVerified
        })));
      } else {
        setAthletes([]);
      }
    }).catch(err => {
      console.error('Error fetching athletes seeking sponsorship:', err);
      setAthletes([]);
    });
  };

  useEffect(() => {
    fetchSeekingAthletes();

    api.get('/organizer-events/my-organized-events')
      .then(res => setMyOrganizedData(res.data))
      .catch(() => setMyOrganizedData(null));
  }, []);

  const handlePledgeSubmit = async () => {
    if (!selectedAthlete?.id || !user?._id || submittingPledge) return;

    try {
      setSubmittingPledge(true);
      await api.post(`/sponsor/${user._id}/sponsor`, {
        athleteId: selectedAthlete.id,
        supportType: fundingPurpose,
        amount: Number(fundingAmount),
        message: `Pledged CSR support of ₹${fundingAmount} for ${selectedAthlete.name}`
      });

      toast({
        title: 'Sponsorship Pledge Submitted! 🎉',
        description: `Pledged ₹${fundingAmount} for ${selectedAthlete.name}. Active sponsorship record created.`,
        variant: 'success',
      });
      setSelectedAthlete(null);
    } catch (err) {
      toast({ title: 'Pledge Error', description: err.response?.data?.error || 'Failed to submit sponsorship pledge.', variant: 'destructive' });
    } finally {
      setSubmittingPledge(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* SPONSOR HEADER */}
      <div className="bg-gradient-to-r from-[#173d3c] via-[#123130] to-[#0c292c] border border-[#2f6d5a] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#cc694e]" /> Verified Corporate Sponsor
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">
              ID: {user?.sponsorId || user?.trackAthleteId || 'SPN-N/A'}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">{user?.targetSports?.join(', ') || 'All Sports'}</span>
          </div>
          <h1 className="text-3xl font-normal text-white" style={{ fontFamily: 'Georgia, serif' }}>
            {user?.organizationName || user?.name || 'Sponsor'} <em style={{ color: '#b9d9bf', fontStyle: 'italic' }}>Studio</em>
          </h1>
          <p className="text-xs text-[#c5d3ce] mt-1">
            Budget Range: {user?.budgetRange || '₹50,000 - ₹5,00,000'} · {user?.city || 'Mumbai'}, {user?.state || 'Maharashtra'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
            <Award className="w-3.5 h-3.5 mr-1.5 text-[#cc694e]" /> Section 135 CSR Compliant
          </span>
        </div>
      </div>

      {/* DASHBOARD NAVIGATION TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1.5 p-1.5 bg-[#e2eee4] rounded-xl border border-[#2f6d5a]/30">
          <TabsTrigger value="requests">
            <Inbox className="w-4 h-4 mr-1.5 text-[#cc694e]" /> Sponsorship Requests & Active Ledger
          </TabsTrigger>
          <TabsTrigger value="athletes">
            <HeartHandshake className="w-4 h-4 mr-1.5" /> Discover Athletes Seeking Sponsorship ({athletes.length})
          </TabsTrigger>
          {myOrganizedData?.hasLinkedOrganizer && (
            <TabsTrigger value="organized">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-[#cc694e]" /> Organized Events ({myOrganizedData.events?.length || 0})
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── SPONSORSHIP REQUESTS & ACTIVE LEDGER ─────────────────── */}
        <TabsContent value="requests" className="space-y-4">
          <SponsorRequestsSection currentSponsorUser={user} />
        </TabsContent>

        {/* ── DISCOVER ATHLETES SEEKING SPONSORSHIP ────────────────── */}
        <TabsContent value="athletes" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ATHLETE LEDGER */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-normal text-[#173235] flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
                  <HeartHandshake className="w-5 h-5 text-[#cc694e]" /> Verified Athlete Support Ledger
                </CardTitle>
                <CardDescription className="text-xs text-[#526668]">
                  Browse verified promising athletes requiring tournament & equipment support
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {athletes.length === 0 ? (
                  <div className="p-8 text-center bg-[#f8faf7] rounded-xl border border-dashed border-[#d8ded5]">
                    <Users className="w-8 h-8 text-[#8a9d9a] mx-auto mb-2" />
                    <div className="font-bold text-sm text-[#173235]">No Athletes Currently Seeking Sponsorship</div>
                    <p className="text-xs text-[#697c7c] mt-1 max-w-sm mx-auto">
                      When verified athletes activate sponsorship requests on their profile, their verified credentials and funding requirements will appear here.
                    </p>
                  </div>
                ) : (
                  athletes.map((ath) => (
                    <div key={ath.id} className="p-4 rounded-2xl border border-[#d8ded5] bg-white shadow-xs space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-[#173235] text-sm">{ath.name}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {ath.sports?.map((sp, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]/40">
                                [ {String(sp).toUpperCase()} ]
                              </span>
                            ))}
                            <span className="text-xs text-[#526668] ml-1">· {ath.level}</span>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                          <ShieldCheck className="w-3 h-3 text-[#cc694e]" /> Verified Ledger
                        </span>
                      </div>
                      <div className="text-xs text-[#173235] bg-[#f4f8f3] p-3 rounded-xl border border-[#d8ded5]">
                        <span className="text-[#526668] font-bold uppercase text-[10px] block mb-1">Target Support Requirement</span>
                        <span className="font-semibold text-[#194e42]">{ath.need}</span>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedAthlete(ath)}
                          className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-[#e2eee4] hover:bg-[#d4e6d7] text-[#194e42] font-bold text-xs border border-[#2f6d5a]/40 transition-all cursor-pointer"
                        >
                          <HeartHandshake className="w-4 h-4 mr-1 text-[#cc694e]" /> Submit Support Intent
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* CSR SUMMARY */}
            <Card>
              <CardHeader>
                <CardTitle>CSR Allocation Summary</CardTitle>
                <CardDescription className="text-xs">Fund disbursement & impact analytics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressChart value={75} label="Disbursed Funds Tracked" />
                <ProgressChart value={100} label="CSR Compliance Status" />
                <div className="p-3.5 rounded-xl bg-[#f4f8f3] border border-[#d8ded5] text-xs text-[#526668] space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#173235]">
                    <CheckCircle2 className="w-4 h-4 text-[#cc694e]" /> Verification Guarantee
                  </div>
                  <p className="text-[11px] text-[#526668] leading-relaxed">
                    Receipts and tournament entry proofs are verified by accredited state federations prior to fund release.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {myOrganizedData?.hasLinkedOrganizer && (
          <TabsContent value="organized" className="space-y-4">
            <OrganizedEventsSection initialData={myOrganizedData} />
          </TabsContent>
        )}
      </Tabs>

      {/* PLEDGE DIALOG */}
      <Dialog isOpen={!!selectedAthlete} onClose={() => setSelectedAthlete(null)}>
        <DialogHeader>
          <DialogTitle>Pledge CSR Support for {selectedAthlete?.name}</DialogTitle>
          <DialogDescription>Submit your corporate sponsorship commitment</DialogDescription>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div>
            <Label required>Pledge Amount (INR)</Label>
            <Input value={fundingAmount} onChange={(e) => setFundingAmount(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Funding Purpose</Label>
            <Input
              value={fundingPurpose}
              onChange={(e) => setFundingPurpose(e.target.value)}
              className="mt-1 text-[#173235] font-bold"
            />
          </div>
        </DialogContent>
        <DialogFooter>
          <button type="button" className="px-4 h-9 rounded-lg border border-[#d8ded5] text-[#526668] text-xs font-bold cursor-pointer" onClick={() => setSelectedAthlete(null)}>Cancel</button>
          <button
            type="button"
            disabled={submittingPledge}
            className="login-submit flex items-center justify-center gap-1.5 h-9 px-5 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-50"
            onClick={handlePledgeSubmit}
          >
            <Send className="w-4 h-4 mr-1" /> {submittingPledge ? 'Submitting…' : 'Submit Commitment'}
          </button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
