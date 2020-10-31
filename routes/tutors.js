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
      Tutor = require("../models/tutor"),
      Member = require("../models/member"),
      Tutee = require("../models/tutee");

router.get("/", auth.hasAccessLevel(2), function(req, res) {
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
  if (req.user && (req.user.accessLevel >= 2 || req.user.meetingsAttended && !req.user.tutorID))
    res.render("tutors/new", {courses: courses});
  else if (req.user && req.user.tutorID)
    res.redirect("/tutors/" + req.user.tutorID);
  else if (!req.user || !req.user.meetingsAttended)
    res.render("tutors/not-logged-in");
});

router.post("/", function(req, res) {
  Member.findOne({id: req.body.tutor.id}, function(err, foundMember) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors/new");
    } else if (!foundMember) {
      req.flash("error", "Only members of CSF can become tutors.");
      res.redirect("/tutors/new");
    } else {
      var newTutor = {
        id: req.user.accessLevel >= 2 ? req.sanitize(req.body.tutor.id) : req.user.id,
        name: foundMember.name,
        grade: foundMember.grade,
        gender: req.body.tutor.gender,
        email: req.sanitize(req.body.tutor.email),
        phoneNum: req.sanitize(req.body.tutor.phoneNum),
        maxTutees: req.body.tutor.maxTutees,
        paymentForm: req.body.tutor.paymentForm,
        courses: !req.body.courses ? [] : Array.isArray(req.body.courses) ? req.body.courses : [req.body.courses],
        verification: {
          code: shortid.generate(),
          lastSent: new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-")
        }
      };
      Tutor.create([newTutor], function(err, newTutor) {
        if (err) {
          console.error(err);
          if (err.code == 11000) req.flash("error", "A tutor already exists with that ID.");
          else req.flash("error", "An unexpected error occurred.");
          res.redirect("/tutors/new");
        } else {
          sns.sendSMS("To verify your phone number, go to " + keys.siteData.url + "/tutors/verify-phone/" + newTutor[0].verification.code, newTutor[0].phoneNum);
          Member.findByIdAndUpdate(foundMember._id, {tutorID: newTutor[0]._id}).exec();
          if (req.user && req.user.id == newTutor[0].id) {
            req.flash("success", "You have successfully signed up as a tutor! Please click the verification link sent to your phone.");
            res.redirect("/tutors/" + newTutor[0]._id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
          } else {
            req.flash("success", "You have successfully signed up the member with ID " + newTutor[0].id + " as a tutor.");
            res.redirect("/tutors/" + newTutor[0]._id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
          }
        }
      });
    }
  });
});

router.get("/:id", auth.hasTutorAccess, function(req, res) {
  res.render("tutors/show", {tutor: res.locals.tutor});
});

router.get("/:id/edit", auth.hasTutorAccess, function(req, res) {
  res.render("tutors/edit", {tutor: res.locals.tutor, courses: courses});
});

