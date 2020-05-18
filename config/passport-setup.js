const passport = require("passport"),
      GoogleStrategy = require("passport-google-oauth20"),
      keys = require("./keys"),
      Member = require("../models/member")

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  for (var i=0;i<keys.accounts.admins.length;i++) {
    if (id == keys.accounts.admins[i])
      return done(null, {_id: keys.accounts.admins[i], accessLevel: 3});
  }
  Member.findById(id, function(err, foundMember) {
    done(null, foundMember);
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
    // add check for parents/students associated with a tutor request form
    Member.findById(email.substring(0, 9), function (err, foundMember) {
      if (foundMember == null || email.substring(email.length-keys.accounts.domain.length) != keys.accounts.domain) {
        done("You must be in CSF and use your school email to login. If you are not in CSF and wish to view the status of your tutoring request, you must use the email associated with that request.");
      } else {
        done(null, foundMember);
      }
    });
  }
));
