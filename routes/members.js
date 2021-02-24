const express = require("express"),
      router = express.Router(),
      auth = require("../middleware/auth"),
      search = require("../middleware/search"),
      attendance = require("../services/attendance"),
      backup = require("../services/backup"),
      Member = require("../models/member"),
      Meeting = require("../models/meeting"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee"),
      AttendanceRecord = require("../models/attendance-record");

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
      Member.findOne({id: req.query.id}).populate("attendance").exec(function(err, foundMember) {
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

router.get("/", auth.hasAccessLevel(1), function(req, res) {
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

router.get("/new", auth.hasAccessLevel(3), function(req, res) {
  res.render("members/new");
});

router.post("/", auth.hasAccessLevel(3), function(req, res) {
  req.body.member.id = req.sanitize(req.body.member.id);
  req.body.member.name = req.sanitize(req.body.member.name);
  Member.create(req.body.member, function(err, newMember) {
    if (err) {
      console.error(err);
      if (err.code == 11000)
        req.flash("error", "More than one member cannot have the same ID.");
      res.redirect("members/new");
    } else {
      Tutor.findOne({id: newMember.id}, function(err, tutor) {
        if (tutor) {
          Tutor.findByIdAndUpdate(tutor._id, {name: newMember.name, grade: newMember.grade}).exec();
          Member.findByIdAndUpdate(newMember._id, {tutorID: tutor._id}).exec();
        }
        Tutee.findOne({id: newMember.id}, function(err, tutee) {
          if (tutee) Member.findByIdAndUpdate(newMember._id, {tuteeID: tutee._id}).exec();
          res.redirect("/members");
        });
      });
    }
  });
});

router.get("/:id", auth.hasAccessLevel(1), search.member, function(req, res) {
  Meeting.find({}, function(err, meetings) {
    meetings.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.render("members/show", {member: res.locals.member, meetings: meetings});
  });
});

router.get("/:id/edit", auth.hasAccessLevel(1), search.member, function(req, res) {
  Meeting.find({}, function(err, meetings) {
    meetings.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.render("members/edit", {member: res.locals.member, meetings: meetings});
  });
});

router.put("/:id", auth.hasAccessLevel(1), search.member, function(req, res) {
  var oldMemberID = res.locals.member.id;
  var memberID = (req.user.accessLevel >= 3 && /^\d{9}$/.test(req.sanitize(req.body.member.id))) ? req.sanitize(req.body.member.id) : res.locals.member.id;
  /* updates the member's attendance */
  if (req.body.member.attendance) {
    /* finds all attended & unattended meetings */
    var notAttended = [], attended = [];
    for (var meetingDate in req.body.member.attendance) {
      if (req.body.member.attendance[meetingDate].includes("Not attended"))
        notAttended.push(meetingDate);
      else if (req.body.member.attendance[meetingDate].includes("Attended"))
        attended.push(meetingDate);
    }
    /* removes/adds attendance records of unattended/attended meetings */
    notAttended.forEach(function(meetingDate) {
      attendance.remove(meetingDate, oldMemberID);
    });
    attended.forEach(function(meetingDate) {
      AttendanceRecord.exists({meetingDate: meetingDate, memberID: memberID}, function(err, recordExists) {
        if (!recordExists) attendance.add(meetingDate, memberID);
        else if (memberID != oldMemberID) AttendanceRecord.findByIdAndUpdate(record._id, {memberID: memberID}).exec();
      });
    });
  }
  if (req.user.accessLevel < 3) return res.redirect("/members/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
  /* updates the member's other attributes if user is an admin */
  var editedMember = {
    id: memberID,
    name: req.sanitize(req.body.member.name),
    grade: req.body.member.grade,
    termCount: req.body.member.termCount,
    accessLevel: req.body.member.accessLevel
  }
  Member.findByIdAndUpdate(req.params.id, editedMember, function(err, foundMember) {
    if (err) {
      console.error(err);
      if (err.code == 11000)
        req.flash("error", "More than one member cannot have the same ID.");
      res.redirect("/members/" + req.params.id + "/edit");
    } else {
      Tutor.findOneAndUpdate({id: foundMember.id}, {id: editedMember.id, name: editedMember.name, grade: editedMember.grade}).exec();
      res.redirect("/members/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.delete("/:id", auth.hasAccessLevel(3), search.member, function(req, res) {
  Member.findByIdAndDelete(req.params.id, function(err, deletedMember) {
    if (err) {
      console.error(err);
      res.redirect("/members");
    } else {
      backup.create(res.locals.member.id, "Member", "deleted", res.locals.member.toObject());
      deletedMember.attendance.forEach(function(recordID) {
        attendance.removeById(recordID);
      });
      res.redirect(req.query.from ? req.query.from : "/members");
    }
  });
});

module.exports = router;
