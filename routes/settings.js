const express = require("express"),
      router = express.Router(),
      Member = require("../models/member"),
      Meeting = require("../models/meeting"),
      middleware = require("../middleware/index")

router.get("/", middleware.hasAccessLevel(3), function(req, res) {
  res.render("settings/index");
});

router.get("/permissions", middleware.hasAccessLevel(3), function(req, res) {
  Member.find({accessLevel: {$gte: 1}}, function(err, members) {
    if (err) {
      console.log(err);
    } else {
      res.render("settings/permissions", {members: members});
    }
  });
});

router.get("/termmigration", middleware.hasAccessLevel(3), function(req, res) {
  res.render("settings/termmigration");
});

router.put("/termmigration", middleware.hasAccessLevel(3), function(req, res) {
  Meeting.deleteMany({}, function(err, deletedMeetings){ console.log("Deleted all meetings from the database: " + JSON.stringify(deletedMeetings)); });
  Member.deleteMany({}, function(err, deletedMembers){ console.log("Deleted all members from the database: " + JSON.stringify(deletedMembers)); });
  res.redirect("/");
});

module.exports = router;
