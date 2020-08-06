const fs = require("fs"),
      path = require("path");

/* exported functions */

var backup = {};

backup.object = function(path, object) {
  writeFileSync(path, object);
}

backup.mongooseModel = function(path, model, limit) {
  model.find({}, function(err, documents) {
    if (err || !documents)
      console.error(err ? err : "ERROR: The model you tried to backed up does not exist or has no contents.");
    else
      writeFileSync(path, limit ? limit(documents) : documents);
  });
}

backup.getBackupsData = function() {
  return getFileData("./backups");
}

module.exports = backup;

/* helper functions */

function writeFileSync(path, data) {
  var parsedPath = path.parse(path);
  if (!fs.existsSync(parsedPath.path)) {
    if (!fs.existsSync(parsedPath.dir))
      fs.mkdirSync(parsedPath.dir, {recursive: true}, function(err) { if (err) console.error(err); });
    fs.writeFileSync(parsedPath.path, JSON.stringify(data), function(err) { if (err) console.error(err); });
  } else {
    var duplicateCount = 1;
    while (fs.existsSync(parsedPath.dir + "/" + parsedPath.name + " (" + duplicateCount + ")" + parsedPath.ext)) duplicateCount++;
    fs.writeFileSync(parsedPath.dir + "/" + parsedPath.name + " (" + duplicateCount + ")" + parsedPath.ext, data, function(err) { if (err) console.error(err); });
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
