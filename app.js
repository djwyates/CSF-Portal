const express = require("express"),
      app = express(),
      bodyParser = require("body-parser"),
      flash = require("connect-flash"),
      expressSanitizer = require("express-sanitizer"),
      expressFileUpload = require("express-fileupload"),
      methodOverride = require("method-override"),
      mongoose = require("mongoose"),
      passport = require("passport"),
      expressSession = require("express-session"),
      keys = require("./config/keys");

// requiring routes
const indexRoutes = require("./routes/index"),
      settingsRoutes = require("./routes/settings"),
      meetingRoutes = require("./routes/meetings"),
      memberRoutes = require("./routes/members"),
      tutorRoutes = require("./routes/tutors"),
      tuteeRoutes = require("./routes/tutees");

app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(flash());
app.use(expressSanitizer());
app.use(expressFileUpload());
app.use(methodOverride("_method"));
mongoose.connect("mongodb://localhost:27017/csf", {useCreateIndex: true, useFindAndModify: false, useNewUrlParser: true, useUnifiedTopology: true});
app.use(expressSession({secret: keys.session.secret, resave: false, saveUninitialized: false, cookie: {maxAge: 3*24*60*60*1000}}));
app.use(passport.initialize());
app.use(passport.session());
require("./config/passport-setup");
app.use(function(req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.query = req.query;
  res.locals.url = req.url;
  res.locals.flash = {success: req.flash("success"), info: req.flash("info"), error: req.flash("error")};
  res.locals.ejs = require("./services/ejs");
  next();
});

app.use("/tutees", tuteeRoutes);
app.use("/tutors", tutorRoutes);
app.use("/members", memberRoutes);
app.use("/meetings", meetingRoutes);
app.use("/settings", settingsRoutes);
app.use("/", indexRoutes);

app.listen(process.env.PORT || 3000, process.env.IP, function() {
  console.log("The CSF Portal server has started.");
});
