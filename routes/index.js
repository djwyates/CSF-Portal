const express = require("express"),
      router = express.Router(),
      passport = require("passport")

router.get("/", function(req, res) {
  res.render("landing");
});

router.get("/login/google", passport.authenticate("google", {scope: ["email"]}));

router.get("/login/google/callback", passport.authenticate("google"), function(req, res) {
  req.flash("success", "You have successfully logged in.");
  res.redirect("/members/attendance");
});

router.get("/logout", function(req, res) {
  req.logout();
  req.flash("success", "You have been logged out.");
  res.redirect("/");
});

router.get("*", function(req, res) {
  res.render("404");
});

module.exports = router;
