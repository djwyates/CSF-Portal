const mongoose = require("mongoose"),
      shortid = require("shortid");

var attendanceRecordSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  meetingDate: {type: String, required: true, validate: {validator: function(v) {return /^\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])$/.test(v);}}, default: "None found"},
  memberID: {type: String, required: true, validate: {validator: function(v) {return /^\d{9}$/.test(v);}}, default: "None found"},
  recordedBy: {type: String, required: true, default: "None found"},
  timestamp: {type: String, required: true, default: "None found"}
});

module.exports = mongoose.model("AttendanceRecord", attendanceRecordSchema);
