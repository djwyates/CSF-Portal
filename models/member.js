const mongoose = require("mongoose"),
      shortid = require("shortid");

var memberSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  id: {type: String, minlength: 9, maxlength: 9, trim: true, unique: true, required: true, validate: {validator: function(v) {return /^\d{9}$/.test(v);}}},
  name: {type: String, trim: true, required: true},
  grade: {type: Number, min: 9, max: 12, required: true},
  termCount: {type: Number, min: 0, max: 7, required: true},
  attendance: {type: [{type: String, ref: "AttendanceRecord"}], required: true, default: []},
  accessLevel: {type: Number, min: 0, max: 3, required: true, default: 0},
  tutorID: {type: String, ref: "Tutor", required: false},
  tuteeID: {type: String, ref: "Tutee", required: false}
});

module.exports = mongoose.model("Member", memberSchema);
