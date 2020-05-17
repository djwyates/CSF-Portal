const mongoose = require("mongoose");

var meetingSchema = new mongoose.Schema({
  number: Number,
  date: String,
  description: String,
  membersAttended: Array
});

module.exports = mongoose.model("Meeting", meetingSchema);
