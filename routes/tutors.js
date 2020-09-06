const express = require("express"),
      router = express.Router(),
      shortid = require("shortid"),
      middleware = require("../middleware/index"),
      backup = require("../services/backup"),
      sns = require("../services/sns"),
      utils = require("../services/utils"),
      courses = require("../config/courses"),
      keys = require("../config/keys"),
      Tutor = require("../models/tutor"),
      Member = require("../models/member"),
      Tutee = require("../models/tutee");

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
  if (req.user && (req.user.accessLevel >= 2 || req.user.meetingsAttended && !req.user.tutorID)) {
    res.render("tutors/new", {courses: courses});
  } else if (req.user && req.user.tutorID) {
    res.redirect("/tutors/" + req.user.tutorID);
  } else if (!req.user || !req.user.meetingsAttended) {
    req.flash("info", "You must login with your school email and be a member of CSF to sign up as a tutor.");
    res.redirect("back");
  }
});

router.post("/", function(req, res) {
  req.body.tutor.id = req.user.accessLevel >= 2 ? req.sanitize(req.body.tutor.id) : req.user.id;
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
        id: req.body.tutor.id,
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

router.get("/:id", middleware.hasTutorAccess, function(req, res) {
  res.render("tutors/show", {tutor: req.foundTutor});
});

router.get("/:id/edit", middleware.hasTutorAccess, function(req, res) {
  res.render("tutors/edit", {tutor: req.foundTutor, courses: courses});
});

router.put("/:id", middleware.hasTutorAccess, function(req, res) {
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
      if (req.body.tutor.phoneNum != tutor.phoneNum) {
        var verificationCode = shortid.generate(), currentDate = new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-");
        Tutor.findByIdAndUpdate(req.params.id, {verifiedPhone: false, "verification.code": verificationCode, "verification.lastSent": currentDate}).exec();
        sns.sendSMS("To verify your phone number, go to " + keys.siteData.url + "/tutors/verify-phone/" + verificationCode, req.body.tutor.phoneNum);
      }
      res.redirect("/tutors/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.put("/:id/verify", middleware.hasAccessLevel(2), function(req, res) {
  Tutor.findByIdAndUpdate(req.params.id, {verified: true, verifiedPhone: true/* <-- REMOVE THIS! */}, function(err, tutor) {
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

router.put("/:id/unverify", middleware.hasAccessLevel(2), function(req, res) {
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

router.put("/:id/warn", middleware.hasAccessLevel(2), function(req, res) {
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

router.get("/:id/notify/:tuteeID", middleware.hasAccessLevel(2), function(req, res) {
  Tutor.findById(req.params.id, function(err, tutor) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("back");
    } else {
      Tutee.findById(req.params.tuteeID, function(err, tutee) {
        if (err) {
          console.error(err);
          req.flash("error", "An unexpected error occurred.");
          res.redirect("back");
        } else if (!tutor || !tutee) {
          res.redirect("back");
        } else {
          var message = "<pairing message>";
          sns.sendSMS(message, tutor.phoneNum);
        }
      });
    }
  });
});
/*
let message = sprintf("Here is the information for the student that you will be tutoring.\n\nStudent Information:\n%s\n%s\nNeeds help with:\n%s\n\nParent Information:\n%s\n%s\n\n" +
"To accept this pairing, open %s\n\n**If this match doesn't work out, please let me know so that I can assign you and the student someone else!**\n\nRemember to:\n1. Call the parent first, ASAP!\n" +
"2. Tell them what form of payment you are asking for (hours/money). Make sure it matches what they've requested.
\n3. Set up meeting times.\n4. Log your meetings.\n5. Let me know when the student no longer needs your services!!",
entry.fullName, entry.cellPhoneNum, entry.courses.join(', '), entry.parentFullName, entry.parentCellPhoneNum, _url + 'api/accept-pairing/' + id);
*/
router.get("/:id/resend-verification", middleware.hasTutorAccess, function(req, res) {
  if (req.foundTutor.verifiedPhone) {
    req.flash("info", "Your phone has already been verified.");
    res.redirect("back");
  } else {
    var currentDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-"));
    var lastSent = new Date(req.foundTutor.verification.lastSent);
    var timeoutEndDate = new Date(lastSent.setDate(lastSent.getDate() + 1));
    if (currentDate >= timeoutEndDate) {
      sns.sendSMS("To verify your phone number, go to " + keys.siteData.url + "/tutors/verify-phone/" + req.foundTutor.verification.code, req.foundTutor.phoneNum);
      Tutor.findByIdAndUpdate(req.foundTutor._id, {"verification.lastSent": new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-")}).exec();
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
      res.redirect("/" + (req.user && req.user.tutorID ? "tutors/" + req.user.tutorID : ""));
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
      res.redirect("/" + (req.user && req.user.tutorID ? "tutors/" + req.user.tutorID : ""));
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
        res.redirect("/" + (req.user && req.user.tutorID ? "tutors/" + req.user.tutorID : ""));
      });
    }
  });
});

module.exports = router;
