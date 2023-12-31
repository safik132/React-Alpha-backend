const mongoose = require('mongoose');

const PunchRecordSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  punchIn: {
    type: Date,
    required: true
  },
  punchOut: {
    type: Date,
    required: false
  },
  loggedInAt: {
    type: Date,
    required: false // You may want to set this when the user logs in
  },
  
  lat: { type: Number, required: false },
  lon: { type: Number, required: false },
  
  formattedDate: {
    type: String,
  },
});


module.exports = mongoose.model('PunchRecord', PunchRecordSchema);
