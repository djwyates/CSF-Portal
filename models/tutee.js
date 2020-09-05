const mongoose = require("mongoose"),
      shortid = require("shortid");

var tuteeSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  id: {type: String, minlength: 9, maxlength: 9, trim: true, unique: true, required: true},
  name: {type: String, trim: true, required: true},
  gender: {type: String, enum: ["Male", "Female"], required: true},
  grade: {type: Number, min: 9, max: 12, required: true},
  email: {type: String, required: true},
  phoneNum: {type: String, validate: {validator: function(v) {return /\d{3}-\d{3}-\d{4}/.test(v);}}, required: true},
  parentName: {type: String, trim: true, required: true},
  parentEmail: {type: String, required: true},
  parentPhoneNum: {type: String, validate: {validator: function(v) {return /\d{3}-\d{3}-\d{4}/.test(v);}}, required: true},
  paymentForm: {type: String, enum: ["Service", "Both"], required: true},
  courses: {type: [String], required: true},
  tutorSessions: {type: [{
    course: {type: String, required: true},
    tutorID: {type: String, required: false},
    status: {type: String, enum: ["Unpaired", "Unnotified", "Pending", "Active", "Inactive"], required: true}
  }], required: true, default: []},
  createdOn: {type: String, required: true, default: "No date found"}
});

module.exports = mongoose.model("Tutee", tuteeSchema);
