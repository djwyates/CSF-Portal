const express = require("express"),
      router = express.Router(),
      Member = require("../models/member"),
      Meeting = require("../models/meeting"),
      middleware = require("../middleware/index")

router.get("/attendance", function(req, res) {
  if (!req.query.id)
    return res.render("members/attendance", {member: null});
  Member.findById(req.query.id, function(err, foundMember) {
    if (err || !foundMember) {
      req.flash("error", "That member does not exist or another error occurred. ID entered: " + req.query.id);
      res.redirect("back");
    } else {
      res.render("members/attendance", {member: foundMember});
    }
  });
});

router.get("/", middleware.hasAccessLevel(1), function(req, res) {
  Member.find({}, function(err, members) {
    if (err) {
      console.log(err);
    } else {
      res.render("members/index", {members: members});
    }
  });
});

router.get("/new", middleware.hasAccessLevel(3), function(req, res) {
  res.render("members/new");
});

router.post("/", middleware.hasAccessLevel(3), function(req, res) {
  var newMember = {
    _id: req.body.member.id,
    name: req.sanitize(req.body.member.name),
    grade: req.body.member.grade,
    termCount: req.body.member.termCount,
    accessLevel: parseInt(req.body.member.accessLevel)
  };
  Member.create([newMember], {useFindAndModify: true}, function(err, newMember) {
    if (err) {
      res.redirect("members/new");
    } else {
      res.redirect("/members");
    }
  });
});

router.get("/:id", middleware.hasAccessLevel(1), function(req, res) {
  Member.findById(req.params.id, function(err, foundMember) {
    if (err || foundMember == null) {
      res.redirect("/members");
    } else {
      res.render("members/show", {member: foundMember});
    }
  });
});

router.get("/:id/edit", middleware.hasAccessLevel(3), function(req, res) {
  Member.findById(req.params.id, function(err, foundMember) {
    if (err || foundMember == null) {
      res.redirect("/members");
    } else {
      res.render("members/edit", {member: foundMember});
    }
  });
});

router.put("/:id", middleware.hasAccessLevel(3), function(req, res) {
  req.body.member.name = req.sanitize(req.body.member.name);
  req.body.member.accessLevel = parseInt(req.body.member.accessLevel);
  Member.findByIdAndUpdate(req.params.id, req.body.member, function(err, foundMember) {
    if (err || foundMember == null) {
      res.redirect("/members/" + req.params.id + "/edit");
    } else {
      res.redirect("/members/" + req.params.id);
    }
  });
});

router.delete("/:id", middleware.hasAccessLevel(3), function(req, res) {
  Member.findByIdAndDelete(req.params.id, function(err, deletedMember) {
    if (err) {
      res.redirect("/members");
    } else {
      Meeting.find({}, function(err, meetings) {
        meetings.forEach(function(meeting) {
          if (meeting.membersAttended.includes(deletedMember._id))
            Meeting.findByIdAndUpdate(meeting._id, {$pull: {"membersAttended": deletedMember._id.toString()}}, function(err, foundMeeting){});
        });
      });
      res.redirect("/members");
    }
  });
});

module.exports = router;
