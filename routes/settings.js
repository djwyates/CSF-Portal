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

module.exports = router;
