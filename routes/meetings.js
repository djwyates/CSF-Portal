const express = require("express"),
      router = express.Router(),
      middleware = require("../middleware/index"),
      backup = require("../services/backup"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member");

router.get("/", function(req, res) {
  Meeting.find({}, function(err, meetings) {
    if (err) {
      console.error(err);
    } else {
      meetings.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
      res.render("meetings/index", {meetings: meetings});
    }
  });
});

router.get("/new", middleware.hasAccessLevel(1), function(req, res) {
  res.render("meetings/new");
});

router.post("/", middleware.hasAccessLevel(1), function(req, res) {
    Meeting.create([{date: req.body.meeting.date, description: req.sanitize(req.body.meeting.description)}], function(err, newMeeting) {
      if (err) {
        console.error(err);
        if (err.code == 11000)
          req.flash("error", "More than one meeting cannot have the same date.");
        res.redirect("meetings/new");
      } else {
        res.redirect("/meetings");
      }
    });
});

router.get("/:id", function(req, res) {
  Meeting.findById(req.params.id, function(err, foundMeeting) {
    if (err || !foundMeeting) {
      res.redirect("/meetings");
    } else {
      res.render("meetings/show", {meeting: foundMeeting});
    }
  });
});

router.get("/:id/edit", middleware.hasAccessLevel(1), function(req, res) {
  Meeting.findById(req.params.id, function(err, foundMeeting) {
    if (err || !foundMeeting) {
      res.redirect("/meetings");
    } else {
      res.render("meetings/edit", {meeting: foundMeeting});
    }
  });
});

router.put("/:id", middleware.hasAccessLevel(1), function(req, res) {
  req.body.meeting.description = req.sanitize(req.body.meeting.description);
  Meeting.findByIdAndUpdate(req.params.id, req.body.meeting, function(err, foundMeeting) {
    if (err) {
      if (err.code == 11000)
        req.flash("error", "More than one meeting cannot have the same date.");
      res.redirect("/meetings/" + req.params.id + "/edit");
    } else {
      res.redirect("/meetings/" + req.params.id);
    }
  });
});

router.delete("/:id", middleware.hasAccessLevel(1), function(req, res) {
  Meeting.findByIdAndDelete(req.params.id, function(err, deletedMeeting) {
    if (err) {
      console.error(err);
      res.redirect("/meetings");
    } else {
      backup.object("./backups/deleted/meetings/" + deletedMeeting.date + ".txt", deletedMeeting);
      deletedMeeting.membersAttended.forEach(function(memberId) {
        Member.findOneAndUpdate({id: memberId}, {$pull: {"meetingsAttended": deletedMeeting.date}}, function(err, foundMember) { if (err) console.error(err); });
      });
      res.redirect("/meetings");
    }
  });
});

router.get("/:id/checkin", middleware.hasAccessLevel(1), function(req, res) {
  Meeting.findById(req.params.id, function(err, foundMeeting) {
    if (err || !foundMeeting) {
      res.redirect("/meetings");
    } else {
      res.render("meetings/checkin", {meeting: foundMeeting});
    }
  });
});

router.put("/:id/checkin", middleware.hasAccessLevel(1), function(req, res) {
  req.body.id = req.sanitize(req.body.id.trim());
  Meeting.findById(req.params.id, function(err1, foundMeeting) {
    Member.findOne({id: req.body.id}, function(err2, foundMember) {
      if (err1 || err2) {
        if (err1) console.error(err1);
        if (err2) console.error(err2);
        req.flash("error", "An unexpected error occurred.");
        res.redirect("/meetings/" + req.params.id + "/checkin");
      } else if (!foundMeeting) {
        req.flash("error", "That meeting does not exist.");
        res.redirect("/meetings");
      } else if (!foundMember) {
        req.flash("error", "That member does not exist. ID entered: " + req.body.id);
        res.redirect("/meetings/" + req.params.id + "/checkin");
      } else if (foundMember.meetingsAttended.includes(foundMeeting.date)) {
        req.flash("info", foundMember.id + " already attended the meeting.");
        res.redirect("/meetings/" + req.params.id + "/checkin");
      } else {
        Meeting.findByIdAndUpdate(req.params.id, {$push: {"membersAttended": foundMember.id}}, function(err, foundMeeting) { if (err) console.error(err); });
        Member.findOneAndUpdate({id: foundMember.id}, {$push: {"meetingsAttended": foundMeeting.date}}, function(err, foundMember) { if (err) console.error(err); });
        req.flash("success", foundMember.id + " attended the meeting.");
        res.redirect("/meetings/" + req.params.id + "/checkin");
      }
    });
  });
});

module.exports = router;
