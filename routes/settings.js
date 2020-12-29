const express = require("express"),
      router = express.Router(),
      dirTree = require("directory-tree"),
      fs = require("fs"),
      auth = require("../middleware/auth"),
      backup = require("../services/backup"),
      Member = require("../models/member");

router.get("/", auth.hasAccessLevel(3), function(req, res) {
  res.redirect("/settings/permissions");
});

router.get("/permissions", auth.hasAccessLevel(3), function(req, res) {
  Member.find({accessLevel: {$gte: 1}}, function(err, members) {
    if (err) console.error(err);
    else {
      members.sort(function(a, b) {
        var aLastName = a.name.split(" ")[a.name.split(" ").length-1], bLastName = b.name.split(" ")[b.name.split(" ").length-1];
        return (aLastName < bLastName) ? -1 : (aLastName > bLastName) ? 1 : 0;
      });
      res.render("settings/permissions", {members: members});
    }
  });
});

router.get("/term-migration", auth.hasAccessLevel(3), function(req, res) {
  res.render("settings/term-migration");
});

router.put("/term-migration", auth.hasAccessLevel(3), function(req, res) {
  require("../services/term-migration")(req.body, req.files ? req.files.newMembers : null, req.user.meetingsAttended ? req.user : null).then(function(result) {
    req.flash("info", result); // fix: can't redirect?
    res.location("/settings/permissions");
    res.download("./term_migration_" + utils.getCurrentDate("mm-dd-yyyy") + ".zip", function(err) {
      fs.unlink("./term_migration_" + utils.getCurrentDate("mm-dd-yyyy") + ".zip", function(err){});
    });
  });
});

router.get("/backups", auth.hasAccessLevel(3), function(req, res) {
  //console.log("-----BACKUPS FILES-----");
  //console.log(backup.getBackupFiles());
  //console.log("-----DIR TREE-----");
  //console.log(dirTree("./backups", {extensions: /\.txt/}));
  //return res.redirect("back");
  res.render("settings/backups", {
    backupsDirTree: dirTree("./backups", {extensions: /\.txt/}),
    backupFiles: backup.getBackupFiles(),
    resolvePath: require("path").resolve
  });
});

router.put("/backups", auth.hasAccessLevel(3), function(req, res) {
  backup.restoreFromBackup(req.body).then(function(result) {
    req.flash("info", result);
    res.redirect("/settings/backups");
  });
});

router.delete("/backups", auth.hasAccessLevel(3), function(req, res) {
  fs.unlink(req.body.path, function(err) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
    } else
      req.flash("success", "The selected backup was successfully deleted.");
    res.redirect("/settings/backups");
  });
});

router.get("/diagnostics", auth.hasAccessLevel(3), function(req, res) {
  res.render("settings/diagnostics");
});

router.get("/diagnostics/run-test", auth.hasAccessLevel(3), function(req, res) {
  require("../services/diagnostics").then(function(result) {
    req.flash("info", result ? result.substring(0, result.length-4) : "No discrepancies were found in the database.");
    res.redirect("/settings/diagnostics");
  });
});

module.exports = router;
