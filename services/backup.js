const fs = require("fs"),
      pathJS = require("path");

/* helper functions */

function writeFileSync(path, data) {
  var parsedPath = pathJS.parse(path);
  if (!fs.existsSync(path)) {
    if (!fs.existsSync(parsedPath.dir))
      fs.mkdirSync(parsedPath.dir, {recursive: true}, function(err) { if (err) console.error(err); });
    fs.writeFileSync(path, typeof data == "object" ? JSON.stringify(data) : data, function(err) { if (err) console.error(err); });
  } else {
    var duplicateCount = 1;
    while (fs.existsSync(parsedPath.dir + "/" + parsedPath.name + " (" + duplicateCount + ")" + parsedPath.ext)) duplicateCount++;
    fs.writeFileSync(parsedPath.dir + "/" + parsedPath.name + " (" + duplicateCount + ")" + parsedPath.ext, typeof data == "object" ? JSON.stringify(data) : data, function(err) { if (err) console.error(err); });
  }
}

function getFileData(dirPath, arrayOfFiles) {
  arrayOfFiles = arrayOfFiles || [];
  fs.readdirSync(dirPath).forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory())
      arrayOfFiles = getFileData(dirPath + "/" + file, arrayOfFiles);
    else
      arrayOfFiles.push({name: file, data: fs.readFileSync(dirPath + "/" + file).toString().replace(/\n/g,"")});
  });
  return arrayOfFiles;
}

/* exported functions */

var backup = {};

backup.object = function(path, object) {
  writeFileSync(path, object);
}

backup.mongooseModel = function(path, model, limit) {
  model.find({}).lean().exec(function(err, documents) {
    if (err || !documents) console.error(err ? err : "ERROR: The model you tried to back up does not exist.");
    else writeFileSync(path, limit ? limit(documents) : documents);
  });
}

backup.getBackupsData = function() {
  return fs.existsSync("./backups") ? getFileData("./backups") : [];
}

backup.restoreFromBackup = function(reqBody) {
  return new Promise(function(resolve, reject) {
    if (reqBody.data) reqBody.data = JSON.parse(reqBody.data);
    var warningMsg = "";
    /* if the backup is a single meeting */
    if (reqBody.date) {
      if (reqBody.membersAttended.length == 0) reqBody.membersAttended = [];
      else reqBody.membersAttended = reqBody.membersAttended.split(",");
      Meeting.create([reqBody], function(err, newMeeting) {
        if (newMeeting) {
          if (newMeeting[0].membersAttended.length > 0) {
            newMeeting[0].membersAttended.forEach(function(memberID) {
              Member.updateOne({id: memberID}, {$addToSet: {"meetingsAttended": newMeeting[0].date}}, function(err, updateResult) {
                if (updateResult.n == 0) {
                  warningMsg += "<br>WARNING: The attendance records of the restored meeting contains a member with ID " + memberID + " that does not exist.";
                  console.warn("WARNING: The attendance records of the meeting on " + utils.reformatDate(newMeeting[0].date) + " that was restored from backup contains a member with ID " + memberID + " that does not exist.");
                } if (newMeeting[0].membersAttended.indexOf(memberID) == newMeeting[0].membersAttended.length-1)
                  resolve("The selected backup was successfully restored." + warningMsg);
              });
            });
          } else resolve("The selected backup was successfully restored.");
        } else resolve("The selected backup was not restored because it would overwrite current data. Check for a meeting that exists with the same date.");
      });
    /* if the backup is a single member */
    } else if (reqBody.id) {
      if (reqBody.meetingsAttended.length == 0) reqBody.meetingsAttended = [];
      else reqBody.meetingsAttended = reqBody.meetingsAttended.split(",");
      Member.create([reqBody], function(err, newMember) {
        if (newMember) {
          if (newMember[0].meetingsAttended.length > 0) {
            newMember[0].meetingsAttended.forEach(function(meetingDate) {
              Meeting.updateOne({date: meetingDate}, {$addToSet: {"membersAttended": newMember[0].id}}, function(err, updateResult) {
                if (updateResult.n == 0) {
                  warningMsg += "<br>WARNING: The attendance records of the restored member contains a meeting on " + utils.reformatDate(meetingDate) + " that does not exist.";
                  console.warn("WARNING: The attendance records of the member with ID " + newMember[0].id + " that was restored from backup contains a meeting on " + utils.reformatDate(meetingDate) + " that does not exist.");
                } if (newMember[0].meetingsAttended.indexOf(meetingDate) == newMember[0].meetingsAttended.length-1)
                  resolve("The selected backup was successfully restored." + warningMsg);
              });
            });
          } else resolve("The selected backup was successfully restored.");
        } else resolve("The selected backup was not restored because it would overwrite current data. Check for a member that exists with the same ID.");
      });
    } else if (reqBody.data && reqBody.data[0]) {
      /* if the backup is an array of meetings */
      if (reqBody.data[0].date) {
        backup.mongooseModel("./backups/replaced/meetings.txt", Meeting);
        Meeting.deleteMany({}, function(err, deleteResult) {
          Meeting.create(reqBody.data, function(err, newMeetings) {
            if (err) {
              console.error(err);
              resolve("An unexpected error occurred.");
            } else
              resolve("The selected backup was successfully restored: All previous meetings were backed up and replaced.");
          });
        });
      /* if the backup is an array of tutees */
      } else if (reqBody.data[0].parentEmail) {
        backup.mongooseModel("./backups/replaced/tutees.txt", Tutee);
        Tutee.deleteMany({}, function(err, deleteResult) {
          Tutee.create(reqBody.data, function(err, newTutees) {
            if (err) {
              console.error(err);
              resolve("An unexpected error occurred.");
            } else
              resolve("The selected backup was successfully restored: All previous tutees were backed up and replaced.");
          });
        });
      /* if the backup is an array of tutors */
      } else if (reqBody.data[0].email) {
        backup.mongooseModel("./backups/replaced/tutors.txt", Tutor);
        Tutor.deleteMany({}, function(err, deleteResult) {
          Tutor.create(reqBody.data, function(err, newTutors) {
            if (err) {
              console.error(err);
              resolve("An unexpected error occurred.");
            } else
              resolve("The selected backup was successfully restored: All previous tutors were backed up and replaced.");
          });
        });
      /* if the backup is an array of members */
      } else if (reqBody.data[0].id) {
        backup.mongooseModel("./backups/replaced/members.txt", Member);
        Member.deleteMany({}, function(err, deleteResult) {
          Member.create(reqBody.data, function(err, newMembers) {
            if (err) {
              console.error(err);
              resolve("An unexpected error occurred.");
            } else
              resolve("The selected backup was successfully restored: All previous members were backed up and replaced.");
          });
        });
      }
    } else
      resolve("You cannot restore from an empty backup.");
  });
}

module.exports = backup;
