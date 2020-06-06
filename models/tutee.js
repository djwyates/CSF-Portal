const mongoose = require("mongoose"),
      shortid = require("shortid")

var tuteeSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  id: {type: String, minlength: 9, maxlength: 9, trim: true, required: true},
  name: {type: String, trim: true, required: true},
  gender: {type: String, enum: ["Male", "Female"], required: true},
  grade: {type: Number, min: 9, max: 12, required: true},
  pfp: {type: String, required: true},
  email: {type: String, required: true},
  phoneNum: {type: String, required: true},
  parentName: {type: String, trim: true, required: true},
  parentEmail: {type: String, required: true},
  parentPhoneNum: {type: String, required: true},
  paymentForm: {type: String, enum: ["Service", "Both"], required: true},
  courses: {type: [String], required: true},
  currentTutors: {
    type: [{course: String, tutor: String}],
    required: true,
    default: function() {
      var currentTutors = [];
      this.courses.forEach(funciton(course) {
        currentTutors.push({course: course, tutor: null});
      });
      return currentTutors;
    }}
});

module.exports = mongoose.model("Tutee", tuteeSchema);
