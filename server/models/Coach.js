const mongoose = require('mongoose');

const CoachSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  coachId: { type: String, required: true, unique: true }, // e.g. COA-7K4M92XQ

  // Personal Info
  fullName: { type: String, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },

  // Contact Info
  phone: { type: String, default: '' },

  // Address Structure
  address: {
    addressLine1: { type: String, default: '' },
    addressLine2: { type: String, default: '' },
    city: { type: String, default: 'Vijayawada' },
    state: { type: String, default: 'Andhra Pradesh' },
    pincode: { type: String, default: '520001' },
    country: { type: String, default: 'India' }
  },

  // Sport Info
  sport: {
    primarySport: { type: String, required: true, default: 'Taekwondo' },
    otherSport: { type: String, default: '' }
  },

  // Specialization & Experience
  yearsExperience: { type: Number, default: 5 },
  certifications: [{ type: String }],
  bio: { type: String, default: '' },
  acceptingAthletes: { type: Boolean, default: true },

  // Certificate / Accreditation PDF Metadata & Base64 PDF Data (Max 1MB)
  certificate: {
    fileName: String,
    fileSize: Number, // in bytes
    mimeType: { type: String, default: 'application/pdf' },
    fileData: String, // Base64 data string
    updatedAt: Date
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Coach', CoachSchema);
