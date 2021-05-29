const express = require("express"),
      router = express.Router(),
      fs = require("fs"),
      auth = require("../middleware/auth"),
      search = require("../middleware/search"),
      backup = require("../services/backup"),
      Member = require("../models/member"),
      Backup = require("../models/backup"),
      ApiKey = require("../models/api-key");

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
      res.render("settings/index", {settingsLocation: "permissions", members: members});
    }
  });
});

router.put("/permissions", auth.hasAccessLevel(3), function(req, res) {
  Member.findOneAndUpdate({id: req.sanitize(req.body.id)}, {accessLevel: req.sanitize(req.body.accessLevel)}, function(err, member) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
    } else if (!member) {
      req.flash("error", "No member exists with that ID.");
    } else
      req.flash("success", "Successfully granted <a class='link--white' href='/members/" + member._id
      + "?from=%2Fsettings%2Fpermissions'>member " + member.id + "</a> permissions.");
    res.redirect("back");
  });
});

router.get("/term-migration", auth.hasAccessLevel(3), function(req, res) {
  res.render("settings/index", {settingsLocation: "term-migration"});
});

router.put("/term-migration", auth.hasAccessLevel(3), function(req, res) {
  var zipName = "./term_migration_" + utils.getCurrentDate("mm-dd-yyyy") + ".zip";
  require("../services/term-migration")(req.body, req.files ? req.files.newMembers : null, req.user.attendance ? req.user : null, zipName)
  .then(function(result) {
    req.flash("info", result); // fix: can't redirect?
    res.location("/settings/permissions");
    res.download(zipName, function(err) {
      fs.unlink(zipName, function(err){});
    });
  });
});

router.get("/download-database", auth.hasAccessLevel(3), function(req, res) {
  var zipName = "csf_portal_" + utils.getCurrentDate("mm-dd-yyyy") + ".zip";
  backup.createZipOfDatabase(zipName, req.body.ext).then(function(result) {
    res.download(zipName, function(err) {
      fs.unlink(zipName, function(err){});
    });
  });
});

router.get("/backups", auth.hasAccessLevel(3), function(req, res) {
  Backup.find({}, function(err, backups) {
    res.render("settings/index", {settingsLocation: "backups", backups: backups});
  });
});

router.put("/backups", auth.hasAccessLevel(3), function(req, res) {
  backup.restore(req.body.backupID).then(function(result) {
    req.flash("info", result);
    res.redirect("/settings/backups");
  });
});

router.delete("/backups", auth.hasAccessLevel(3), function(req, res) {
  if (req.body.backupID === "*") {
    Backup.deleteMany({}, function(err, deletedBackups) {
      if (err) {
        console.error(err);
        req.flash("error", "An unexpected error occurred.");
      } else
        req.flash("success", "All backups were deleted.");
      res.redirect("/settings/backups");
    });
  } else {
    Backup.findByIdAndDelete(req.body.backupID, function(err, deletedBackup) {
      if (err) {
        console.error(err);
        req.flash("error", "An unexpected error occurred.");
      } else if (!deletedBackup) {
        req.flash("error", "No backup found.");
      } else
        req.flash("success", "The selected backup was successfully deleted.");
      res.redirect("/settings/backups");
    });
  }
});

router.get("/api-keys", auth.hasAccessLevel(3), function(req, res) {
  ApiKey.find({}, function(err, apiKeys) {
    if (err) console.error(err);
    else res.render("settings/index", {settingsLocation: "api-keys", apiKeys: apiKeys});
  });
});

router.post("/api-keys", auth.hasAccessLevel(3), function(req, res) {
  ApiKey.create({scope: req.body.scope}, function(err, newApiKey) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
    }
    res.redirect("/settings/api-keys");
  });
});

router.delete("/api-keys/:id", auth.hasAccessLevel(3), search.apiKey, function(req, res) {
  ApiKey.findByIdAndDelete(req.params.id, function(err, deletedApiKey) {
    if (err) console.error(err);
    res.redirect("/settings/api-keys");
  });
});

router.get("/diagnostics", auth.hasAccessLevel(3), function(req, res) {
  res.render("settings/index", {settingsLocation: "diagnostics"});
});

router.get("/diagnostics/run-test", auth.hasAccessLevel(3), function(req, res) {
  require("../services/diagnostics").then(function(result) {
    req.flash("info", result ? result.substring(0, result.length-4) : "No discrepancies were found in the database.");
    res.redirect("/settings/diagnostics");
  });
});

module.exports = router;
