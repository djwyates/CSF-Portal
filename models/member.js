const mongoose = require("mongoose");

var memberSchema = new mongoose.Schema({
  _id: String,
  name: String,
  grade: {type: Number, min: 9, max: 12},
  termCount: {type: Number, min: 0, max: 7},
  meetingsAttended: {type: [String]},
  accessLevel: {type: Number, min: 0, max: 3}
});

module.exports = mongoose.model("Member", memberSchema);
