const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Connection = require('../models/Connection');
const User = require('../models/User');
const { withoutAadhaar } = require('../utils/aadhaar');
const { serializeAthleteProfile, serializeCoachProfile } = require('../utils/serializers');

let _io = null;
router.use((req, _res, next) => { _io = req.app.get('io'); next(); });

// GET /api/coach/:id/requests — pending mentorship requests
router.get('/:id/requests', async (req, res) => {
  try {
    const rawRequests = await Connection.find({ coach: req.params.id, status: 'Pending' })
      .populate('athlete', '-passwordHash -aadhaarHash -resetPasswordOTP -resetPasswordToken')
      .sort({ createdAt: -1 });

    const requests = rawRequests.map(r => {
      const obj = r.toObject();
      if (obj.athlete) {
        obj.athlete = serializeAthleteProfile(obj.athlete, 'coach', false);
      }
      return obj;
    });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coach/:id/athletes — active connections (My Athletes)
router.get('/:id/athletes', async (req, res) => {
  try {
    const rawAthletes = await Connection.find({ coach: req.params.id, status: 'Active' })
      .populate('athlete', '-passwordHash -aadhaarHash -resetPasswordOTP -resetPasswordToken')
      .sort({ createdAt: -1 });

    const athletes = rawAthletes.map(a => {
      const obj = a.toObject();
      if (obj.athlete) {
        obj.athlete = serializeAthleteProfile(obj.athlete, 'coach', true);
      }
      return obj;
    });

    res.json(athletes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/coach/requests/:connectionId — accept or reject
router.put('/requests/:connectionId', async (req, res) => {
  try {
    const { status, rejectionNote } = req.body;
    const update = { status };
    if (rejectionNote) update.rejectionNote = rejectionNote;

    const conn = await Connection.findByIdAndUpdate(
      req.params.connectionId,
      update,
      { new: true }
    ).populate('athlete', '-passwordHash').populate('coach', '-passwordHash');

    if (!conn) return res.status(404).json({ error: 'Connection not found' });

    const io = req.app.get('io');
    if (io) {
      if (status === 'Active') {
        io.to(conn.athlete._id.toString()).emit('connection-accepted', {
          connectionId: conn._id,
          coach: { name: conn.coach.name, sport: conn.coach.sport, certifications: conn.coach.certifications }
        });
      } else if (status === 'Rejected') {
        io.to(conn.athlete._id.toString()).emit('connection-rejected', {
          connectionId: conn._id,
          coachName: conn.coach.name,
          rejectionNote: rejectionNote || ''
        });
      }
    }

    res.json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coach/:coachId/athletes/:connectionId/notes — add session note
router.post('/:coachId/athletes/:connectionId/notes', async (req, res) => {
  try {
    const { note } = req.body;
    const conn = await Connection.findOneAndUpdate(
      { _id: req.params.connectionId, coach: req.params.coachId, status: 'Active' },
      { $push: { sessionNotes: { date: new Date(), note } } },
      { new: true }
    ).populate('athlete', '-passwordHash');

    if (!conn) return res.status(404).json({ error: 'Active connection not found' });
    res.json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coach/:id/profile — fetch complete coach profile
router.get('/:id/profile', async (req, res) => {
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
    const orConditions = [
      { coachId: req.params.id },
      { trackAthleteId: req.params.id }
    ];
    if (isObjectId) {
      orConditions.unshift({ _id: req.params.id });
    }

    const coach = await User.findOne({
      $or: orConditions,
      role: 'coach'
    });

    if (!coach) return res.status(404).json({ error: 'Coach not found' });
    const serialized = serializeCoachProfile(coach, 'coach');
    res.json(serialized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/coach/:id/certificate — download or view coach certificate PDF
router.get('/:id/certificate', async (req, res) => {
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
    const orConditions = [
      { coachId: req.params.id },
      { trackAthleteId: req.params.id }
    ];
    if (isObjectId) {
      orConditions.unshift({ _id: req.params.id });
    }

    const coach = await User.findOne({
      $or: orConditions,
      role: 'coach'
    }).select('certificateData certificateFileName certificateFileSize name coachId');

    if (!coach || !coach.certificateData) {
      return res.status(404).json({ error: 'Coaching certificate PDF not found for this coach.' });
    }

    res.json({
      certificateData: coach.certificateData,
      certificateFileName: coach.certificateFileName || `${coach.name || 'Coach'}_Certificate.pdf`,
      certificateFileSize: coach.certificateFileSize || 0,
      coachId: coach.coachId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   COACH CONNECTIONS & COACH-TO-COACH CHAT ENDPOINTS
   ========================================================================== */

const { verifyToken, requireRoles } = require('../middleware/auth.middleware');
const CoachConversation = require('../models/CoachConversation');
const CoachMessage = require('../models/CoachMessage');
const AcademyCoachAssignment = require('../models/AcademyCoachAssignment');
const { normalizeSports } = require('../utils/serializers');

/**
 * GET /api/coach/connections/discover
 * Discover real registered TrackAthlete coaches with search and filtering
 */
router.get('/connections/discover', verifyToken, requireRoles('coach'), async (req, res) => {
  try {
    const { search, sport, location, academy } = req.query;

    const baseFilter = {
      role: 'coach',
      _id: { $ne: req.user._id }
    };

    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim();
      const searchRegex = new RegExp(cleanSearch.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      baseFilter.$or = [
        { name: searchRegex },
        { coachId: searchRegex },
        { trackAthleteId: searchRegex },
        { nisId: searchRegex },
        { sport: searchRegex },
        { sports: searchRegex }
      ];
    }

    if (sport && String(sport).trim()) {
      const cleanSport = String(sport).trim();
      const sportRegex = new RegExp('^' + cleanSport.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
      baseFilter.$and = baseFilter.$and || [];
      baseFilter.$and.push({
        $or: [
          { sport: sportRegex },
          { sports: sportRegex }
        ]
      });
    }

    if (location && String(location).trim()) {
      const cleanLoc = String(location).trim();
      const locRegex = new RegExp(cleanLoc.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      baseFilter.$and = baseFilter.$and || [];
      baseFilter.$and.push({
        $or: [
          { city: locRegex },
          { state: locRegex }
        ]
      });
    }

    if (academy && String(academy).trim()) {
      const cleanAcad = String(academy).trim();
      const acadRegex = new RegExp(cleanAcad.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      baseFilter.$and = baseFilter.$and || [];
      baseFilter.$and.push({ academyName: acadRegex });
    }

    const rawCoaches = await User.find(baseFilter)
      .select('-passwordHash -aadhaarHash -resetPasswordOTP -resetPasswordToken -certificateData')
      .sort({ name: 1 })
      .lean();

    // Attach active academy assignments for each coach
    const coaches = await Promise.all(rawCoaches.map(async (c) => {
      const serialized = serializeCoachProfile(c, 'coach');
      if (serialized) {
        delete serialized.certificateData;
        const activeAssignments = await AcademyCoachAssignment.find({
          coachUserId: c._id,
          status: 'ACTIVE'
        }).populate('academyId', 'name city state').lean();

        serialized.academyAssignments = activeAssignments.map(a => ({
          academyId: a.academyId?._id || a.academyId,
          academyName: a.academyId?.name || a.academyName || 'Sports Academy',
          sportName: a.sportName,
          role: a.role || 'Coach'
        }));
      }
      return serialized;
    }));

    const validCoaches = coaches.filter(Boolean);

    // Derive available filter options dynamically from all real MongoDB coach documents
    const allMongoCoaches = await User.find({ role: 'coach' }).select('sports sport city state academyName').lean();
    const sportsSet = new Set();
    const locationsSet = new Set();
    const academiesSet = new Set();

    for (const mc of allMongoCoaches) {
      if (mc.sports && Array.isArray(mc.sports)) {
        mc.sports.forEach(s => s && sportsSet.add(String(s).trim().toUpperCase()));
      }
      if (mc.sport) sportsSet.add(String(mc.sport).trim().toUpperCase());
      if (mc.city) locationsSet.add(String(mc.city).trim());
      if (mc.state) locationsSet.add(String(mc.state).trim());
      if (mc.academyName) academiesSet.add(String(mc.academyName).trim());
    }

    res.json({
      coaches: validCoaches,
      total: validCoaches.length,
      sportsFilter: Array.from(sportsSet).sort(),
      locationsFilter: Array.from(locationsSet).sort(),
      academiesFilter: Array.from(academiesSet).sort()
    });
  } catch (err) {
    console.error('Error discovering coaches:', err);
    res.status(500).json({ error: 'Failed to discover coach connections: ' + err.message });
  }
});

/**
 * GET /api/coach/connections/details/:coachId
 * Detailed profile view for a specific coach
 */
router.get('/connections/details/:coachId', verifyToken, requireRoles('coach'), async (req, res) => {
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(req.params.coachId);
    const query = isObjectId
      ? { $or: [{ _id: req.params.coachId }, { coachId: req.params.coachId }, { trackAthleteId: req.params.coachId }], role: 'coach' }
      : { $or: [{ coachId: req.params.coachId }, { trackAthleteId: req.params.coachId }], role: 'coach' };

    const coach = await User.findOne(query);
    if (!coach) return res.status(404).json({ error: 'Coach profile not found.' });

    const serialized = serializeCoachProfile(coach, 'coach');
    const activeAssignments = await AcademyCoachAssignment.find({
      coachUserId: coach._id,
      status: 'ACTIVE'
    }).populate('academyId', 'name city state').lean();

    serialized.academyAssignments = activeAssignments.map(a => ({
      academyId: a.academyId?._id || a.academyId,
      academyName: a.academyId?.name || a.academyName || 'Sports Academy',
      sportName: a.sportName,
      role: a.role || 'Coach'
    }));

    res.json(serialized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/coach/chats/conversations
 * Get active Coach-to-Coach conversations for authenticated coach
 */
router.get('/chats/conversations', verifyToken, requireRoles('coach'), async (req, res) => {
  try {
    const conversations = await CoachConversation.find({ participants: req.user._id })
      .populate('participants', '_id name coachId trackAthleteId sports sport city state nisId profilePhoto')
      .sort({ updatedAt: -1 })
      .lean();

    const withUnread = await Promise.all(conversations.map(async (conv) => {
      const otherParticipant = conv.participants.find(p => String(p._id) !== String(req.user._id)) || null;
      const unreadCount = await CoachMessage.countDocuments({
        conversationId: conv._id,
        receiver: req.user._id,
        read: false
      });
      return {
        ...conv,
        otherParticipant,
        unreadCount
      };
    }));

    res.json(withUnread);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations: ' + err.message });
  }
});

/**
 * POST /api/coach/chats/conversations
 * Start or retrieve a conversation between authenticated coach and recipient coach
 */
router.post('/chats/conversations', verifyToken, requireRoles('coach'), async (req, res) => {
  try {
    const { recipientCoachId } = req.body;
    if (!recipientCoachId) {
      return res.status(400).json({ error: 'Recipient coach ID is required.' });
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(recipientCoachId);
    const recipientUser = await User.findOne({
      $or: isObjectId ? [{ _id: recipientCoachId }, { coachId: recipientCoachId }] : [{ coachId: recipientCoachId }],
      role: 'coach'
    });

    if (!recipientUser) {
      return res.status(404).json({ error: 'Recipient coach not found.' });
    }

    if (String(recipientUser._id) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot start a conversation with yourself.' });
    }

    let conversation = await CoachConversation.findOne({
      participants: { $all: [req.user._id, recipientUser._id] }
    });

    if (!conversation) {
      conversation = await CoachConversation.create({
        participants: [req.user._id, recipientUser._id],
        lastMessage: 'Conversation started',
        lastMessageAt: new Date()
      });
    }

    const populated = await CoachConversation.findById(conversation._id)
      .populate('participants', '_id name coachId trackAthleteId sports sport city state nisId profilePhoto')
      .lean();

    const otherParticipant = populated.participants.find(p => String(p._id) !== String(req.user._id)) || null;

    res.json({ ...populated, otherParticipant, unreadCount: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start conversation: ' + err.message });
  }
});

/**
 * GET /api/coach/chats/conversations/:conversationId/messages
 * Get messages in a conversation (authorized participants only)
 */
router.get('/chats/conversations/:conversationId/messages', verifyToken, requireRoles('coach'), async (req, res) => {
  try {
    const conversation = await CoachConversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const isParticipant = conversation.participants.some(p => String(p) === String(req.user._id));
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied. You are not a participant in this conversation.' });
    }

    // Mark incoming messages as read
    await CoachMessage.updateMany(
      { conversationId: conversation._id, receiver: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );

    const messages = await CoachMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages: ' + err.message });
  }
});

/**
 * POST /api/coach/chats/conversations/:conversationId/messages
 * Send message in conversation (sender strictly derived from authenticated req.user._id)
 */
router.post('/chats/conversations/:conversationId/messages', verifyToken, requireRoles('coach'), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message text cannot be empty.' });
    }

    const conversation = await CoachConversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const isParticipant = conversation.participants.some(p => String(p) === String(req.user._id));
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied. You are not a participant in this conversation.' });
    }

    const receiverId = conversation.participants.find(p => String(p) !== String(req.user._id));
    const cleanMsgText = String(message).trim();

    const createdMsg = await CoachMessage.create({
      conversationId: conversation._id,
      sender: req.user._id,
      receiver: receiverId,
      message: cleanMsgText,
      read: false
    });

    conversation.lastMessage = cleanMsgText;
    conversation.lastMessageAt = new Date();
    conversation.updatedAt = new Date();
    await conversation.save();

    // Emit live WebSocket notification if socket instance is available
    const io = req.app.get('io');
    if (io && receiverId) {
      try {
        io.to(receiverId.toString()).emit('coach-message-received', {
          conversationId: conversation._id,
          message: createdMsg
        });
      } catch (e) {
        // Safe fallback for serverless lambda execution
      }
    }

    res.status(201).json(createdMsg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message: ' + err.message });
  }
});

/**
 * POST /api/coach/ai-assistant
 * Coach AI Assistant Endpoint
 */
router.post('/ai-assistant', verifyToken, requireRoles('coach'), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const cleanPrompt = String(prompt).trim();
    const coach = req.user;

    const coachSports = normalizeSports(coach.sports, coach.sport);
    const activeAssignments = await AcademyCoachAssignment.find({
      coachUserId: coach._id,
      status: 'ACTIVE'
    }).populate('academyId', 'name city state').lean();

    const activeAthletesCount = await Connection.countDocuments({ coach: coach._id, status: 'Active' });
    const pendingRequestsCount = await Connection.countDocuments({ coach: coach._id, status: 'Pending' });

    const acadNames = activeAssignments.map(a => a.academyId?.name || a.academyName).filter(Boolean);

    // Contextual Guidance Generator for TrackAthlete Coach Assistant
    let reply = `Hello Coach ${coach.name || ''}! `;
    const lowerP = cleanPrompt.toLowerCase();

    if (lowerP.includes('athlete') || lowerP.includes('add') || lowerP.includes('manage') || lowerP.includes('roster')) {
      reply += `\n\n**Managing Athletes & Roster:**\n` +
        `• Athletes can send you direct mentorship requests using your Coach ID: \`${coach.coachId || coach.trackAthleteId || 'COA-N/A'}\`.\n` +
        `• Incoming requests appear in your **Request Inbox** tab (Currently: **${pendingRequestsCount}** pending requests).\n` +
        `• Your active training roster is in the **My Athletes** tab (Currently: **${activeAthletesCount}** enrolled athletes).\n` +
        `• You can record session notes per athlete in the **Session Notes** tab.`;
    } else if (lowerP.includes('academy') || lowerP.includes('opening') || lowerP.includes('job') || lowerP.includes('apply')) {
      reply += `\n\n**Academy Connections & Openings:**\n` +
        `• You are currently affiliated with **${acadNames.length}** sports academies${acadNames.length > 0 ? `: ${acadNames.join(', ')}` : ''}.\n` +
        `• Check the **Academy Openings** tab to discover and apply for coaching jobs published by verified academies matching your discipline (${coachSports.join(', ') || 'Sports'}).\n` +
        `• Academies review your uploaded NIS ID (${coach.nisId || 'Not set'}) and certificate document before assigning roles.`;
    } else if (lowerP.includes('connection') || lowerP.includes('coach') || lowerP.includes('chat') || lowerP.includes('contact')) {
      reply += `\n\n**Coach Connections & Direct Messaging:**\n` +
        `• Open the **Coach Connections** tab to discover registered TrackAthlete coaches nationwide.\n` +
        `• Filter coaches by Sport (${coachSports.join(', ')}), Location, or Academy.\n` +
        `• Click **Start Chat** on any coach profile card to initiate end-to-end direct messages.`;
    } else if (lowerP.includes('achievement') || lowerP.includes('federation') || lowerP.includes('organizer') || lowerP.includes('verified')) {
      reply += `\n\n**Tournament & Achievement Verification:**\n` +
        `• **Federation Recognized:** Results verified by state/national sports governing bodies with official TA-ACH codes.\n` +
        `• **Organizer Verified:** Results recorded during sanctioned tournaments organized by registered sports clubs.\n` +
        `• You can inspect any enrolled athlete's verified achievements in the **Request Inbox** or **My Athletes** roster.`;
    } else if (lowerP.includes('profile') || lowerP.includes('cert') || lowerP.includes('nis')) {
      reply += `\n\n**Coach Profile & Credentials:**\n` +
        `• Your permanent identifier: \`${coach.coachId || coach.trackAthleteId || 'COA-N/A'}\`.\n` +
        `• NIS ID: \`${coach.nisId || 'Not set'}\`.\n` +
        `• Primary Sport: \`${coach.sport || (coachSports[0] || 'Sports')}\`.\n` +
        `• Experience: **${coach.yearsExperience || 0} years**.\n` +
        `• Location: **${coach.city || 'City'}, ${coach.state || 'State'}**.`;
    } else {
      reply += `\n\nI am your **TrackAthlete AI Coach Assistant**. Here is how I can support your coaching workflow:\n` +
        `1. **Roster & Mentorship:** Guide on accepting incoming athlete requests & tracking session notes.\n` +
        `2. **Academy Openings:** Help with finding hiring opportunities & academy assignments.\n` +
        `3. **Coach Connections:** Network and direct-message with certified coaches across India.\n` +
        `4. **Certifications & Governance:** Explain Federation-Recognized vs Organizer-Verified tournament achievements.\n\n` +
        `*Your Profile Summary:* ${coachSports.join(', ') || 'Sports'} Coach based in ${coach.city || 'India'}, ${coach.state || ''} (${activeAthletesCount} active athletes). How can I assist you today?`;
    }

    res.json({ reply });
  } catch (err) {
    console.error('Coach AI Assistant error:', err);
    res.status(500).json({ error: 'AI Assistant error: ' + err.message });
  }
});

module.exports = router;
