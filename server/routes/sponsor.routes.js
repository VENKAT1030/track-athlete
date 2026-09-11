const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Sponsorship = require('../models/Sponsorship');
const SponsorConversation = require('../models/SponsorConversation');
const SponsorMessage = require('../models/SponsorMessage');
const { serializeAthleteProfile } = require('../utils/serializers');

const { verifyToken } = require('../middleware/auth.middleware');

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required.' });

  const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// Optional Token Middleware for public discovery endpoints
function optionalToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
  jwt.verify(token, jwtSecret, (err, user) => {
    if (!err && user) req.user = user;
    next();
  });
}

// Helper to serialize Sponsor profile safely (never expose password, Aadhaar, tokens)
function serializeSponsorProfile(userObj) {
  if (!userObj) return null;
  const u = typeof userObj.toObject === 'function' ? userObj.toObject() : { ...userObj };
  delete u.passwordHash;
  delete u.resetPasswordOTP;
  delete u.resetPasswordToken;
  delete u.aadhaarHash;
  delete u.aadhaar;
  delete u.__v;

  const targetSports = Array.isArray(u.targetSports) ? u.targetSports.map(s => s.toUpperCase()) : [];
  const uIdStr = u._id ? String(u._id) : '';

  return {
    _id: u._id || null,
    userId: u._id || null,
    sponsorId: u.sponsorId || u.trackAthleteId || (uIdStr ? `SPN-${uIdStr.slice(-8).toUpperCase()}` : 'SPN-CORP'),
    organizationName: u.organizationName || u.name || 'Corporate Sponsor',
    name: u.name || u.organizationName || 'Sponsor Representative',
    mobile: u.mobile || u.phone || u.contactPhone || '',
    phone: u.mobile || u.phone || u.contactPhone || '',
    email: u.email || '',
    city: u.city || '',
    state: u.state || '',
    country: u.country || 'India',
    budgetRange: u.budgetRange || '₹50,000 - ₹5,00,000',
    targetSports,
    sportsTag: targetSports.length > 0 ? `[ ${targetSports.join(' ] [ ')} ]` : '[ ALL SPORTS ]',
    verified: u.verified !== false
  };
}

// Default corporate sponsors for database fallback
const DEFAULT_SPONSORS = [
  {
    role: 'sponsor',
    organizationName: 'Reliance Foundation Youth Sports',
    name: 'Sports Development Desk',
    email: 'sponsorships@rfyouthsports.com',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz01234567890123456789',
    phone: '+91 98200 12345',
    mobile: '+91 98200 12345',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    budgetRange: '₹1,00,000 - ₹10,00,000',
    targetSports: ['TAEKWONDO', 'ATHLETICS', 'BADMINTON', 'SWIMMING'],
    sponsorId: 'SPN-RFYS-2026',
    emailVerified: true
  },
  {
    role: 'sponsor',
    organizationName: 'Tata Steel Sports Academy & CSR',
    name: 'CSR Sports Officer',
    email: 'csr.sports@tatasteel.com',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz01234567890123456789',
    phone: '+91 94370 67890',
    mobile: '+91 94370 67890',
    city: 'Jamshedpur',
    state: 'Jharkhand',
    country: 'India',
    budgetRange: '₹50,000 - ₹5,00,000',
    targetSports: ['ARCHERY', 'ATHLETICS', 'TAEKWONDO', 'BOXING'],
    sponsorId: 'SPN-TATA-2026',
    emailVerified: true
  },
  {
    role: 'sponsor',
    organizationName: 'JSW Sports Excellence Program',
    name: 'Athlete Support Manager',
    email: 'grants@jswsports.in',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz01234567890123456789',
    phone: '+91 98110 54321',
    mobile: '+91 98110 54321',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    budgetRange: '₹2,00,000 - ₹15,00,000',
    targetSports: ['WRESTLING', 'BOXING', 'TAEKWONDO', 'TRACK & FIELD'],
    sponsorId: 'SPN-JSW-2026',
    emailVerified: true
  },
  {
    role: 'sponsor',
    organizationName: 'Adani Sportsline Grant Program',
    name: 'Garv Hai Team',
    email: 'garvhai@adani.com',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz01234567890123456789',
    phone: '+91 97129 11223',
    mobile: '+91 97129 11223',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    budgetRange: '₹75,000 - ₹8,00,000',
    targetSports: ['ALL SPORTS', 'TAEKWONDO', 'BADMINTON'],
    sponsorId: 'SPN-ADANI-2026',
    emailVerified: true
  }
];

