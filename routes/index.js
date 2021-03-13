const express = require("express"),
      router = express.Router(),
      passport = require("passport"),
      utils = require("../services/utils"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

router.get("/", function(req, res) {
  res.redirect("/members/attendance"); /* no home page as of now */
});

router.get("/login/google", passport.authenticate("google", {scope: ["email"]}));

router.get("/login/google/callback", passport.authenticate("google"), function(req, res) {
  req.flash("success", "You have successfully logged in as " + req.user.email + ".");
  res.redirect("/members/attendance");
});

router.get("/logout", function(req, res) {
  req.logout();
  req.flash("success", "You have been logged out.");
  res.redirect("/members/attendance");
});

router.get("/search", function(req, res) {
  if (!req.query.q) return res.render("404");
  req.query.q = req.sanitize(req.query.q.trim());
  if (!req.query.q) return res.json([]);
  var queryRegExp = new RegExp(req.query.q, "i"), result = [];
  Meeting.find({}, function(err, meetings) {
    meetings.forEach(function(meeting) {
      if (queryRegExp.test("meetings") || queryRegExp.test(meeting.date) || queryRegExp.test(utils.reformatDate(meeting.date)) || queryRegExp.test(meeting.description))
        result.push({type: "Meeting", date: meeting.date, description: meeting.description ? meeting.description : "No meeting description", href: "/meetings/" + meeting._id});
    });
    if (!req.user || req.user.accessLevel <= 0) {
      Member.findOne({id: req.query.q}, function(err, member) {
        if (member)
          result.unshift({type: "Attendance", id: member.id, attendanceCount: member.attendance.length, href: "/members/attendance?id=" + member.id});
        res.json(result);
      });
    } else if (req.user.accessLevel >= 1) {
      Member.find(queryRegExp.test("members") ? {} : {$or: [{name: queryRegExp}, {id: queryRegExp}]}, function(err, members) {
        members.forEach(function(member) {
          result.push({type: "Member", id: member.id, name: member.name, href: "/members/" + member._id});
        });
        if (req.user.accessLevel >= 2) {
          Tutor.find(queryRegExp.test("tutors") ? {} : {$or: [{name: queryRegExp}, {id: queryRegExp}]}, function(err, tutors) {
            tutors.forEach(function(tutor) {
              result.push({type: "Tutor", id: tutor.id, name: tutor.name, href: "/tutors/" + tutor._id + "?from=%2Ftutors"});
            });
            Tutee.find(queryRegExp.test("tutees") ? {} : {$or: [{name: queryRegExp}, {id: queryRegExp}]}, function(err, tutees) {
              tutees.forEach(function(tutee) {
                result.push({type: "Tutee", id: tutee.id, name: tutee.name, href: "/tutees/" + tutee._id + "?from=%2Ftutees"});
              });
              res.json(result);
            });
          });
        } else {
          res.json(result);
        }
      });
    }
  });
});

router.get("*", function(req, res) {
  res.render("404");
});

module.exports = router;
