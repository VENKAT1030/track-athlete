require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Academy = require('../models/Academy');
const { synchronizeAcademyForUser } = require('../services/academySync.service');

async function reconcileAcademies() {
  await connectDB();
  const duplicateLinks = await Academy.aggregate([
    { $match: { userId: { $ne: null } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  if (duplicateLinks.length) {
    throw new Error(`Refusing reconciliation: ${duplicateLinks.length} academy user link(s) are duplicated.`);
  }

  const users = await User.find({ role: 'academy' });
  const summary = { scanned: users.length, synchronized: 0, skipped: [] };
  for (const user of users) {
    try {
      await synchronizeAcademyForUser(user);
      summary.synchronized++;
    } catch (error) {
      // Never manufacture missing required profile data during a repair.
      summary.skipped.push({ userId: String(user._id), reason: error.message });
    }
  }
  return summary;
}

reconcileAcademies()
  .then(summary => console.log(JSON.stringify(summary, null, 2)))
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
