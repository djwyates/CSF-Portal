const mongoose = require("mongoose"),
      shortid = require("shortid");

var memberSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  id: {type: String, minlength: 9, maxlength: 9, trim: true, unique: true, required: true},
  name: {type: String, trim: true, required: true},
  grade: {type: Number, min: 9, max: 12, required: true},
  termCount: {type: Number, min: 0, max: 7, required: true},
  meetingsAttended: {type: [String], required: true, default: []},
  accessLevel: {type: Number, min: 0, max: 3, required: true, default: 0},
  pfp: {type: String, required: false}
});

module.exports = mongoose.model("Member", memberSchema);
