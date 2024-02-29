const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  tokens: [String] // Array of tokens to which the notification was sent
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