router.put("/:id", auth.hasTutorAccess, function(req, res) {
  var editedTutor = {
    gender: req.body.tutor.gender,
    email: req.sanitize(req.body.tutor.email),
    paymentForm: req.body.tutor.paymentForm,
    courses: !req.body.courses ? [] : Array.isArray(req.body.courses) ? req.body.courses : [req.body.courses],
    maxTutees: req.body.tutor.maxTutees
  };
  if (req.user.accessLevel >= 2) {
    editedTutor.phoneNum = req.sanitize(req.body.tutor.phoneNum);
    editedTutor.warnings = req.body.tutor.warnings;
  }
  Tutor.findByIdAndUpdate(req.params.id, editedTutor, function(err, tutor) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors/" + req.params.id + "/edit");
    } else if (!tutor) {
      res.redirect("/tutors");
    } else {
      if (editedTutor.phoneNum && editedTutor.phoneNum != tutor.phoneNum) {
        Tutor.findByIdAndUpdate(req.params.id, {verifiedPhone: false, "verification.code": shortid.generate(), "verification.lastSent": utils.getCurrentDate("mm-dd-yyyy, 00:00:00")}).exec();
        sns.sendSMS("To verify your phone number, go to " + keys.siteData.url + "/tutors/verify-phone/" + verificationCode, req.body.tutor.phoneNum);
      } if (editedTutor.maxTutees != tutor.maxTutees && editedTutor.maxTutees < tutor.tuteeSessions.filter(tuteeSession => tuteeSession.status != "Inactive").length) {
        req.flash("info", "NOTICE: The tutee limit you entered is lower than the amount of tutees you are currently paired with (but it was still saved).");
      }
      res.redirect("/tutors/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.put("/:id/verify", auth.hasAccessLevel(2), function(req, res) {
  Tutor.findByIdAndUpdate(req.params.id, {verified: true}, function(err, tutor) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors");
    } else if (!tutor) {
      res.redirect("/tutors");
    } else {
      req.flash("success", "Successfully verified Tutor " + tutor.name);
      res.redirect("/tutors/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.put("/:id/unverify", auth.hasAccessLevel(2), function(req, res) {
  Tutor.findByIdAndUpdate(req.params.id, {verified: false}, function(err, tutor) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors");
    } else if (!tutor) {
      res.redirect("/tutors");
    } else {
      req.flash("success", "Successfully unverified Tutor " + tutor.name);
      res.redirect("/tutors/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.put("/:id/warn", auth.hasAccessLevel(2), function(req, res) {
  Tutor.findByIdAndUpdate(req.params.id, {$inc: {warnings: 1}}, function(err, tutor) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors");
    } else if (!tutor) {
      res.redirect("/tutors");
    } else {
      req.flash("success", "Successfully warned Tutor " + tutor.name);
      res.redirect("/tutors/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.put("/:id/notify/:tuteeID", auth.hasAccessLevel(2), search.tutor, function(req, res) {
  var tutor = res.locals.tutor, tutee = res.locals.tutee;
  var tuteeSession = tutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id);
  var tutorSession = tutee.tutorSessions.find(tutorSession => tutorSession.tutorID == tutor._id);
  if (!tuteeSession || !tutorSession) {
    req.flash("error", "The tutor is not paired with this tutee.");
  } else if (tuteeSession.status != "Pending" || tutorSession.status != "Pending") {
    req.flash("error", "The tutor already accepted this request.");
  } else {
    var currentDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-"));
    var lastNotified = new Date(tuteeSession.lastNotified);
    var timeoutEndDate = new Date(lastNotified.setDate(lastNotified.getDate() + 2));
    if (currentDate < timeoutEndDate) {
      timeoutEndDate = utils.reformatDate(timeoutEndDate.toLocaleString()) + " at " + timeoutEndDate.toLocaleString().split(" ")[1] + " " + timeoutEndDate.toLocaleString().split(" ")[2];
      req.flash("error", "You can only notify tutors about who they were paired with every 48 hours. Next available on: " + timeoutEndDate);
      return res.redirect("back");
    }
    var message = "CSF has successfully paired you with a tutee! Their information is below.\n\nTutee Information:\nName - " + tutee.name + "\nPhone - " + tutee.phoneNum + "\nNeeds help with "
    + utils.arrayToSentence(tutee.courses.map(course => utils.reformatCourse(course))) + "\n\nParent Information:\nName - " + tutee.parentName + "\nPhone - " + tutee.parentPhoneNum
    + "\nForm of Payment - " + tutee.paymentForm + "\n\nTo accept this pairing, go to " + keys.siteData.url + "/tutors/" + tutor._id + "/accept-pairing/" + tutee._id
    + "\n*If this match does not work out, please contact us so you can be assigned to someone else!\n\nRemember to:\n1. Call the parent first, ASAP!\n2. Tell them what form of payment "
    + "you are asking for and make sure it matches what they have requested.\n3. Set up meeting times.\n4. Log your meetings.\n5. Contact us when the student no longer needs your services!";
    sns.sendSMS(message, tutor.phoneNum);
    Tutor.findByIdAndUpdate(tutor._id, {"tuteeSessions.$[element].lastNotified": utils.getCurrentDate("mm-dd-yyyy, 00:00:00")}, {arrayFilters: [{"element.tuteeID": tutee._id}]}).exec();
    req.flash("success", "The tutor was notified that they were paired with Tutee " + tutee.id);
  }
  res.redirect("back");
});

router.get("/:id/accept-pairing/:tuteeID", search.tutor, function(req, res) {
  var tutor = res.locals.tutor, tutee = res.locals.tutee;
  var tuteeSession = tutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id);
  var tutorSession = tutee.tutorSessions.find(tutorSession => tutorSession.tutorID == tutor._id);
  if (!tuteeSession || !tutorSession) {
    req.flash("error", "You are no longer paired with this tutee.");
    res.redirect("back");
  } else if (tuteeSession.status != "Pending" || tutorSession.status != "Pending") {
    if (tuteeSession.status == "Active" && tutorSession.status == "Active") req.flash("error", "You have already accepted this tutoring request.");
    res.redirect("back");
  } else
    res.render("tutors/accept-pairing", {tutor: tutor, tutee: tutee});
});

router.put("/:id/accept-pairing/:tuteeID", search.tutor, function(req, res) {
  var tutor = res.locals.tutor, tutee = res.locals.tutee;
  var tuteeSession = tutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id);
  var tutorSession = tutee.tutorSessions.find(tutorSession => tutorSession.tutorID == tutor._id);
  if (!tuteeSession || !tutorSession) {
    req.flash("error", "You are no longer paired with this tutee.");
  } else if (tuteeSession.status != "Pending" || tutorSession.status != "Pending") {
    req.flash("error", "You have already accepted this tutoring request.");
  } else {
    Tutor.findByIdAndUpdate(tutor._id, {"tuteeSessions.$[element].status": "Active", $unset: {"tuteeSessions.$[element].lastNotified": "", "tuteeSessions.$[element].firstNotified": ""}},
    {arrayFilters: [{"element.tuteeID": tutee._id}]}).exec();
    Tutee.findByIdAndUpdate(tutee._id, {"tutorSessions.$[element].status": "Active"}, {arrayFilters: [{"element.tutorID": tutor._id}]}).exec();
    req.flash("success", "You have accepted this tutoring request.");
  }
  res.redirect("back");
});

router.put("/:id/unpair/:tuteeID", auth.hasAccessLevel(2), search.tutor, function(req, res) {
  var tutor = res.locals.tutor, tutee = res.locals.tutee;
  var tuteeSession = tutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id);
  var tutorSession = tutee.tutorSessions.find(tutorSession => tutorSession.tutorID == tutor._id);
  if (!tuteeSession || !tutorSession) {
    req.flash("error", "The tutor is not paired with this tutee.");
    return res.redirect("back");
  } else if (tuteeSession.status == "Inactive" && tutorSession.status == "Inactive") {
    req.flash("error", "This tutor and tutee were already unpaired.");
    return res.redirect("back");
  } else if (tuteeSession.status == "Pending" && tutorSession.status == "Pending") {
    var currentDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-"));
    var firstNotified = new Date(tuteeSession.firstNotified);
    var timeoutEndDate = new Date(firstNotified.setDate(firstNotified.getDate() + 5));
    if (currentDate < timeoutEndDate && req.query.override != "true") {
      timeoutEndDate = utils.reformatDate(timeoutEndDate.toLocaleString()) + " at " + timeoutEndDate.toLocaleString().split(" ")[1] + " " + timeoutEndDate.toLocaleString().split(" ")[2];
      req.flash("error", "You cannot unpair a tutor who has been notified of their pairing until 5 days pass with no acceptance. You can unpair on: " + timeoutEndDate
      + " >>> <form class='form-link' action='/tutors" + req.url + "&override=true' method='post'><button class='button-link' type='submit'>Override and unpair</button></form>");
      return res.redirect("back");
    } else
      sns.sendSMS("You have been unpaired with Tutee " + tutee.name + (req.query.override ? "." : " because you did not accept their request for 5 or more days."), tutor.phoneNum);
  }
  if (tutorSession.status == "Pending" && tuteeSession.status == "Pending") {
    Tutor.findByIdAndUpdate(tutor._id, {$pull: {tuteeSessions: tuteeSession}}).exec();
    Tutee.findByIdAndUpdate(tutee._id, {$pull: {tutorSessions: tutorSession}}).exec();
  } else {
    Tutor.findByIdAndUpdate(tutor._id, {"tuteeSessions.$[element].status": "Inactive"}, {arrayFilters: [{"element.tuteeID": tutee._id}]}).exec();
    Tutee.findByIdAndUpdate(tutee._id, {"tutorSessions.$[element].status": "Inactive"}, {arrayFilters: [{"element.tutorID": tutor._id}]}).exec();
  }
  req.flash("success", "You have unpaired this tutor and tutee.");
  res.redirect("back");
});

router.put("/:id/re-pair/:tuteeID", auth.hasAccessLevel(2), search.tutor, function(req, res) {
  var tutor = res.locals.tutor, tutee = res.locals.tutee;
  var tuteeSession = tutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id);
  var tutorSession = tutee.tutorSessions.find(tutorSession => tutorSession.tutorID == tutor._id);
  if (!tuteeSession || !tutorSession) {
    req.flash("error", "The tutor is not paired with this tutee.");
    res.redirect("back");
  } else if (tuteeSession.status != "Inactive" || tutorSession.status != "Inactive") {
    req.flash("error", "This tutor and tutee are already paired.");
    res.redirect("back");
  } else {
    Tutor.findByIdAndUpdate(tutor._id, {"tuteeSessions.$[element].status": "Active"}, {arrayFilters: [{"element.tuteeID": tutee._id}]}).exec();
    Tutee.findByIdAndUpdate(tutee._id, {"tutorSessions.$[element].status": "Active"}, {arrayFilters: [{"element.tutorID": tutor._id}]}).exec();
    req.flash("success", "This tutor and tutee have been re-paired.");
    res.redirect("back");
  }
});

router.get("/:id/resend-verification", auth.hasTutorAccess, function(req, res) {
  if (res.locals.tutor.verifiedPhone) {
    req.flash("info", "Your phone has already been verified.");
    res.redirect("back");
  } else {
    var currentDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-"));
    var lastSent = new Date(res.locals.tutor.verification.lastSent);
    var timeoutEndDate = new Date(lastSent.setDate(lastSent.getDate() + 1));
    if (currentDate >= timeoutEndDate) {
      sns.sendSMS("To verify your phone number, go to " + keys.siteData.url + "/tutors/verify-phone/" + res.locals.tutor.verification.code, res.locals.tutor.phoneNum);
      Tutor.findByIdAndUpdate(res.locals.tutor._id, {"verification.lastSent": new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-")}).exec();
      req.flash("success", "The phone verification link has been resent.");
      res.redirect("back");
    } else {
      timeoutEndDate = utils.reformatDate(timeoutEndDate.toLocaleString()) + " at " + timeoutEndDate.toLocaleString().split(" ")[1] + " " + timeoutEndDate.toLocaleString().split(" ")[2];
      req.flash("error", "The phone verification link can only be sent every 24 hours. Next available on: " + timeoutEndDate);
      res.redirect("back");
    }
  }
});

router.get("/verify-phone/:code", function(req, res) {
  Tutor.findOne({"verification.code": req.params.code}, function(err, tutor) {
    if (err || !tutor) {
      if (err) console.error(err);
      req.flash("error", "Invalid verification code. Check if your phone is already verified.");
      res.redirect(req.user && req.user.tutorID ? "/tutors/" + req.user.tutorID : "/members/attendance");
    } else
      res.render("tutors/verify-phone", {verificationCode: tutor.verification.code});
  });
});

router.put("/verify-phone/:code", function(req, res) {
  req.body.id = req.sanitize(req.body.id.trim());
  Tutor.findOne({"verification.code": req.params.code}, function(err, tutor) {
    if (err || !tutor) {
      if (err) console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect(req.user && req.user.tutorID ? "/tutors/" + req.user.tutorID : "/members/attendance");
    } else if (tutor.id != req.body.id) {
      req.flash("error", "You entered an invalid student ID.");
      res.redirect("/tutors/verify-phone/" + tutor.verification.code);
    } else {
      Tutor.findByIdAndUpdate(tutor._id, {verifiedPhone: true, $unset: {verification: ""}}, function(err, updatedTutor) {
        if (err) {
          console.error(err);
          req.flash("error", "An unexpected error occurred.");
        } else
          req.flash("success", "Your phone has been verified successfully.");
        res.redirect(req.user && req.user.tutorID ? "/tutors/" + req.user.tutorID : "/members/attendance");
      });
    }
  });
});

router.delete("/:id", auth.hasAccessLevel(2), search.tutor, function(req, res) {
  if (res.locals.tutor.tuteeSessions.length > 0) {
    req.flash("error", "You cannot delete tutors who are paired with tutees.");
    res.redirect("/tutors/" + res.locals.tutor._id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
  } else {
    Member.findByIdAndUpdate({tutorID: res.locals.tutor._id}, {$unset: {tutorID: ""}}).exec();
    Tutor.deleteOne({_id: res.locals.tutor._id}, function(err, tutor) {
      res.redirect("/tutors" + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    });
  }
});

module.exports = router;
