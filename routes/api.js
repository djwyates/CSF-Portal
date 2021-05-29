const express = require("express"),
      router = express.Router(),
      attendance = require("../services/attendance");

router.put("/record-attendance", function(req, res) {
  // TODO: Add API keys to MongoDB instead of hard-coding them, with a method to generate, view & toggle their activity
  if (!req.body.accessKey || req.body.accessKey !== "mADYFVsqLwH0THFp4uaLpJtQ46G89Z2aAq0iHZcAsjjQXP1ucZU8VsgamzTeZwMw")
    return res.end("Invalid API key");
  if (!req.body.id || !req.body.meetingDate)
    return res.end("Missing meeting date or ID");
  if (typeof req.body.id !== "string" || typeof req.body.meetingDate !== "string")
    return res.end("Invalid meeting date or ID");
  attendance.add(req.body.meetingDate, req.body.id, "API");
  res.end("Attendance recorded if the meeting date and member ID is valid");
});

module.exports = router;
