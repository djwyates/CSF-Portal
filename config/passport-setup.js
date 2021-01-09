const passport = require("passport"),
      GoogleStrategy = require("passport-google-oauth20"),
      keys = require("./keys"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  var isAdmin = false;
  Member.findById(id, function(err, member) {
    Tutee.findById(id, function(err, tutee) {
      if (keys.accounts.admins.includes(id)) isAdmin = true;
      if (member) return done(null, {_id: id, email: member.id + keys.accounts.domain, accessLevel: isAdmin ? 3 : member.accessLevel, id: member.id, meetingsAttended: member.meetingsAttended, tutorID: member.tutorID, tuteeID: member.tuteeID});
      else if (tutee) return done(null, {_id: id, email: tutee.id + keys.accounts.domain, accessLevel: isAdmin ? 3 : 0, id: tutee.id, tuteeID: tutee._id});
      else if (isAdmin) return done(null, {_id: id, email: id, accessLevel: 3});
      else {
        Tutor.findOne({email: id}, function(err, tutor) {
          Tutee.findOne({$or: [{email: id}, {parentEmail: id}]}, function(err, foundTutee) {
            var user = {_id: id, email: id, accessLevel: 0};
            if (tutor) user.tutorID = tutor._id;
            if (foundTutee) user.tuteeID = foundTutee._id;
            return done(null, user);
          });
        });
      }
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
        if (member)  return done(null, {_id: member._id, email: email, accessLevel: isAdmin ? 3 : member.accessLevel, id: member.id, meetingsAttended: member.meetingsAttended, tutorID: member.tutorID, tuteeID: member.tuteeID});
        else if (tutee) return done(null, {_id: tutee._id, email: email, accessLevel: isAdmin ? 3 : 0, id: tutee.id, tuteeID: tutee._id});
        else if (isAdmin) return done(null, {_id: email, email: email, accessLevel: 3});
        else {
          Tutor.findOne({email: email}, function(err, tutor) {
            Tutee.findOne({$or: [{email: email}, {parentEmail: email}]}, function(err, foundTutee) {
              var user = {_id: email, email: email, accessLevel: 0};
              if (tutor) user.tutorID = tutor._id;
              if (foundTutee) user.tuteeID = foundTutee._id;
              return done(null, user);
            });
          });
        }
      });
    });
  }
));
