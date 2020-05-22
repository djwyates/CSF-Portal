const express = require("express"),
      router = express.Router(),
      fs = require("fs"),
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

router.get("/term-migration", middleware.hasAccessLevel(3), function(req, res) {
  res.render("settings/term-migration");
});

router.put("/term-migration", middleware.hasAccessLevel(3), function(req, res) {
  var currentDate = new Date().toJSON().slice(0,10).replace(/-/g,'-');
  if (!fs.existsSync("./backups/term-migration/" + currentDate))
    fs.mkdirSync("./backups/term-migration/" + currentDate, {recursive: true}, function(err){});
  Meeting.find({}, function(err, meetings) {
    if (err || !meetings) {
      res.redirect("/term-migration");
    } else {
      if (!fs.existsSync("./backups/term-migration/" + currentDate + "/meetings.txt"), function(err) {
        fs.writeFile("./backups/term-migration/" + currentDate + "/meetings.txt", meetings, function(err){});
      });
    }
  });
  Member.find({}, function(err, members) {
    if (err || !members) {
      res.redirect("/term-migration");
    } else {
      var qualifyingMembers = [];
      members.forEach(function(member) {
        if (member.meetingsAttended.length >= req.body.minMeetings)
          qualifyingMembers.push(member);
      });
      if (!fs.existsSync("./backups/term-migration/" + currentDate + "/members.txt"))
        fs.writeFile("./backups/term-migration/" + currentDate + "/members.txt", members, function(err){});
      if (!fs.existsSync("./backups/term-migration/" + currentDate + "/membersQualifying.txt"))
        fs.writeFile("./backups/term-migration/" + currentDate + "/membersQualifying.txt", qualifyingMembers, function(err){});
    }
  });
  Meeting.deleteMany({accessLevel: {$lte: 0}}, function(err, deletedMeetings){ console.log("Deleted all meetings from the database: " + JSON.stringify(deletedMeetings)); });
  Member.deleteMany({}, function(err, deletedMembers){ console.log("Deleted all members from the database: " + JSON.stringify(deletedMembers)); });
  res.redirect("/");
});

function getQualifyingMembers(minMeetings) {

}

module.exports = router;
