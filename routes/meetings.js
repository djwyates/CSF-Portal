const express = require("express"),
      router = express.Router(),
      fs = require("fs"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      middleware = require("../middleware/index")

router.get("/", function(req, res) {
  Meeting.find({}, function(err, meetings) {
    if (err) {
      console.log(err);
    } else {
      res.render("meetings/index", {meetings: meetings});
    }
  });
});

router.get("/new", middleware.hasAccessLevel(1), function(req, res) {
  res.render("meetings/new");
});

router.post("/", middleware.hasAccessLevel(1), function(req, res) {
    Meeting.create([{date: req.body.meeting.date, description: req.sanitize(req.body.meeting.description)}], {useFindAndModify: true}, function(err, newMeeting) {
      if (err) {
        res.redirect("meetings/new");
      } else {
        res.redirect("/meetings");
      }
    });
});

router.get("/:id", function(req, res) {
  Meeting.findById(req.params.id, function(err, foundMeeting) {
    if (err || foundMeeting == null) {
      res.redirect("/meetings");
    } else {
      res.render("meetings/show", {meeting: foundMeeting});
    }
  });
});

router.get("/:id/edit", middleware.hasAccessLevel(1), function(req, res) {
  Meeting.findById(req.params.id, function(err, foundMeeting) {
    if (err || foundMeeting == null) {
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
      res.redirect("/meetings/" + req.params.id + "/edit");
    } else {
      res.redirect("/meetings/" + req.params.id);
    }
  });
});

router.delete("/:id", middleware.hasAccessLevel(1), function(req, res) {
  Meeting.findByIdAndDelete(req.params.id, function(err, deletedMeeting) {
    if (err) {
      res.redirect("/meetings");
    } else {
      var currentDate = new Date().toJSON().slice(0,10).replace(/-/g,'-');
      if (!fs.existsSync("./backups/" + currentDate + "/meetings"))
        fs.mkdirSync("./backups/" + currentDate + "/meetings", {recursive: true}, function(err){});
      fs.writeFile("./backups/" + currentDate + "/meetings/" + deletedMeeting.date + ".txt", deletedMeeting, function(err){});
      Member.find({}, function(err, members) {
        members.forEach(function(member) {
          if (member.meetingsAttended.includes(deletedMeeting.date))
            Member.findByIdAndUpdate(member._id, {$pull: {"meetingsAttended": deletedMeeting.date}}, function(err, foundMember){});
        });
      });
      res.redirect("/meetings");
    }
  });
});

router.get("/:id/checkin", middleware.hasAccessLevel(1), function(req, res) {
  Meeting.findById(req.params.id, function(err, foundMeeting) {
    if (err || foundMeeting == null) {
      res.redirect("/meetings");
    } else {
      res.render("meetings/checkin", {meeting: foundMeeting});
    }
  });
});

router.put("/:id/checkin", middleware.hasAccessLevel(1), function(req, res) {
  req.body.id = req.sanitize(req.body.id.trim());
  Member.findOne({id: req.body.id}, function(err, foundMember) {
    Meeting.findById(req.params.id, function(err, foundMeeting) {
      if (err || foundMember == null) {
        req.flash("error", "That member does not exist or another error occurred. ID entered: " + req.body.id);
        res.redirect("/meetings/" + req.params.id + "/checkin");
      } else if (foundMember.meetingsAttended.includes(foundMeeting.date)) {
        req.flash("info", foundMember.id + " already attended the meeting.");
        res.redirect("/meetings/" + req.params.id + "/checkin");
      } else {
        Meeting.findByIdAndUpdate(req.params.id, {$push: {"membersAttended": foundMember.id}}, function(err, foundMeeting) {
          Member.findByIdAndUpdate(foundMember._id, {$push: {"meetingsAttended": foundMeeting.date}}, function(err, foundMember){});
        });
        req.flash("success", foundMember.id + " attended the meeting.");
        res.redirect("/meetings/" + req.params.id + "/checkin");
      }
    });
  });
});

module.exports = router;
