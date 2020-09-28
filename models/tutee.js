const mongoose = require("mongoose"),
      shortid = require("shortid");

var tuteeSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  id: {type: String, minlength: 9, maxlength: 9, trim: true, unique: true, required: true, validate: {validator: function(v) {return /^\d{9}$/.test(v);}}},
  name: {type: String, trim: true, required: true},
  gender: {type: String, enum: ["Male", "Female"], required: true},
  grade: {type: Number, min: 9, max: 12, required: true},
  email: {type: String, required: true, validate: {validator: function(v) {return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(v);}}},
  phoneNum: {type: String, validate: {validator: function(v) {return /\d{3}-\d{3}-\d{4}/.test(v);}}, required: true},
  parentName: {type: String, trim: true, required: true},
  parentEmail: {type: String, required: true, validate: {validator: function(v) {return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(v);}}},
  parentPhoneNum: {type: String, required: true, validate: {validator: function(v) {return /\d{3}-\d{3}-\d{4}/.test(v);}}},
  paymentForm: {type: String, enum: ["Service", "Both"], required: true},
  courses: {type: [String], required: true},
  tutorSessions: {type: [{
    tutorID: {type: String, ref: "Tutor", required: true},
    courses: {type: [String], required: true},
    status: {type: String, enum: ["Pending", "Active", "Inactive"], required: true}
  }], _id: false, required: true, default: []},
  createdOn: {type: String, required: true, default: "No date found"}
});

module.exports = mongoose.model("Tutee", tuteeSchema);
