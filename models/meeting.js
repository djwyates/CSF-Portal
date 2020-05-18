const mongoose = require("mongoose");

var meetingSchema = new mongoose.Schema({
  date: String,
  description: String,
  membersAttended: {type: [String]}
});

module.exports = mongoose.model("Meeting", meetingSchema);
