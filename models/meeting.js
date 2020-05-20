const mongoose = require("mongoose"),
      shortid = require("shortid")

var meetingSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  date: {type: String, required: true},
  description: {type: String, required: false},
  membersAttended: {type: [String], required: true, default: []}
});

module.exports = mongoose.model("Meeting", meetingSchema);
