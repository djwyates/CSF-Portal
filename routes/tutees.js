const express = require("express"),
      router = express.Router(),
      shortid = require("shortid"),
      middleware = require("../middleware/index"),
      backup = require("../services/backup"),
      sns = require("../services/sns"),
      utils = require("../services/utils"),
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
  req.body.tutee.tutorSessions = [];
  req.body.tutee.courses.forEach(function(course) {
    req.body.tutee.tutorSessions.push({course: course, tutorID: null, status: "Unpaired"});
  });
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
      res.redirect("/tutees/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.put("/:id/pair", middleware.hasAccessLevel(2), function(req, res) {
  Tutee.findById(req.params.id, function(err, tutee) {
    Tutor.find({courses: {$in: tutee.courses}, paymentForm: {$in: tutee.paymentForm == ["Both"] ? ["Cash", "Both"] : ["Both"]}, verified: true, verifiedPhone: true}).lean().exec(function(err, tutors) {
      tutors = tutors.map(tutor => Object.assign(tutor, {mutualCourses: tutor.courses.filter(course => tutee.courses.includes(course))}));
      var matchingTutor = null, alreadyTutorsThisTutee = null, matchedAlreadyTutors = null, pairInfo = [];
      tutee.tutorSessions.filter(tutorSession => tutorSession.status == "Unpaired").forEach(function(tutorSession) {
        /* pairs the tutee with a matching tutor; priority given to tutors who already tutor this tutee, who share the most courses with this tutee, & who are tutoring the least tutees */
        tutors.forEach(function(tutor) {
          alreadyTutorsThisTutee = tutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id);
          if (matchingTutor) matchedAlreadyTutors = matchingTutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id);
          if (tutor.courses.includes(tutorSession.course) && (tutor.tuteeSessions.length < tutor.maxTutees || alreadyTutorsThisTutee) && (!matchingTutor || alreadyTutorsThisTutee
              || (!matchedAlreadyTutors && tutor.mutualCourses.length > matchingTutor.mutualCourses.length)
              || (!matchedAlreadyTutors && tutor.mutualCourses.length == matchingTutor.mutualCourses.length && tutor.tuteeSessions.length < matchingTutor.tuteeSessions.length)))
                matchingTutor = tutor;
        });
        /* updates the database to pair the matching tutor and tutee */
        if (matchingTutor) {
          Tutee.findByIdAndUpdate(tutee._id, {"tutorSessions.$[element]": {course: tutorSession.course, tutorID: matchingTutor._id, status: "Pending"}}, {arrayFilters: [{"element.course": tutorSession.course}]}).exec();
          if (matchingTutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id))
            Tutor.findByIdAndUpdate(matchingTutor._id, {$push: {"tuteeSessions.$[element].courses": tutorSession.course}}, {arrayFilters: [{"element.tuteeID": tutee._id}]}).exec();
          else {
            Tutor.findByIdAndUpdate(matchingTutor._id, {$push: {"tuteeSessions": {tuteeID: tutee._id, courses: [tutorSession.course], status: "Pending"}}}).exec();
            tutors.find(tutor => tutor._id == matchingTutor._id).tuteeSessions.push({tuteeID: tutee._id, courses: [tutorSession.course], status: "Pending"});
          }
          pairInfo.push("Tutor " + matchingTutor.name + " for Course " + tutorSession.course);
          matchingTutor = null;
        }
      });
      /* formulates a message on the outcome of the pairing */
      var pairMessage = "Tutee " + tutee.name;
      if (pairInfo.length == 0)
        pairMessage += " did not find any available tutors for their selected courses.";
      else
        pairMessage += " has been successfully paired with " + utils.arrayToSentence(pairInfo);
      req.flash("info", pairMessage);
      res.redirect("/tutees");
    });
  });
});

module.exports = router;
