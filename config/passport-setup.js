const passport = require("passport"),
      GoogleStrategy = require("passport-google-oauth20"),
      keys = require("./keys"),
      Member = require("../models/member"),
      Tutee = require("../models/tutee");

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  for (var i=0;i<keys.accounts.admins.length;i++) {
    if (id == keys.accounts.admins[i])
      return done(null, {id: keys.accounts.admins[i], accessLevel: 3});
  }
  Member.findById(id, function(err, foundMember) {
    if (foundMember) {
      done(null, foundMember);
    } else {
      Tutee.findById(id).lean().exec(function(err, foundTutee) {
        foundTutee.accessLevel = 0;
        foundTutee.tuteeID = foundTutee._id;
        done(null, foundTutee);
      });
    }
  });
});

passport.use(new GoogleStrategy({
    clientID: keys.google.clientID,
    clientSecret: keys.google.clientSecret,
    callbackURL: "/login/google/callback",
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {
    var email = profile.emails[0].value;
    for (var i=0;i<keys.accounts.admins.length;i++) {
      if (email == keys.accounts.admins[i])
        return done(null, {_id: email, accessLevel: 3});
    }
    if (email.substring(email.length-keys.accounts.domain.length) != keys.accounts.domain)
      done("You must use your school email to login.");
    Member.findOne({id: email.substring(0, 9)}, function (err, foundMember) {
      if (foundMember) {
        done(null, foundMember);
      } else {
        Tutee.findOne({id: email.substring(0, 9)}).lean().exec(function(err, foundTutee) {
          if (foundTutee) {
            foundTutee.accessLevel = 0;
            foundTutee.tuteeID = foundTutee._id;
            done(null, foundTutee);
          } else
            done("You must be in CSF or have an active tutoring request to login.");
        });
      }
    });
  }
));
