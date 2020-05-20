const mongoose = require("mongoose");

var memberSchema = new mongoose.Schema({
  _id: String,
  name: {type: String, required: true},
  grade: {type: Number, min: 9, max: 12, required: true},
  termCount: {type: Number, min: 0, max: 7, required: true},
  meetingsAttended: {type: [String], required: true, default: []},
  accessLevel: {type: Number, min: 0, max: 3, required: true} /* 0: Member, 1: Officer, 2: Tutoring Coordinator, 3: Developer / Advisor */
});

module.exports = mongoose.model("Member", memberSchema);
