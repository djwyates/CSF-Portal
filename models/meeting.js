const mongoose = require("mongoose");

var meetingSchema = new mongoose.Schema({
  _id: Number,
  date: String,
  description: String,
  membersAttended: Array
});

module.exports = mongoose.model("Meeting", meetingSchema);
