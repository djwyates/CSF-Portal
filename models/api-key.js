const mongoose = require("mongoose"),
      nanoid = require("nanoid"),
      utils = require("../services/utils");

var apiKeySchema = new mongoose.Schema({
  _id: {type: String, default: function() { return nanoid(10); }},
  key: {type: String, required: true, default: nanoid},
  scope: {type: String, enum: ["record-attendance", "none"], required: true, default: "none"},
  createdOn: {type: String, required: true, default: "None found"},
  lastUsed: {type: String, required: true, default: "N/A"},
  totalUses: {type: Number, required: true, default: 0}
});

apiKeySchema.pre("save", function(next) {
  var apiKey = this;
  if (apiKey.isNew) apiKey.createdOn = utils.getCurrentDate();
  next();
});

apiKeySchema.methods.recordUse = function() {
  this.lastUsed = utils.getCurrentDate();
  this.totalUses += 1;
  this.save();
}

module.exports = mongoose.model("ApiKey", apiKeySchema);
