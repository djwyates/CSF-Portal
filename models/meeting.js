const mongoose = require("mongoose"),
      nanoid = require("nanoid");

var meetingSchema = new mongoose.Schema({
  _id: {type: String, default: function() { return nanoid(10); }},
  date: {
    type: String,
    unique: true,
    required: true,
    validate: {validator: function(v) {return /^\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])$/.test(v);}} /* YYYY-MM-DD format */
  },
  description: {type: String, trim: true, required: false, default: "No meeting description"},
  attendance: {type: [{type: String, ref: "AttendanceRecord"}], required: true, default: []}
});

module.exports = mongoose.model("Meeting", meetingSchema);
