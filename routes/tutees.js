const express = require("express"),
      router = express.Router(),
      shortid = require("shortid"),
      middleware = require("../middleware/index"),
      backup = require("../services/backup"),
      courses = require("../config/courses"),
      Tutee = require("../models/tutee"),
      Tutor = require("../models/tutor");

router.get("/", middleware.hasAccessLevel(2), function(req, res) {
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
  res.render("tutees/new", {courses: courses});
});

router.post("/", function(req, res) {
  req.body.tutee.$setOnInsert = {_id: shortid.generate()};
  req.body.tutee.id = req.sanitize(req.body.tutee.id);
  req.body.tutee.name = req.sanitize(req.body.tutee.name);
  req.body.tutee.email = req.sanitize(req.body.tutee.email);
  req.body.tutee.phoneNum = req.sanitize(req.body.tutee.phoneNum);
  req.body.tutee.parentName = req.sanitize(req.body.tutee.parentName);
  req.body.tutee.parentEmail = req.sanitize(req.body.tutee.parentEmail);
  req.body.tutee.parentPhoneNum = req.sanitize(req.body.tutee.parentPhoneNum);
  req.body.tutee.createdOn = new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-");
  Tutee.findOneAndUpdate({id: req.body.tutee.id}, req.body.tutee, {new: true, upsert: true}, function(err, tutee) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred. Try to submit the form again.");
      res.redirect("/tutees/new" + (req.query.from ? "?from=" + req.query.from : ""));
    } else if (req.user && req.user.id == tutee.id) {
      req.flash("success", "Your tutoring request has been successfully submitted.");
      res.redirect("/tutees/" + tutee._id + (req.query.from ? "?from=" + req.query.from : ""));
    } else {
      req.flash("success", "Your tutoring request has been successfully submitted. To view your request, login with the student or parent email associated with your request (you can only login with a Google or school email).");
      res.redirect(req.query.from ? req.query.from : "/");
    }
  });
});

router.get("/:id", middleware.hasTuteeAccess, function(req, res) {
  res.render("tutees/show", {tutee: req.foundTutee});
});

router.get("/:id/edit", middleware.hasTuteeAccess, function(req, res) {
  res.render("tutees/edit", {tutee: req.foundTutee, courses: courses});
});

router.put("/:id", middleware.hasTuteeAccess, function(req, res) {
  req.body.tutee.name = req.sanitize(req.body.tutee.name);
  req.body.tutee.email = req.sanitize(req.body.tutee.email);
  req.body.tutee.phoneNum = req.sanitize(req.body.tutee.phoneNum);
  req.body.tutee.parentName = req.sanitize(req.body.tutee.parentName);
  req.body.tutee.parentEmail = req.sanitize(req.body.tutee.parentEmail);
  req.body.tutee.parentPhoneNum = req.sanitize(req.body.tutee.parentPhoneNum);
  Tutee.findByIdAndUpdate(req.params.id, req.body.tutee, function(err, foundTutee) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutees/" + req.params.id + "/edit");
    } else {
      res.redirect("/tutees/" + req.params.id + (req.query.from ? "?from=" + req.query.from : ""));
    }
  });
});

router.put("/:id/pair", middleware.hasAccessLevel(2), function(req, res) {
  Tutee.findById(req.params.id, function(err, foundTutee) {
    if (err || !foundTutee) {
      res.redirect("/tutees");
    } else {
      var pairedTutors = new Map(), availableTutor = null, paymentQuery = foundTutee.paymentForm == ["Both"] ? ["Cash", "Both"] : ["Both"];
      Tutor.find({verified: true, verifiedPhone: true, paymentForm: {$in: paymentQuery}}, function(err, tutors) {
        foundTutee.courses.forEach(function(course) {
          if (!foundTutee.currentTutors.get(course)) {
            tutors.forEach(function(tutor) {
              if (tutor.currentTutees.size < tutor.maxTutees && tutor.courses.includes(course) && (!availableTutor || tutor.currentTutees.size < availableTutor.currentTutees.size))
                availableTutor = tutor;
            });
            if (availableTutor) {
              var tutorKey = "currentTutees." + foundTutee._id, tuteeKey = "currentTutors." + course; // TODO: correctly update currentTutors & currentTutees fields
              Tutor.findByIdAndUpdate(availableTutor._id, {$set: {"currentTutees.tuteeID": course}});
              Tutee.findByIdAndUpdate(foundTutee._id, {$set: {"currentTutors.course": availableTutor._id}}, function(err, updatedTutee){});
              pairedTutors.set(course, availableTutor.name);
              availableTutor = null;
            }
          }
        });
        var pairMessage = "Tutee " + foundTutee.name, i = 1;
        if (pairedTutors.size == 0) {
          pairMessage += " did not find any available tutors for their selected courses.";
        } else if (pairedTutors.size == 1) {
          pairMessage += " has been successfully paired with";
          pairedTutors.forEach(function(tutorName, course, pairedTutors) {
            if (pairedTutors.size == 1) {
              pairMessage += " Tutor " + tutorName + " for Course " + course + ".";
            } else if (i < pairedTutors.size) {
              pairMessage += " Tutor " + tutorName + " for Course " + course + (pairedTutors.size == 2 ? "" : ",");
              i++;
            } else {
              pairMessage += " and Tutor " + tutorName + " for Course " + course + ".";
            }
          });
        }
        // TODO: send text via AWS to members with accessLevel >= 2 based on foundTutee && pairedTutors
        req.flash("info", pairMessage);
        res.redirect("/tutees");
      });
    }
  });
});

module.exports = router;
