const express = require("express"),
      router = express.Router(),
      passport = require("passport")

router.get("/", function(req, res) {
  res.render("landing");
});

router.get("/login/google", passport.authenticate("google", {scope: ["email"]}));

router.get("/login/google/callback", passport.authenticate("google"), function(req, res) {
  req.flash("success", "You have successfully logged in.");
  if (req.user.accessLevel == 0) {
    res.redirect("/members/" + req.user._id + "/attendance");
  } else {
    res.redirect("/meetings");
  }
});

router.get("/logout", function(req, res) {
  req.logout();
  req.flash("success", "You have logged out.");
  res.redirect("/");
});

router.get("*", function(req, res) {
  res.render("404");
});

module.exports = router;
