const express = require("express"),
      router = express.Router(),
      fs = require("fs");
      auth = require("../middleware/auth"),
      search = require("../middleware/search"),
      backup = require("../services/backup"),
      utils = require("../services/utils"),
      xlsx = require("../services/xlsx"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member");

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
      if (req.body.meeting.date != foundMeeting.date) {
        foundMeeting.membersAttended.forEach(function(memberID) {
          Member.findOneAndUpdate({id: memberID}, {$pull: {"meetingsAttended": foundMeeting.date}}).exec();
          Member.findOneAndUpdate({id: memberID}, {$push: {"meetingsAttended": req.body.meeting.date}}).exec();
        });
      }
      res.redirect("/meetings/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.delete("/:id", auth.hasAccessLevel(1), function(req, res) {
  Meeting.findByIdAndDelete(req.params.id, function(err, deletedMeeting) {
    if (err) {
      console.error(err);
      res.redirect("/meetings");
    } else {
      backup.object("./backups/deleted/meetings/" + deletedMeeting.date + ".txt", deletedMeeting.toObject());
      deletedMeeting.membersAttended.forEach(function(memberID) {
        Member.findOneAndUpdate({id: memberID}, {$pull: {"meetingsAttended": deletedMeeting.date}}, function(err, member) { if (err) console.error(err); });
      });
      res.redirect(req.query.from ? req.query.from : "/meetings");
    }
  });
});

router.get("/:id/checkin", auth.hasAccessLevel(1), search.meeting, function(req, res) {
  res.render("meetings/checkin", {meeting: res.locals.meeting});
});

router.put("/:id/checkin", auth.hasAccessLevel(1), search.meeting, function(req, res) {
  var meeting = res.locals.meeting, flashMsg = "", notMembers = [];
  if (req.files && req.files.attendance && req.query.spreadsheet) {
    req.files.attendance.mv(req.files.attendance.name, function() {
      var parsedIDs = xlsx.parseIDs(req.files.attendance.name);
      fs.unlink(req.files.attendance.name, function(err){});
      Member.find({}, function(err, members) {
        parsedIDs.ids = new Set(parsedIDs.ids)
        parsedIDs.ids.forEach(function(id) {
          if (!members.find(member => member.id == id))
            notMembers.push(id);
          else {
            Meeting.findByIdAndUpdate(meeting._id, {$addToSet: {"membersAttended": id}}).exec();
            Member.findOneAndUpdate({id: id}, {$addToSet: {"meetingsAttended": meeting.date}}).exec();
          }
        });
        flashMsg += (parsedIDs.ids.size-notMembers.length) + " members have attended the meeting from the spreadsheet.";
        if (parsedIDs.warnings.length > 0)
          flashMsg += "<br>WARNING: The IDs in rows " + utils.arrayToSentence(parsedIDs.warnings) + " of the uploaded Excel sheet are invalid and were ignored.";
        if (notMembers.length > 0)
          flashMsg += "<br>NOTICE: The students with IDs " + utils.arrayToSentence(notMembers) + " of the spreadsheet are not members.";
        req.flash("info", flashMsg);
        res.redirect("/meetings/" + meeting._id + "/checkin" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
      });
    });
  } else if (req.body.id) {
    req.body.id = req.sanitize(req.body.id.trim());
    Member.findOne({id: req.body.id}, function(err, member) {
      if (err) {
        console.error(err);
        req.flash("error", "An unexpected error occurred.");
      } else if (!member) {
        req.flash("error", "That member does not exist. ID entered: " + req.body.id);
      } else if (meeting.membersAttended.includes(member.id) && member.meetingsAttended.includes(meeting.date)) {
        req.flash("info", member.id + " already attended the meeting.");
      } else {
        Meeting.findByIdAndUpdate(meeting._id, {$addToSet: {"membersAttended": member.id}}).exec();
        Member.findOneAndUpdate({id: member.id}, {$addToSet: {"meetingsAttended": meeting.date}}).exec();
        req.flash("success", member.id + " attended the meeting.");
      } res.redirect("/meetings/" + meeting._id + "/checkin" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    });
  } else res.redirect("/meetings/" + meeting._id + "/checkin" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
});

module.exports = router;
