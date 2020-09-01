const mongoose = require("mongoose"),
      shortid = require("shortid");

var tutorSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  id: {type: String, minlength: 9, maxlength: 9, trim: true, unique: true, required: true},
  name: {type: String, trim: true, required: true},
  grade: {type: Number, min: 9, max: 12, required: true},
  /* tutor-specific info */
  gender: {type: String, enum: ["Male", "Female"], required: true},
  email: {type: String, required: true},
  phoneNum: {type: String, required: true},
  verified: {type: Boolean, required: true, default: false},
  verifiedPhone: {type: Boolean, required: true, default: false},
  paymentForm: {type: String, enum: ["Cash", "Both"], required: true},
  courses: {type: [String], required: true},
  maxTutees: {type: Number, min: 1, max: 3, required: true},
  tuteeSessions: {type: Array, required: true, default: []},
  verification: {
    code: {type: String, required: false},
    timesSent: {type: Number, required: false},
    lastSent: {type: String, required: false}
  }
});

module.exports = mongoose.model("Tutor", tutorSchema);
