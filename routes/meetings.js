const express = require("express"),
      router = express.Router(),
      fs = require("fs");
      auth = require("../middleware/auth"),
      search = require("../middleware/search"),
      attendance = require("../services/attendance"),
      backup = require("../services/backup"),
      utils = require("../services/utils"),
      xlsx = require("../services/xlsx"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      AttendanceRecord = require("../models/attendance-record");

router.get("/", function(req, res) {
  Meeting.find({}, function(err, meetings) {
    if (err) {
      console.error(err);
    } else {
      meetings.sort((a, b) => new Date(a.date) - new Date(b.date));
      res.render("meetings/index", {meetings: meetings});
    }
  });
});

router.get("/new", auth.hasAccessLevel(1), function(req, res) {
  res.render("meetings/new");
});

router.post("/", auth.hasAccessLevel(1), function(req, res) {
  Meeting.create({date: req.body.meeting.date, description: req.sanitize(req.body.meeting.description)}, function(err, newMeeting) {
    if (err) {
      console.error(err);
      if (err.code == 11000) req.flash("error", "More than one meeting cannot have the same date.");
      else req.flash("error", "An unexpected error occurred.");
      res.redirect("meetings/new");
    } else
      res.redirect("/meetings");
  });
});

router.get("/:id", search.meeting, function(req, res) {
  res.render("meetings/show", {meeting: res.locals.meeting});
});

router.get("/:id/edit", auth.hasAccessLevel(1), search.meeting, function(req, res) {
  res.render("meetings/edit", {meeting: res.locals.meeting});
});

router.put("/:id", auth.hasAccessLevel(1), function(req, res) {
  Meeting.findByIdAndUpdate(req.params.id, {date: req.body.meeting.date, description: req.sanitize(req.body.meeting.description)}, function(err, foundMeeting) {
    if (err) {
      if (err.code == 11000) req.flash("error", "More than one meeting cannot have the same date.");
      else req.flash("error", "An unexpected error occurred.");
      res.redirect("/meetings/" + req.params.id + "/edit");
    } else {
      if (req.body.meeting.date != foundMeeting.date)
        AttendanceRecord.updateMany({date: foundMeeting.date}, {date: req.body.meeting.date}).exec();
      res.redirect("/meetings/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.delete("/:id", auth.hasAccessLevel(1), search.meeting, function(req, res) {
  Meeting.findByIdAndDelete(req.params.id, function(err, deletedMeeting) {
    if (err) {
      console.error(err);
      res.redirect("/meetings");
    } else {
      backup.create(res.locals.meeting.date, "Meeting", "deleted", res.locals.meeting.toObject());
      deletedMeeting.attendance.forEach(function(recordID) {
        attendance.removeById(recordID);
      });
      res.redirect(req.query.from ? req.query.from : "/meetings");
    }
  });
});

router.get("/:id/checkin", auth.hasAccessLevel(1), search.meeting, function(req, res) {
  res.render("meetings/checkin", {meeting: res.locals.meeting});
});

router.put("/:id/checkin", auth.hasAccessLevel(1), search.meeting, function(req, res) {
  var meeting = res.locals.meeting, flashMsg = "", attended = [], alreadyAttended = [], cantAttend = [];
  /* if an attendance spreadsheet was submitted */
  if (req.files && req.files.attendance && req.query.spreadsheet) {
    req.files.attendance.mv(req.files.attendance.name, function() {
      var parsedIDs = xlsx.parseIDs(req.files.attendance.name);
      fs.unlink(req.files.attendance.name, function(err){});
      Member.find({}, function(err, members) {
        AttendanceRecord.find({}, function(err, records) {
          parsedIDs.ids = new Set(parsedIDs.ids)
          parsedIDs.ids.forEach(function(id) {
            if (!members.find(m => m.id == id)) {
              cantAttend.push(id);
            } else if (!records.find(r => r.meetingDate == meeting.date && r.memberID == id)) {
              attendance.add(meeting.date, id, req.user.id || req.user.email);
              attended.push(id);
            } else {
              alreadyAttended.push(id);
            }
          });
          flashMsg += attended.length + " members from the spreadsheet attended the meeting.";
          if (alreadyAttended.length > 0)
            flashMsg += "<br>" + alreadyAttended.length + " members from the spreadsheet already attended the meeting.";
          if (cantAttend.length > 0)
            flashMsg += "<br>Students " + utils.arrayToSentence(cantAttend) + " from the spreadsheet are not members.";
          if (parsedIDs.warnings.length > 0)
            flashMsg += "<br>[!] The IDs in rows " + utils.arrayToSentence(parsedIDs.warnings) + " of the uploaded Excel sheet are invalid and were ignored.";
          req.flash("info", flashMsg);
          res.redirect("/meetings/" + meeting._id + "/checkin" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
        });
      });
    });
  /* if a single ID was submitted */
  } else if (req.body.id) {
    req.body.id = req.sanitize(req.body.id.trim());
    Member.findOne({id: req.body.id}, function(err, member) {
      if (err) {
        console.error(err);
        req.flash("error", "An unexpected error occurred.");
        res.redirect("/meetings/" + meeting._id + "/checkin" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
      } else if (!member) {
        req.flash("error", "That member does not exist. ID entered: " + req.body.id);
        res.redirect("/meetings/" + meeting._id + "/checkin" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
      } else {
        AttendanceRecord.exists({meetingDate: meeting.date, memberID: member.id}, function(err, recordExists) {
          if (!recordExists) {
            attendance.add(meeting.date, member.id, req.user.id || req.user.email);
            req.flash("success", member.id + " attended the meeting.");
          } else
            req.flash("info", member.id + " already attended the meeting.");
          res.redirect("/meetings/" + meeting._id + "/checkin" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
        });
      }
    });
  } else res.redirect("/meetings/" + meeting._id + "/checkin" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
});

module.exports = router;
