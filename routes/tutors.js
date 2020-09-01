const express = require("express"),
      router = express.Router(),
      shortid = require("shortid"),
      middleware = require("../middleware/index"),
      backup = require("../services/backup"),
      sns = require("../services/sns"),
      courses = require("../config/courses"),
      keys = require("../config/keys"),
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
  if (req.user.accessLevel < 2) req.body.tutor.id = req.user.id;
  else req.body.tutor.id = req.sanitize(req.body.tutor.id);
  Member.findOne({id: req.sanitize(req.body.tutor.id)}, function(err, foundMember) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors/new");
    } else if (!foundMember) {
      req.flash("error", "Only members of CSF can become tutors.");
      res.redirect("/tutors/new");
    } else {
      req.body.tutor.name = foundMember.name;
      req.body.tutor.grade = foundMember.grade;
      req.body.tutor.email = req.sanitize(req.body.tutor.email);
      req.body.tutor.phoneNum = req.sanitize(req.body.tutor.phoneNum);
      req.body.tutor.courses = req.body.courses;
      if (!req.body.tutor.courses) {
        req.flash("error", "You must select courses to tutor.");
        return res.redirect("/tutees/new");
      }
      if (!Array.isArray(req.body.tutor.courses)) req.body.tutor.courses = [req.body.tutor.courses];
      req.body.tutor.verification = {
        code: shortid.generate(),
        lastSent: new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-")
      };
      Tutor.create([req.body.tutor], function(err, newTutor) {
        if (err) {
          console.error(err);
          if (err.code == 11000)
            req.flash("error", "A tutor already exists with that ID.");
          else
            req.flash("error", "An unexpected error occurred.");
          res.redirect("/tutors/new");
        } else {
          sns.sendSMS("To verify your phone number, go to " + keys.siteData.url + "/tutors/verify-phone/" + newTutor[0].verification.code, newTutor[0].phoneNum);
          Member.findByIdAndUpdate(foundMember._id, {tutorID: newTutor[0]._id}).exec();
          if (req.user && req.user.id == newTutor[0].id) {
            req.flash("success", "You have successfully signed up as a tutor! Please click the verification link sent to your phone.");
            res.redirect("/tutors/" + newTutor[0]._id);
          } else {
            req.flash("success", "You have successfully signed up member " + newTutor[0].id + " as a tutor.");
            res.redirect("/tutors/" + newTutor[0]._id);
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
  delete req.body.tutor.id;
  req.body.tutor.email = req.sanitize(req.body.tutor.email);
  if (req.user.accessLevel < 2) delete req.body.tutor.phoneNum;
  else req.body.tutor.phoneNum = req.sanitize(req.body.tutor.phoneNum);
  req.body.tutor.courses = req.body.courses;
  Tutor.findByIdAndUpdate(req.params.id, req.body.tutor, function(err, foundTutor) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("/tutors/" + req.params.id + "/edit");
    } else {
      if (req.body.tutor.phoneNum != foundTutor.phoneNum) {
        var verificationCode = shortid.generate(), currentDate = new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-");
        Tutor.findByIdAndUpdate(req.params.id, {verifiedPhone: false, "verification.code": verificationCode, "verification.lastSent": currentDate}).exec();
        sns.sendSMS("To verify your phone number, go to " + keys.siteData.url + "/tutors/verify-phone/" + verificationCode, req.body.tutor.phoneNum);
      }
      res.redirect("/tutors/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.put("/:id/verify", middleware.hasAccessLevel(2), function(req, res) {
  Tutor.findByIdAndUpdate(req.params.id, {verified: true}, function(err, tutor) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
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
    } else {
      req.flash("success", "Successfully unverified Tutor " + tutor.name);
      res.redirect("/tutors/" + req.params.id + (req.query.from ? "?from=" + req.query.from.replace(/\//g, "%2F") : ""));
    }
  });
});

router.get("/:id/resend-verification", middleware.hasTutorAccess, function(req, res) {
  if (req.foundTutor.verifiedPhone) {
    req.flash("info", "Your phone has already been verified.");
    res.redirect("back");
  } else {
    var currentDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-"));
    var lastSent = new Date(req.foundTutor.verification.lastSent);
    var timeoutEndDate = lastSent.setDate(lastSent.getDate() + 1);
    if (currentDate >= timeoutEndDate) {
      sns.sendSMS("To verify your phone number, go to " + keys.siteData.url + "/tutors/verify-phone/" + req.foundTutor.verification.code, req.foundTutor.phoneNum);
      req.flash("success", "The phone verification link has been resent.");
      res.redirect("back");
    } else {
      req.flash("error", "The phone verification link can only be sent every 24 hours.");
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
