const express = require("express"),
      router = express.Router(),
      shortid = require("shortid"),
      auth = require("../middleware/auth"),
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
  Tutee.create([newTutee], {new: true}, function(err, newTutee) {
    if (err) {
      console.error(err);
      if (err.code == 11000) req.flash("error", "A tutee already exists with that ID. Login with your school email to view or edit your request.");
      else req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutees/new" + (req.query.from ? "?from=" + req.query.from : ""));
    } else {
      Member.findOneAndUpdate({id: newTutee[0].id}, {tuteeID: newTutee[0]._id}).exec();
      if (req.user && req.user.id == newTutee[0].id || req.user && req.user.accessLevel >= 2) {
        req.flash("success", "Your tutoring request has been successfully submitted.");
        res.redirect("/tutees/" + newTutee[0]._id + (req.query.from ? "?from=" + req.query.from : ""));
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
    phoneNum: req.sanitize(req.body.tutee.phoneNum),
    parentName: req.sanitize(req.body.tutee.parentName),
    parentEmail: req.sanitize(req.body.tutee.parentEmail),
    parentPhoneNum: req.sanitize(req.body.tutee.parentPhoneNum),
    paymentForm: req.body.tutee.paymentForm,
    courses: !req.body.courses ? [] : Array.isArray(req.body.courses) ? req.body.courses : [req.body.courses]
  };
  Tutee.findByIdAndUpdate(req.params.id, editedTutee, function(err, foundTutee) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutees/" + req.params.id + "/edit");
    } else {
      res.redirect("/tutees/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.put("/:id/pair", auth.hasAccessLevel(2), function(req, res) {
  Tutee.findById(req.params.id, function(err, tutee) {
    Tutor.find({courses: {$in: tutee.courses}, paymentForm: {$in: tutee.paymentForm == ["Both"] ? ["Cash", "Both"] : ["Both"]}, verified: true, verifiedPhone: true}).lean().exec(function(err, tutors) {
      tutors = tutors.map(function(tutor) {
        Object.assign(tutor, {mutualCourses: tutor.courses.filter(course => tutee.courses.includes(course))});
        return Object.assign(tutor, {tuteeSessions: tutor.tuteeSessions.filter(tuteeSession => tuteeSession.status != "Inactive")});
      });
      var matchingTutor = null, alreadyTutorsThisTutee = false, matchingTutorAlreadyTutorsThisTutee = false, pairInfo = [];
      tutee.courses.filter(course => tutee.tutorSessions.find(tutorSession => tutorSession.courses.includes(course)) ? false : true).forEach(function(course) {
        /* pairs the tutee with a matching tutor; priority given to tutors who already tutor this tutee, who share the most courses with this tutee, & who are tutoring the least tutees */
        tutors.forEach(function(tutor) {
          alreadyTutorsThisTutee = tutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id) ? true : false;
          if (matchingTutor) matchingTutorAlreadyTutorsThisTutee = matchingTutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id) ? true : false;
          if (tutor.courses.includes(course) && tutor.id != tutee.id && (tutor.tuteeSessions.length < tutor.maxTutees || alreadyTutorsThisTutee)
              && (!matchingTutor || alreadyTutorsThisTutee || (!matchingTutorAlreadyTutorsThisTutee && tutor.mutualCourses.length > matchingTutor.mutualCourses.length)
              || (!matchingTutorAlreadyTutorsThisTutee && tutor.mutualCourses.length == matchingTutor.mutualCourses.length && tutor.tuteeSessions.length < matchingTutor.tuteeSessions.length)))
                matchingTutor = tutor;
        });
        /* updates the database to pair the matching tutor and tutee */
        if (matchingTutor) {
          if (tutee.tutorSessions.find(tutorSession => tutorSession.tutorID == matchingTutor._id))
            Tutee.findByIdAndUpdate(tutee._id, {$push: {"tutorSessions.$[element].courses": course}}, {arrayFilters: [{"element.tutorID": matchingTutor._id}]}).exec();
          else {
            Tutee.findByIdAndUpdate(tutee._id, {$push: {"tutorSessions": {tutorID: matchingTutor._id, courses: [course], status: "Unnotified"}}}).exec();
            tutee.tutorSessions.push({tutorID: matchingTutor._id, courses: [course], status: "Unnotified"});
          }
          if (matchingTutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id))
            Tutor.findByIdAndUpdate(matchingTutor._id, {$push: {"tuteeSessions.$[element].courses": course}}, {arrayFilters: [{"element.tuteeID": tutee._id}]}).exec();
          else {
            Tutor.findByIdAndUpdate(matchingTutor._id, {$push: {"tuteeSessions": {tuteeID: tutee._id, courses: [course], status: "Unnotified"}}}).exec();
            tutors.find(tutor => tutor._id == matchingTutor._id).tuteeSessions.push({tuteeID: tutee._id, courses: [course], status: "Unnotified"});
          }
          pairInfo.push("Tutor " + matchingTutor.name + " for Course " + course);
          matchingTutor = null;
        }
      });
      /* formulates a message on the outcome of the pairing */
      var pairMessage = "Tutee " + tutee.name;
      if (pairInfo.length == 0)
        pairMessage += " did not find any available tutors.";
      else
        pairMessage += " has been successfully paired with " + utils.arrayToSentence(pairInfo);
      req.flash("info", pairMessage);
      res.redirect("/tutees/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    });
  });
});

module.exports = router;
