const express = require("express"),
      router = express.Router(),
      fs = require("fs"),
      Member = require("../models/member"),
      Meeting = require("../models/meeting"),
      middleware = require("../middleware/index"),
      backup = require("../services/backup.js"),
      xlsx = require("../services/xlsx.js")

router.get("/", middleware.hasAccessLevel(3), function(req, res) {
  res.render("settings/index");
});

router.get("/permissions", middleware.hasAccessLevel(3), function(req, res) {
  Member.find({accessLevel: {$gte: 1}}, function(err, members) {
    if (err) {
      console.error(err);
    } else {
      res.render("settings/permissions", {members: members});
    }
  });
});

router.get("/term-migration", middleware.hasAccessLevel(3), function(req, res) {
  res.render("settings/term-migration");
});

router.put("/term-migration", middleware.hasAccessLevel(3), function(req, res) {
  var currentDate = new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).slice(0,8).replace(/\//g, "-");
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/meetings.txt", Meeting);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/members.txt", Member);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/membersQualifying.txt", Member, function(members) {
    var qualifyingMembers = [];
    members.forEach(function(member) {
      if (member.meetingsAttended.length >= req.body.minMeetings)
        qualifyingMembers.push(member);
    });
    return qualifyingMembers;
  });
  Meeting.deleteMany({}, function(err, deletedMeetings){ console.log("Deleted all meetings from the database: " + JSON.stringify(deletedMeetings)); });
  Member.deleteMany({accessLevel: {$lte: 0}}, function(err, deletedMembers) {
    console.log("Deleted all members who are not officers from the database: " + JSON.stringify(deletedMembers));
    Member.updateMany({}, {$inc: {"termCount": 1}, meetingsAttended: []}, function(err, updatedMembers){});
    if (req.files.newMembers) {
      req.files.newMembers.mv(req.files.newMembers.name, function() {
        Member.create(xlsx.parseMembers(req.files.newMembers.name), {useFindAndModify: true}, function(err, newMembers){ fs.unlink(req.files.newMembers.name, function(err){}); });
      });
    }
  });
  res.redirect("/");
});

router.get("/restore-from-backup", middleware.hasAccessLevel(3), function(req, res) {
  res.render("settings/restore-from-backup");
});

module.exports = router;
