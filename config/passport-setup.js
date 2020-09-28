const passport = require("passport"),
      GoogleStrategy = require("passport-google-oauth20"),
      keys = require("./keys"),
      Member = require("../models/member"),
      Tutee = require("../models/tutee");

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  var isAdmin = false;
  Member.findById(id, function(err, member) {
    Tutee.findById(id, function(err, tutee) {
      if (keys.accounts.admins.includes(id)) isAdmin = true;
      if (member) return done(null, {_id: id, accessLevel: isAdmin ? 3 : member.accessLevel, id: member.id, meetingsAttended: member.meetingsAttended, tutorID: member.tutorID, tuteeID: member.tuteeID});
      else if (tutee) return done(null, {_id: id, accessLevel: isAdmin ? 3 : 0, id: tutee.id, tuteeID: tutee._id});
      else if (isAdmin) return done(null, {_id: id, accessLevel: 3});
      else done("You must use your school email and be in CSF or have an active tutoring request to login.");
    });
  });
});

passport.use(new GoogleStrategy({
    clientID: keys.google.clientID,
    clientSecret: keys.google.clientSecret,
    callbackURL: keys.siteData.url + "/login/google/callback",
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {
    var email = profile.emails[0].value, isAdmin = false;
    Member.findOne({id: email.substring(0, 9)}, function(err, member) {
      Tutee.findOne({id: email.substring(0, 9)}, function(err, tutee) {
        if (keys.accounts.admins.includes(email)) isAdmin = true;
        if (member && isAdmin && member.accessLevel < 3) Member.findByIdAndUpdate(member._id, {accessLevel: 3}).exec();
        if (member)  return done(null, {_id: member._id, accessLevel: isAdmin ? 3 : member.accessLevel, id: member.id, meetingsAttended: member.meetingsAttended, tutorID: member.tutorID, tuteeID: member.tuteeID});
        else if (tutee) return done(null, {_id: tutee._id, accessLevel: isAdmin ? 3 : 0, id: tutee.id, tuteeID: tutee._id});
        else if (isAdmin) return done(null, {_id: email, accessLevel: 3});
        else done("You must use your school email and be in CSF or have an active tutoring request to login.");
      });
    });
  }
));
