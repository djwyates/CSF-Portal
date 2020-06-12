const mongoose = require("mongoose"),
      shortid = require("shortid");

var tutorSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  id: {type: String, minlength: 9, maxlength: 9, trim: true, unique: true, required: true},
  name: {type: String, trim: true, required: true},
  grade: {type: Number, min: 9, max: 12, required: true},
  pfp: {type: String, required: true},
  /* tutor-specific data */
  gender: {type: String, enum: ["Male", "Female"], required: true},
  email: {type: String, required: true},
  phoneNum: {type: String, required: true},
  verified: {type: Boolean, required: true, default: false},
  verifiedPhone: {type: Boolean, required: true, default: false},
  paymentForm: {type: String, enum: ["Cash", "Both"], required: true},
  courses: {type: [String], required: true},
  maxTutees: {type: Number, min: 1, max: 3, required: true},
  currentTutees: {type: [{tutee: String, course: String}], required: true, default: []}
});

module.exports = mongoose.model("Tutor", tutorSchema);
