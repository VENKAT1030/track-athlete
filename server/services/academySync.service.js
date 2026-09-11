const Academy = require('../models/Academy');
const User = require('../models/User');
const { generateRolePermanentId } = require('../utils/idGenerator');

const ACADEMY_ID_PATTERN = /^ACA-[A-Z0-9]+$/;

function normalizeSports(sports) {
  const seen = new Set();
  return (Array.isArray(sports) ? sports : [])
    .map(item => String(item?.sportName || item?.name || item || '').trim().toUpperCase())
    .filter(name => name && !seen.has(name) && seen.add(name))
    .map(sportName => ({ sportName, addedAt: new Date() }));
}

function normalizeStats(stats = {}) {
  const count = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  };
  return {
    districtPlayers: count(stats.districtPlayers),
    statePlayers: count(stats.statePlayers),
    nationalPlayers: count(stats.nationalPlayers),
    internationalPlayers: count(stats.internationalPlayers)
  };
}

function getLocation(source = {}) {
  const coordinates = source.location?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const [longitude, latitude] = coordinates.map(Number);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { type: 'Point', coordinates: [longitude, latitude] };
}

/**
 * Ensures one permanent identity is shared by the Academy user and document.
 * It intentionally matches records only by userId or the permanent academyId.
 */
async function synchronizeAcademyForUser(user, registration = {}) {
  if (!user || user.role !== 'academy') throw new Error('Academy synchronization requires an academy user.');

  let academyId = String(user.academyId || '').trim().toUpperCase();
  const linkedAcademy = await Academy.findOne({ userId: user._id });
  if (!ACADEMY_ID_PATTERN.test(academyId) && linkedAcademy?.academyId && ACADEMY_ID_PATTERN.test(linkedAcademy.academyId)) {
    academyId = linkedAcademy.academyId;
  }
  if (!ACADEMY_ID_PATTERN.test(academyId)) {
    academyId = await generateRolePermanentId('academy', user._id, async candidate => {
      const [existingUser, existingAcademy] = await Promise.all([
        User.exists({ academyId: candidate, _id: { $ne: user._id } }),
        Academy.exists({ academyId: candidate })
      ]);
      return !existingUser && !existingAcademy;
    });
    user.academyId = academyId;
    user.trackAthleteId = academyId;
    await user.save();
  } else if (user.trackAthleteId !== academyId) {
    user.trackAthleteId = academyId;
    await user.save();
  }

  let academy = linkedAcademy;
  if (!academy) academy = await Academy.findOne({ academyId });
  if (academy) {
    if (academy.userId && String(academy.userId) !== String(user._id)) {
      throw new Error('The permanent Academy ID is already linked to another account.');
    }
    const updates = {};
    if (!academy.userId) updates.userId = user._id;
    if (academy.academyId !== academyId) updates.academyId = academyId;
    if (Object.keys(updates).length) await Academy.updateOne({ _id: academy._id }, { $set: updates });
    return Academy.findById(academy._id);
  }

  const name = String(registration.academyName || user.academyName || user.name || '').trim();
  const contactPhone = String(registration.contactPhone || user.contactPhone || user.phone || '').trim();
  const location = getLocation(registration) || getLocation(user);
  if (!name || !contactPhone || !location) {
    throw new Error('Academy registration is missing the name, contact phone, or location required to create its academy profile.');
  }

  const addressInput = registration.address && typeof registration.address === 'object' ? registration.address : {};
  const addressLine1 = registration.addressLine1 ?? addressInput.addressLine1 ?? (typeof user.address === 'string' ? user.address : user.address?.addressLine1) ?? '';
  const addressLine2 = registration.addressLine2 ?? addressInput.addressLine2 ?? user.address?.addressLine2 ?? '';
  const city = registration.city ?? addressInput.city ?? user.city ?? '';
  const state = registration.state ?? addressInput.state ?? user.state ?? '';
  const pincode = registration.pincode ?? addressInput.pincode ?? user.address?.pincode ?? '';
  const country = registration.country ?? addressInput.country ?? user.address?.country ?? 'India';

  academy = await Academy.create({
    userId: user._id,
    academyId,
    name,
    contactPhone,
    email: String(registration.email || user.email || '').trim().toLowerCase(),
    address: { addressLine1, addressLine2, city, state, pincode, country },
    city,
    state,
    location,
    sports: normalizeSports(registration.sports || registration.sportsOffered || user.sportsOffered),
    rankingStats: normalizeStats(registration.rankingStats || user.rankingStats),
    verified: user.verified !== false
  });
  return academy;
}

module.exports = { synchronizeAcademyForUser, normalizeSports };
