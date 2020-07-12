const mongoose = require("mongoose"),
      shortid = require("shortid");

var meetingSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  date: {type: String, unique: true, required: true},
  description: {type: String, trim: true, required: false, default: "No meeting description"},
  membersAttended: {type: [String], required: true, default: []}
});

module.exports = mongoose.model("Meeting", meetingSchema);
