const express = require("express"),
      router = express.Router(),
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
  //Meeting.deleteMany({}, function(err, deletedMeetings){ console.log("Deleted all meetings from the database: " + JSON.stringify(deletedMeetings)); });
  //Member.deleteMany({accessLevel: {$lte: 0}}, function(err, deletedMembers){ console.log("Deleted all members from the database: " + JSON.stringify(deletedMembers)); });
  if (req.body.membersFile)
    Member.create(xlsx.parseMembers(req.body.membersFile), {useFindAndModify: true}, function(err, newMembers){});
  res.redirect("/");
});

module.exports = router;