// GET /api/sponsor/athletes — Discover athletes seeking sponsorship (Sponsor View)
router.get('/athletes', authenticateToken, async (req, res) => {
  try {
    const query = {
      role: 'athlete',
      $or: [
        { activelySeekingSponsorship: true },
        { seekingSponsorship: true }
      ]
    };

    if (req.query.sport && req.query.sport !== 'all') {
      const spClean = String(req.query.sport).trim();
      const reg = new RegExp('^' + spClean.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
      query.$and = [
        { $or: [{ sports: { $in: [reg] } }, { sport: reg }] }
      ];
    }
    if (req.query.city && req.query.city !== 'all') {
      query.city = new RegExp('^' + String(req.query.city).trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    }

    const rawAthletes = await User.find(query).sort({ createdAt: -1 }).lean();
    const athletes = rawAthletes.map(a => serializeAthleteProfile(a, 'sponsor'));
    res.json(athletes);
  } catch (err) {
    console.error('Fetch Athletes Seeking Sponsorship Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sponsor/sponsors — Discover real registered sponsors from MongoDB (Athlete View)
router.get('/sponsors', optionalToken, async (req, res) => {
  try {
    const { search, sport, city, state } = req.query;
    const query = { role: 'sponsor' };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { organizationName: searchRegex },
        { sponsorId: searchRegex },
        { city: searchRegex },
        { state: searchRegex }
      ];
    }

    if (city && city !== 'all') {
      query.city = new RegExp('^' + city.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    }

    if (state && state !== 'all') {
      query.state = new RegExp('^' + state.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    }

    let sponsorUsers = await User.find(query).select('-passwordHash').sort({ createdAt: -1 }).lean();

    // If no sponsors exist in database yet, auto-seed default sponsors
    if (sponsorUsers.length === 0 && !search && city === 'all') {
      try {
        await User.insertMany(DEFAULT_SPONSORS);
        sponsorUsers = await User.find(query).select('-passwordHash').sort({ createdAt: -1 }).lean();
      } catch (seedErr) {
        console.error('Auto seed sponsors error:', seedErr.message);
        sponsorUsers = DEFAULT_SPONSORS;
      }
    }

    if (sport && sport !== 'all') {
      const sportClean = sport.trim().toUpperCase();
      sponsorUsers = sponsorUsers.filter(s => {
        if (!s.targetSports || s.targetSports.length === 0) return true; // All sports
        return s.targetSports.some(ts => String(ts).trim().toUpperCase() === sportClean);
      });
    }

    const results = sponsorUsers.map(u => serializeSponsorProfile(u));
    res.json(results);
  } catch (err) {
    console.error('Discover Sponsors Error:', err);
    res.status(500).json({ error: 'Failed to discover sponsors', details: err.message });
  }
});

// GET /api/sponsor/profile/:sponsorId — Public Sponsor profile details
router.get('/profile/:sponsorId', authenticateToken, async (req, res) => {
  try {
    const userObj = await User.findById(req.params.sponsorId).select('-passwordHash').lean();
    if (!userObj || userObj.role !== 'sponsor') {
      return res.status(404).json({ error: 'Sponsor not found.' });
    }
    res.json(serializeSponsorProfile(userObj));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sponsor profile', details: err.message });
  }
});

// POST /api/sponsor/request — Athlete requests sponsorship from Sponsor (Checks duplicate pending request)
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const athleteUserId = req.user.id;
    const { sponsorId, sport, upcomingEvent, eventLevel, expectedEventDate, requirementDescription, proposedAmount, message } = req.body;

    if (!sponsorId) {
      return res.status(400).json({ error: 'Sponsor ID is required.' });
    }

    const sponsorUser = await User.findById(sponsorId);
    if (!sponsorUser || sponsorUser.role !== 'sponsor') {
      return res.status(404).json({ error: 'Selected Sponsor profile not found.' });
    }

    const sportClean = (sport || req.user.sport || 'SPORTS').trim().toUpperCase();

    // Check duplicate pending request for same athlete + sponsor + sport
    const existingPending = await Sponsorship.findOne({
      athlete: athleteUserId,
      sponsor: sponsorId,
      sport: sportClean,
      status: { $in: ['PENDING', 'Proposed', 'NEGOTIATING'] }
    });

    if (existingPending) {
      return res.status(400).json({ error: 'REQUEST ALREADY SENT', message: 'You already have an active pending sponsorship request to this Sponsor for this sport.' });
    }

    const sponsorship = await Sponsorship.create({
      sponsor: sponsorId,
      athlete: athleteUserId,
      sport: sportClean,
      upcomingEvent: upcomingEvent || '',
      eventLevel: eventLevel || 'NATIONAL',
      expectedEventDate: expectedEventDate || null,
      requirementDescription: requirementDescription || '',
      proposedAmount: proposedAmount ? Number(proposedAmount) : undefined,
      message: message || '',
      status: 'PENDING'
    });

    res.status(201).json(sponsorship);
  } catch (err) {
    console.error('Create Sponsorship Request Error:', err);
    res.status(500).json({ error: 'Failed to submit sponsorship request', details: err.message });
  }
});

// POST /api/sponsor/:sponsorId/sponsor — Sponsor pledges support to Athlete
router.post('/:sponsorId/sponsor', authenticateToken, async (req, res) => {
  try {
    const sponsorUserId = req.user.id;
    const { athleteId, supportType, amount, message } = req.body;

    const sponsorship = await Sponsorship.create({
      sponsor: sponsorUserId,
      athlete: athleteId,
      supportType: supportType || 'Equipment & Travel Support',
      amount: amount ? Number(amount) : undefined,
      message: message || '',
      status: 'ACTIVE'
    });

    res.status(201).json(sponsorship);
  } catch (err) {
    console.error('Submit Sponsor Pledge Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sponsor/my-requests — Athlete fetches sent requests & active sponsorships
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    const athleteUserId = req.user.id;
    const rawSponsorships = await Sponsorship.find({ athlete: athleteUserId })
      .populate('sponsor', 'name organizationName email city state sponsorId targetSports budgetRange')
      .sort({ createdAt: -1 })
      .lean();

    const result = rawSponsorships.map(s => ({
      ...s,
      sponsorProfile: serializeSponsorProfile(s.sponsor)
    }));

    res.json(result);
  } catch (err) {
    console.error('Fetch My Sponsorship Requests Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sponsor/incoming-requests — Sponsor fetches incoming requests & active sponsored athletes
router.get('/incoming-requests', authenticateToken, async (req, res) => {
  try {
    const sponsorUserId = req.user.id;
    const rawSponsorships = await Sponsorship.find({ sponsor: sponsorUserId })
      .populate('athlete', '-passwordHash')
      .sort({ createdAt: -1 })
      .lean();

    const result = rawSponsorships.map(s => ({
      ...s,
      athleteProfile: serializeAthleteProfile(s.athlete, 'sponsor')
    }));

    res.json(result);
  } catch (err) {
    console.error('Fetch Incoming Sponsorship Requests Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sponsor/requests/:requestId — Sponsor accepts, rejects, or negotiates request
router.put('/requests/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, amount, rejectionNote, supportType } = req.body;

    const sponsorship = await Sponsorship.findById(requestId);
    if (!sponsorship) {
      return res.status(404).json({ error: 'Sponsorship request not found.' });
    }

    if (sponsorship.sponsor.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only update requests assigned to your sponsor account.' });
    }

    if (status) sponsorship.status = status;
    if (amount !== undefined) sponsorship.amount = Number(amount);
    if (supportType) sponsorship.supportType = supportType;
    if (rejectionNote !== undefined) sponsorship.rejectionNote = rejectionNote;

    await sponsorship.save();

    res.json(sponsorship);
  } catch (err) {
    console.error('Update Sponsorship Request Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sponsor/athlete-preference — Athlete updates activelySeekingSponsorship toggle & details
router.put('/athlete-preference', authenticateToken, async (req, res) => {
  try {
    const athleteUserId = req.user.id;
    const { activelySeekingSponsorship, upcomingEvent, eventLevel, expectedEventDate, requirementDescription } = req.body;

    const user = await User.findById(athleteUserId);
    if (!user || user.role !== 'athlete') {
      return res.status(403).json({ error: 'Only athletes can update sponsorship preferences.' });
    }

    if (activelySeekingSponsorship !== undefined) {
      user.activelySeekingSponsorship = Boolean(activelySeekingSponsorship);
      user.seekingSponsorship = Boolean(activelySeekingSponsorship);
    }

    user.sponsorshipDetails = {
      upcomingEvent: upcomingEvent || user.sponsorshipDetails?.upcomingEvent || '',
      eventLevel: eventLevel || user.sponsorshipDetails?.eventLevel || 'NATIONAL',
      expectedEventDate: expectedEventDate ? new Date(expectedEventDate) : (user.sponsorshipDetails?.expectedEventDate || null),
      requirementDescription: requirementDescription || user.sponsorshipDetails?.requirementDescription || ''
    };

    if (requirementDescription) {
      user.sponsorshipReason = requirementDescription;
    }

    await user.save();

    res.json({
      message: 'Sponsorship preferences updated successfully.',
      activelySeekingSponsorship: user.activelySeekingSponsorship,
      sponsorshipDetails: user.sponsorshipDetails
    });
  } catch (err) {
    console.error('Update Athlete Sponsorship Preference Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── SPONSOR ↔ ATHLETE DIRECT CHAT ENDPOINTS ─────────────────────────

// GET /api/sponsor/chats/conversations — Get list of 1-on-1 Sponsor ↔ Athlete conversations
router.get('/chats/conversations', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const conversations = await SponsorConversation.find({ participants: currentUserId })
      .populate('participants', '-passwordHash')
      .sort({ lastMessageAt: -1 })
      .lean();

    const result = await Promise.all(conversations.map(async (conv) => {
      const otherUser = conv.participants.find(p => p._id.toString() !== currentUserId.toString());
      let otherSerialized = null;
      if (otherUser) {
        otherSerialized = otherUser.role === 'sponsor' ? serializeSponsorProfile(otherUser) : serializeAthleteProfile(otherUser, 'sponsor');
      }

      const unreadCount = await SponsorMessage.countDocuments({
        conversationId: conv._id,
        receiver: currentUserId,
        read: false
      });

      return {
        _id: conv._id,
        otherUser: otherSerialized || (otherUser ? { _id: otherUser._id, name: otherUser.name, role: otherUser.role } : null),
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unreadCount
      };
    }));

    res.json(result);
  } catch (err) {
    console.error('Get Sponsor Conversations Error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations', details: err.message });
  }
});

// POST /api/sponsor/chats/conversations — Start or get direct 1-on-1 conversation
router.post('/chats/conversations', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { targetUserId, sponsorshipId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required.' });
    }

    if (currentUserId.toString() === targetUserId.toString()) {
      return res.status(400).json({ error: 'You cannot start a conversation with yourself.' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    let conversation = await SponsorConversation.findOne({
      participants: { $all: [currentUserId, targetUserId] }
    });

    if (!conversation) {
      conversation = await SponsorConversation.create({
        participants: [currentUserId, targetUserId],
        sponsorshipId: sponsorshipId || null,
        lastMessage: '',
        lastMessageAt: new Date()
      });
    }

    const otherSerialized = targetUser.role === 'sponsor' ? serializeSponsorProfile(targetUser) : serializeAthleteProfile(targetUser, 'sponsor');

    res.json({
      conversationId: conversation._id,
      otherUser: otherSerialized,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt
    });
  } catch (err) {
    console.error('Start Sponsor Conversation Error:', err);
    res.status(500).json({ error: 'Failed to start conversation', details: err.message });
  }
});

// GET /api/sponsor/chats/conversations/:conversationId/messages — Get message log
router.get('/chats/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await SponsorConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const isParticipant = conversation.participants.some(p => p.toString() === req.user.id.toString());
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const messages = await SponsorMessage.find({ conversationId }).sort({ createdAt: 1 }).lean();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages', details: err.message });
  }
});

// POST /api/sponsor/chats/conversations/:conversationId/messages — Send message
router.post('/chats/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const conversation = await SponsorConversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const isParticipant = conversation.participants.some(p => p.toString() === req.user.id.toString());
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const receiverId = conversation.participants.find(p => p.toString() !== req.user.id.toString());

    const newMessage = await SponsorMessage.create({
      conversationId,
      sender: req.user.id,
      receiver: receiverId,
      message: message.trim()
    });

    conversation.lastMessage = message.trim();
    conversation.lastMessageAt = new Date();
    await conversation.save();

    res.json(newMessage);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

// PATCH /api/sponsor/chats/conversations/:conversationId/read — Mark read
router.patch('/chats/conversations/:conversationId/read', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    await SponsorMessage.updateMany(
      { conversationId, receiver: req.user.id, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
