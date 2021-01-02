const express = require("express"),
      router = express.Router(),
      shortid = require("shortid"),
      auth = require("../middleware/auth"),
      search = require("../middleware/search"),
      backup = require("../services/backup"),
      sns = require("../services/sns"),
      utils = require("../services/utils"),
      courses = require("../config/courses"),
      Tutee = require("../models/tutee"),
      Tutor = require("../models/tutor"),
      Member = require("../models/member");

router.get("/", auth.hasAccessLevel(2), function(req, res) {
  Tutee.find({}, function(err, tutees) {
    if (err) {
      console.error(err);
    } else {
      tutees.sort(function(a, b) {
        var aLastName = a.name.split(" ")[a.name.split(" ").length-1], bLastName = b.name.split(" ")[b.name.split(" ").length-1];
        return (aLastName < bLastName) ? -1 : (aLastName > bLastName) ? 1 : 0;
      });
      res.render("tutees/index", {tutees: tutees});
    }
  });
});

router.get("/new", function(req, res) {
  if (req.user && req.user.tuteeID && req.user.accessLevel < 2)
    res.redirect("/tutees/" + req.user.tuteeID);
  else
    res.render("tutees/new", {courses: courses});
});

router.post("/", function(req, res) {
  var newTutee = {
    id: req.sanitize(req.body.tutee.id),
    name: req.sanitize(req.body.tutee.name),
    gender: req.body.tutee.gender,
    grade: req.body.tutee.grade,
    email: req.sanitize(req.body.tutee.email),
    phoneNum: req.sanitize(req.body.tutee.phoneNum),
    parentName: req.sanitize(req.body.tutee.parentName),
    parentEmail: req.sanitize(req.body.tutee.parentEmail),
    parentPhoneNum: req.sanitize(req.body.tutee.parentPhoneNum),
    paymentForm: req.body.tutee.paymentForm,
    courses: !req.body.courses ? [] : Array.isArray(req.body.courses) ? req.body.courses : [req.body.courses],
    createdOn: new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-")
  };
  Tutee.create(newTutee, {new: true}, function(err, tutee) {
    if (err) {
      console.error(err);
      if (err.code == 11000) req.flash("error", "A tutee already exists with that ID. Login with your school email to view or edit your request.");
      else req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutees/new" + (req.query.from ? "?from=" + req.query.from : ""));
    } else {
      Member.findOneAndUpdate({id: tutee.id}, {tuteeID: tutee._id}).exec();
      if (req.user && req.user.id == tutee.id || req.user && req.user.accessLevel >= 2) {
        req.flash("success", "Your tutoring request has been successfully submitted.");
        res.redirect("/tutees/" + tutee._id + (req.query.from ? "?from=" + req.query.from : ""));
      } else {
        req.flash("success", "Your tutoring request has been successfully submitted. To view your request, login with your school email.");
        res.redirect(req.query.from ? req.query.from : "/");
      }
    }
  });
});

router.get("/:id", auth.hasTuteeAccess, function(req, res) {
  res.render("tutees/show", {tutee: res.locals.tutee});
});

router.get("/:id/edit", auth.hasTuteeAccess, function(req, res) {
  res.render("tutees/edit", {tutee: res.locals.tutee, courses: courses});
});

router.put("/:id", auth.hasTuteeAccess, function(req, res) {
  var editedTutee = {
    name: req.sanitize(req.body.tutee.name),
    gender: req.body.tutee.gender,
    grade: req.body.tutee.grade,
    email: req.sanitize(req.body.tutee.email),
    parentName: req.sanitize(req.body.tutee.parentName),
    parentEmail: req.sanitize(req.body.tutee.parentEmail),
    paymentForm: req.body.tutee.paymentForm,
    courses: !req.body.courses ? [] : Array.isArray(req.body.courses) ? req.body.courses : [req.body.courses]
  };
  if (req.user.accessLevel >= 2) {
    editedTutee.phoneNum = req.sanitize(req.body.tutee.phoneNum);
    editedTutee.parentPhoneNum = req.sanitize(req.body.tutee.parentPhoneNum);
  }
  Tutee.findByIdAndUpdate(req.params.id, editedTutee, function(err, tutee) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutees/" + req.params.id + "/edit");
    } else
      res.redirect("/tutees/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
  });
});

router.put("/:id/pair", auth.hasAccessLevel(2), search.tutee, function(req, res) {
  require("../services/pair")(req.body, res.locals.tutee).then(function(result) {
    req.flash(result.type, result.msg);
    res.redirect("back");
  });
});

router.delete("/:id", auth.hasAccessLevel(2), search.tutee, function(req, res) {
  var tutee = res.locals.tutee;
  if (tutee.tutorSessions.length > 0) {
    req.flash("error", "You cannot delete tutees who have been paired with tutors.");
    res.redirect("/tutees/" + tutee._id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
  } else {
    backup.object("./backups/deleted/tutees/" + tutee.id + ".txt", tutee);
    Member.findOneAndUpdate({tuteeID: tutee._id}, {$unset: {tuteeID: ""}}).exec();
    Tutee.deleteOne({_id: tutee._id}, function(err, tutee) {
      res.redirect("/tutees" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    });
  }
});

module.exports = router;
