const express = require("express"),
      router = express.Router(),
      shortid = require("shortid"),
      auth = require("../middleware/auth"),
      search = require("../middleware/search"),
      backup = require("../services/backup"),
      sns = require("../services/sns"),
      utils = require("../services/utils"),
      courses = require("../config/courses"),
      keys = require("../config/keys"),
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
  var tutee = res.locals.tutee;
  Tutor.find({courses: {$in: tutee.courses}, paymentForm: {$in: tutee.paymentForm == ["Both"] ? ["Cash", "Both"] : ["Both"]}, verified: true, verifiedPhone: true}).lean().exec(function(err, tutors) {
    tutors = tutors.map(function(tutor) {
      Object.assign(tutor, {mutualCourses: tutor.courses.filter(course => tutee.courses.includes(course))});
      return Object.assign(tutor, {tuteeSessions: tutor.tuteeSessions.filter(tuteeSession => tuteeSession.status != "Inactive")});
    });
    var matchingTutor = null, alreadyTutorsThisTutee = false, matchingTutorAlreadyTutorsThisTutee = false, pairMsg = [], pairedTutors = [];
    tutee.courses.filter(course => tutee.tutorSessions.find(tutorSession => tutorSession.courses.includes(course)) ? false : true).forEach(function(course) {
      /* pairs the tutee with a matching tutor; priority given to tutors who already tutor this tutee, who share the most courses with this tutee, & who are tutoring the least tutees */
      tutors.forEach(function(tutor) {
        alreadyTutorsThisTutee = tutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id) ? true : pairedTutors.find(pairedTutor => pairedTutor._id == tutor._id) ? true : false;
        if (matchingTutor) matchingTutorAlreadyTutorsThisTutee = matchingTutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id) ? true : false;
        if (tutor.courses.includes(course) && tutor.id != tutee.id && (tutor.tuteeSessions.length < tutor.maxTutees || alreadyTutorsThisTutee)
            && (!matchingTutor || alreadyTutorsThisTutee || (!matchingTutorAlreadyTutorsThisTutee && tutor.mutualCourses.length > matchingTutor.mutualCourses.length)
            || (!matchingTutorAlreadyTutorsThisTutee && tutor.mutualCourses.length == matchingTutor.mutualCourses.length && tutor.tuteeSessions.length < matchingTutor.tuteeSessions.length)))
              matchingTutor = tutor;
      });
      /* updates the database to pair the matching tutor and tutee */
      if (matchingTutor) {
        var pairedBefore = tutee.tutorSessions.find(tutorSession => tutorSession.tutorID == matchingTutor._id) ? true : false;
        var pairedNow = pairedTutors.find(tutor => tutor._id == matchingTutor._id) ? true : false;
        if (pairedBefore || pairedNow) {
          Tutee.findByIdAndUpdate(tutee._id, {$push: {"tutorSessions.$[element].courses": course}}, {arrayFilters: [{"element.tutorID": matchingTutor._id}]}).exec();
          Tutor.findByIdAndUpdate(matchingTutor._id, {$push: {"tuteeSessions.$[element].courses": course}}, {arrayFilters: [{"element.tuteeID": tutee._id}]}).exec();
          if (pairedBefore) matchingTutor.pairedBefore = true;
        } else {
          var currentDate = new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-");
          Tutee.findByIdAndUpdate(tutee._id, {$push: {"tutorSessions": {tutorID: matchingTutor._id, courses: [course], status: "Pending"}}}).exec();
          Tutor.findByIdAndUpdate(matchingTutor._id, {$push: {"tuteeSessions": {tuteeID: tutee._id, courses: [course], status: "Pending", firstNotified: currentDate, lastNotified: currentDate}}}).exec();
        } if (!pairedNow) {
          matchingTutor.courses = [course];
          pairedTutors.push(matchingTutor);
        } else
          pairedTutors.find(pairedTutor => pairedTutor._id == matchingTutor._id).courses.push(course);
        pairMsg.push("<a class='link--white' href='/tutors/" + matchingTutor._id + "?from=%2Ftutees%2F" + tutee._id + "'>Tutor " + matchingTutor.name + "</a> for Course " + course);
        matchingTutor = null;
      }
    });
    /* formulates & sends SMS message to notify paired tutors */
    pairedTutors.forEach(function(pairedTutor) {
      pairedTutor.courses = pairedTutor.courses.map(course => utils.reformatCourse(course));
      if (pairedTutor.pairedBefore) {
        var message = "Tutee " + tutee.name + ", who you were already paired with, has requested help in additional courses you cover: "
        + utils.arrayToSentence(pairedTutor.courses.map(course => utils.reformatCourse(course)));
      } else {
        var message = "CSF has successfully paired you with a tutee! Their information is below.\n\nTutee Information:\nName - " + tutee.name + "\nPhone - " + tutee.phoneNum + "\nNeeds help with "
        + utils.arrayToSentence(pairedTutor.courses.map(course => utils.reformatCourse(course))) + "\n\nParent Information:\nName - " + tutee.parentName + "\nPhone - " + tutee.parentPhoneNum
        + "\nForm of Payment - " + tutee.paymentForm + "\n\nTo accept this pairing, go to " + keys.siteData.url + "/tutors/" + pairedTutor._id + "/accept-pairing/" + tutee._id
        + "\n*If this match does not work out, please contact us so you can be assigned to someone else!\n\nRemember to:\n1. Call the parent first, ASAP!\n2. Tell them what form of payment "
        + "you are asking for and make sure it matches what they have requested.\n3. Set up meeting times.\n4. Log your meetings.\n5. Contact us when the student no longer needs your services!";
      }
      sns.sendSMS(message, pairedTutor.phoneNum);
    });
    req.flash("info", "Tutee " + tutee.name + (pairMsg.length == 0 ? " did not find any available tutors." : " has been successfully paired with " + utils.arrayToSentence(pairMsg)));
    res.redirect("/tutees/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
  });
});

router.delete("/:id", auth.hasAccessLevel(2), search.tutee, function(req, res) {
  if (res.locals.tutee.tutorSessions.length > 0) {
    req.flash("error", "You cannot delete tutees who are paired with tutors.");
    res.redirect("/tutees/" + res.locals.tutee._id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
  } else {
    Member.findByIdAndUpdate({tuteeID: res.locals.tutee._id}, {$unset: {tuteeID: ""}}).exec();
    Tutee.deleteOne({_id: res.locals.tutee._id}, function(err, tutee) {
      res.redirect("/tutees" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    });
  }
});

module.exports = router;
