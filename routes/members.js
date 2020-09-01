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
    if (err || !foundMember) {
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
    if (err || !foundMember) {
      res.redirect("/members");
    } else {
      res.render("members/edit", {member: foundMember});
    }
  });
});

router.put("/:id", middleware.hasAccessLevel(3), function(req, res) {
  req.body.member.id = req.sanitize(req.body.member.id);
  req.body.member.name = req.sanitize(req.body.member.name);
  Member.findByIdAndUpdate(req.params.id, req.body.member, function(err, foundMember) {
    if (err) {
      console.error(err);
      if (err.code == 11000)
        req.flash("error", "More than one member cannot have the same ID.");
      res.redirect("/members/" + req.params.id + "/edit");
    } else {
      if (req.body.member.id != foundMember.id) {
        foundMember.meetingsAttended.forEach(function(meetingDate) {
          Meeting.findOneAndUpdate({date: meetingDate}, {$pull: {"membersAttended": foundMember.id}}).exec();
          Meeting.findOneAndUpdate({date: meetingDate}, {$push: {"membersAttended": req.body.member.id}}).exec();
        });
      }
      Tutor.findOneAndUpdate({id: foundMember.id}, {id: req.body.member.id, name: req.body.member.name, grade: req.body.member.grade}).exec();
      res.redirect("/members/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
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
