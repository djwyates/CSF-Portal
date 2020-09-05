const express = require("express"),
      router = express.Router(),
      middleware = require("../middleware/index"),
      backup = require("../services/backup"),
      Member = require("../models/member"),
      Meeting = require("../models/meeting"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

router.get("/attendance", function(req, res) {
  Meeting.find({}, function(err, meetings) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/members/attendance");
    } else {
      meetings.sort((a, b) => new Date(a.date) - new Date(b.date));
      if (!req.query.id)
        return res.render("members/attendance", {member: null, meetings: meetings});
      req.query.id = req.sanitize(req.query.id.trim());
      Member.findOne({id: req.query.id}, function(err, foundMember) {
        if (err) {
          console.error(err);
          req.flash("error", "An unexpected error occurred.");
          res.redirect("/members/attendance");
        } else if (!foundMember) {
          req.flash("error", "That member does not exist. ID entered: " + req.query.id);
          res.redirect("/members/attendance");
        } else
          res.render("members/attendance", {member: foundMember, meetings: meetings});
      });
    }
  });
});

router.get("/", middleware.hasAccessLevel(1), function(req, res) {
  Member.find({}, function(err, members) {
    if (err) {
      console.error(err);
    } else {
      members.sort(function(a, b) {
        var aLastName = a.name.split(" ")[a.name.split(" ").length-1], bLastName = b.name.split(" ")[b.name.split(" ").length-1];
        return (aLastName < bLastName) ? -1 : (aLastName > bLastName) ? 1 : 0;
      });
      Meeting.countDocuments({}, function(err, meetingsCount) {
        if (err) {
          console.error(err);
        } else {
          res.render("members/index", {members: members, meetingsCount: meetingsCount});
        }
      });
    }
  });
});

router.get("/new", middleware.hasAccessLevel(3), function(req, res) {
  res.render("members/new");
});

router.post("/", middleware.hasAccessLevel(3), function(req, res) {
  req.body.member.id = req.sanitize(req.body.member.id);
  req.body.member.name = req.sanitize(req.body.member.name);
  Member.create([req.body.member], function(err, newMember) {
    if (err) {
      console.error(err);
      if (err.code == 11000)
        req.flash("error", "More than one member cannot have the same ID.");
      res.redirect("members/new");
    } else {
      Tutor.findOne({id: newMember[0].id}, function(err, tutor) {
        if (tutor) Member.findByIdAndUpdate(newMember[0]._id, {tutorID: tutor._id}).exec();
        Tutee.findOne({id: newMember[0].id}, function(err, tutee) {
          if (tutee) Member.findByIdAndUpdate(newMember[0]._id, {tuteeID: tutee._id}).exec();
          res.redirect("/members");
        });
      });
    }
  });
});

router.get("/:id", middleware.hasAccessLevel(1), function(req, res) {
  Member.findById(req.params.id, function(err, foundMember) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/members");
    } else if (!foundMember) {
      res.redirect("/members");
    } else {
      Meeting.find({}, function(err, meetings) {
        meetings.sort((a, b) => new Date(a.date) - new Date(b.date));
        res.render("members/show", {member: foundMember, meetings: meetings});
      });
    }
  });
});

router.get("/:id/edit", middleware.hasAccessLevel(3), function(req, res) {
  Member.findById(req.params.id, function(err, foundMember) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/members/" + req.params.id);
    } else if (!foundMember) {
      res.redirect("/members");
    } else {
      Meeting.find({}, function(err, meetings) {
        meetings.sort((a, b) => new Date(a.date) - new Date(b.date));
        res.render("members/edit", {member: foundMember, meetings: meetings});
      });
    }
  });
});

router.put("/:id", middleware.hasAccessLevel(3), function(req, res) {
  var editedMember = [{
    id: req.sanitize(req.body.member.id),
    name: req.sanitize(req.body.member.name),
    grade: req.body.member.grade,
    termCount: req.body.member.termCount,
    accessLevel: req.body.member.accessLevel,
    $addToSet: {meetingsAttended: {$each: []}}
  }, {$pull: {meetingsAttended: {$in: []}}}];
  if (req.body.member.attendance) {
    for (var meetingDate in req.body.member.attendance) {
      if (req.body.member.attendance[meetingDate].includes("Not attended"))
        editedMember[1].$pull.meetingsAttended.$in.push(meetingDate);
      else if (req.body.member.attendance[meetingDate].includes("Attended"))
        editedMember[0].$addToSet.meetingsAttended.$each.push(meetingDate);
    }
  }
  Member.findByIdAndUpdate(req.params.id, editedMember[1], function(err, foundMember1) {
    Member.findByIdAndUpdate(req.params.id, editedMember[0], function(err, foundMember) {
      if (err) {
        console.error(err);
        if (err.code == 11000)
          req.flash("error", "More than one member cannot have the same ID.");
        res.redirect("/members/" + req.params.id + "/edit");
      } else {
        var pulledFromMeetingsAttended = editedMember[1].$pull.meetingsAttended.$in;
        var allMeetingsAttended = foundMember.meetingsAttended.filter(date => !pulledFromMeetingsAttended.includes(date)).concat(editedMember[0].$addToSet.meetingsAttended.$each);
        pulledFromMeetingsAttended.forEach(function(meetingDate) {
          Meeting.findOneAndUpdate({date: meetingDate}, {$pull: {membersAttended: foundMember.id}}).exec();
        });
        allMeetingsAttended.forEach(function(meetingDate) {
          if (editedMember[0].id != foundMember.id) Meeting.findOneAndUpdate({date: meetingDate}, {$pull: {"membersAttended": foundMember.id}}).exec();
          Meeting.findOneAndUpdate({date: meetingDate}, {$addToSet: {"membersAttended": editedMember[0].id}}).exec();
        });
        Tutor.findOneAndUpdate({id: foundMember.id}, {id: editedMember[0].id, name: editedMember[0].name, grade: editedMember[0].grade}).exec();
        res.redirect("/members/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
      }
    });
  });
});

router.delete("/:id", middleware.hasAccessLevel(3), function(req, res) {
  Member.findByIdAndDelete(req.params.id, function(err, deletedMember) {
    if (err) {
      console.error(err);
      res.redirect("/members");
    } else {
      backup.object("./backups/deleted/members/" + deletedMember.id + ".txt", deletedMember.toObject());
      deletedMember.meetingsAttended.forEach(function(meetingDate) {
        Meeting.findOneAndUpdate({date: meetingDate}, {$pull: {"membersAttended": deletedMember.id}}, function(err, foundMeeting){});
      });
      res.redirect(req.query.from ? req.query.from : "/members");
    }
  });
});

module.exports = router;
