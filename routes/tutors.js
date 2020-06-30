const express = require("express"),
      router = express.Router(),
      middleware = require("../middleware/index"),
      backup = require("../services/backup"),
      courses = require("../config/courses"),
      Tutor = require("../models/tutor"),
      Member = require("../models/member");

router.get("/", middleware.hasAccessLevel(2), function(req, res) {
  Tutor.find({}, function(err, tutors) {
    if (err) {
      console.error(err);
    } else {
      tutors.sort(function(a, b) {
        var aLastName = a.name.split(" ")[a.name.split(" ").length-1], bLastName = b.name.split(" ")[b.name.split(" ").length-1];
        return (aLastName < bLastName) ? -1 : (aLastName > bLastName) ? 1 : 0;
      });
      res.render("tutors/index", {tutors: tutors});
    }
  });
});

router.get("/new", function(req, res) {
  res.render("tutors/new", {courses: courses});
});

router.post("/", function(req, res) {
  Member.findOne({id: req.sanitize(req.body.tutor.id)}, function(err, foundMember) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors/new");
    } else if (!foundMember) {
      req.flash("error", "You must be a member of CSF to become a tutor. ID entered: " + req.body.tutor.id);
      res.redirect("/tutors/new");
    } else {
      req.body.tutor.id = req.sanitize(req.body.tutor.id);
      req.body.tutor.name = foundMember.name;
      req.body.tutor.grade = foundMember.grade;
      req.body.tutor.email = req.sanitize(req.body.tutor.email);
      req.body.tutor.phoneNum = req.sanitize(req.body.tutor.phoneNum);
      Tutor.create([req.body.tutor], function(err, newTutor) {
        if (err) {
          console.error(err);
          if (err.code == 11000)
            req.flash("error", "You have already signed up as a tutor. To view or change your account, login with your school email.");
          else
            req.flash("error", "An unexpected error occurred.");
          res.redirect("/tutors/new");
        } else {
          Member.findByIdAndUpdate(foundMember._id, {tutorID: newTutor[0]._id}, function(err, foundMember){});
          if (req.user && req.user.id == newTutor[0].id) {
            req.flash("success", "You have successfully signed up as a tutor!");
            res.redirect("/tutors/" + newTutor[0]._id);
          } else {
            req.flash("success", "You have successfully signed up as a tutor! To view or change your account, login with your school email.");
            res.redirect("/");
          }
        }
      });
    }
  });
});

router.get("/:id", middleware.hasTutorAccess, function(req, res) {
  res.render("tutors/show", {tutor: req.foundTutor});
});

router.get("/:id/edit", middleware.hasTutorAccess, function(req, res) {
  res.render("tutors/edit", {tutor: req.foundTutor, courses: courses});
});

router.put("/:id", middleware.hasTutorAccess, function(req, res) {
  req.body.tutor.email = req.sanitize(req.body.tutor.email);
  req.body.tutor.phoneNum = req.sanitize(req.body.tutor.phoneNum);
  Tutor.findByIdAndUpdate(req.params.id, req.body.tutor, function(err, foundTutor) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors/" + req.params.id + "/edit");
    } else {
      if (req.body.tutor.phoneNum != foundTutor.phoneNum)
        Tutor.findByIdAndUpdate(req.params.id, {verifiedPhone: false}, function(err, foundTutor){});
      res.redirect("/tutors/" + req.params.id + (req.query.from ? "?from=" + req.query.from : ""));
    }
  });
});

router.put("/:id/verify", middleware.hasAccessLevel(2), function(req, res) {
  Tutor.findByIdAndUpdate(req.params.id, {verified: true}, function(err, foundTutee) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors");
    } else {
      req.flash("success", "Successfully verified Tutor " + foundTutee.name);
      res.redirect("/tutors/" + req.params.id + (req.query.from ? "?from=" + req.query.from : ""));
    }
  });
});

router.put("/:id/unverify", middleware.hasAccessLevel(2), function(req, res) {
  Tutor.findByIdAndUpdate(req.params.id, {verified: false}, function(err, foundTutee) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors");
    } else {
      req.flash("success", "Successfully unverified Tutor " + foundTutee.name);
      res.redirect("/tutors/" + req.params.id + (req.query.from ? "?from=" + req.query.from : ""));
    }
  });
});

module.exports = router;
