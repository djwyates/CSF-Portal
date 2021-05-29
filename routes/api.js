const express = require("express"),
      router = express.Router(),
      attendance = require("../services/attendance"),
      ApiKey = require("../models/api-key");

router.put("/record-attendance", function(req, res) {
  if (!req.body.accessKey)
    return res.end("Must authenticate with an API key");
  if (!req.body.id || !req.body.meetingDate)
    return res.end("Missing meeting date or ID");
  if (typeof req.body.id !== "string" || typeof req.body.meetingDate !== "string"
  || !/^\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01])$/.test(req.body.meetingDate) || !/^\d{9}$/.test(req.body.id))
    return res.end("Invalid meeting date (YYYY-MM-DD) or ID");
  ApiKey.findOne({key: req.body.accessKey, scope: "record-attendance"}, function(err, apiKey) {
    if (!apiKey) return res.end("Invalid API key");
    apiKey.recordUse();
    attendance.add(req.body.meetingDate, req.body.id, "API");
    res.end("Attendance recorded if the meeting date and member ID exists");
  });
});

module.exports = router;
