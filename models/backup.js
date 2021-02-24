const mongoose = require("mongoose"),
      shortid = require("shortid");

var backupSchema = new mongoose.Schema({
  _id: {type: String, default: shortid.generate},
  name: {type: String, required: true, default: "backup"},
  type: {type: String, enum: ["Meeting", "Meetings", "Member", "Members", "Tutors", "Tutee", "Tutees"], required: true},
  category: {type: String, enum: ["deleted", "replaced", "term-migration"], required: true},
  createdOn: {type: String, required: true, default: "No date found"},
  data: {type: mongoose.Mixed, required: true}
});

module.exports = mongoose.model("Backup", backupSchema);
