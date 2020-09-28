const mongoose = require("mongoose"),
      shortid = require("shortid");

var meetingSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  date: {type: String, unique: true, required: true, validate: {validator: function(v) {return /^\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])$/.test(v);}}},
  description: {type: String, trim: true, required: false, default: "No meeting description"},
  membersAttended: {type: [String], required: true, default: []}
});

module.exports = mongoose.model("Meeting", meetingSchema);
