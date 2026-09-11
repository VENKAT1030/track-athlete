const mongoose = require('mongoose');

const AthleteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  athleteId: { type: String, required: true, unique: true }, // e.g. ATH-7K4M92XQ
  
  // Personal Info
  fullName: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  
  // Contact Info
  phone: { type: String, required: true },
  
  // Address Structure
  address: {
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  
  // Sport Info
  sport: {
    primarySport: { type: String, required: true },
    otherSport: { type: String, default: '' }
  },
  
  // Single Consolidated Combined Certificate PDF Metadata & Base64 PDF Data (Max 1MB)
  certificate: {
    fileName: String,
    fileSize: Number, // in bytes
    mimeType: { type: String, default: 'application/pdf' },
    fileData: String, // Base64 PDF data string
    updatedAt: Date
  },

  // Multiple Achievements Array with optional proof photos / images
  achievements: [{
    type: { type: String, enum: ['ranking', 'medal'], default: 'medal' },
    title: { type: String, required: true },
    rank: { type: Number },
    medal: { type: String, enum: ['Gold', 'Silver', 'Bronze', 'Participation'] },
    competition: { type: String, required: true },
    year: { type: Number, required: true },
    description: { type: String, default: '' },
    image: { type: String }, // Base64 proof photo / image
    createdAt: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Athlete', AthleteSchema);
