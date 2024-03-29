const mongoose = require("mongoose"),
      nanoid = require("nanoid");

var tutorSchema = new mongoose.Schema({
  _id: {type: String, default: function() { return nanoid(10); }},
  id: {type: String, minlength: 9, maxlength: 9, trim: true, unique: true, required: true, validate: {validator: function(v) {return /^\d{9}$/.test(v);}}},
  name: {type: String, trim: true, required: true},
  grade: {type: Number, min: 9, max: 12, required: true},
  /* tutor-specific info */
  gender: {type: String, enum: ["Male", "Female"], required: true},
  email: {type: String, required: true, validate: {validator: function(v) {return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(v);}}},
  phoneNum: {type: String, required: true, validate: {validator: function(v) {return /\d{3}-\d{3}-\d{4}/.test(v);}}},
  verified: {type: Boolean, required: true, default: false},
  verifiedPhone: {type: Boolean, required: true, default: false},
  paymentForm: {type: String, enum: ["Cash", "Both"], required: true},
  courses: {type: [String], required: true},
  maxTutees: {type: Number, min: 0, max: 3, required: true},
  tuteeSessions: {type: [{
    tuteeID: {type: String, ref: "Tutee", required: true},
    courses: {type: [String], required: true},
    status: {type: String, enum: ["Pending", "Active", "Inactive"], required: true},
    firstNotified: {type: String, required: false},
    lastNotified: {type: String, required: false}
  }], _id: false, required: true, default: []},
  warnings: {type: Number, min: 0, required: true, default: 0},
  verification: {
    code: {type: String, required: false},
    lastSent: {type: String, required: false}
  },
  active: {type: Boolean, required: true, default: true}
});

module.exports = mongoose.model("Tutor", tutorSchema);
