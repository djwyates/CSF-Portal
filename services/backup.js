const fs = require("fs"),
      pathJS = require("path");

/* exported functions */

var backup = {};

backup.object = function(path, object) {
  writeFileSync(path, object);
}

backup.mongooseModel = function(path, model, limit) {
  model.find({}, function(err, documents) {
    if (err || !documents)
      console.error(err ? err : "ERROR: The model you tried to back up does not exist.");
    else
      writeFileSync(path, limit ? limit(documents) : documents);
  });
}

backup.getBackupsData = function() {
  return fs.existsSync("./backups") ? getFileData("./backups") : [];
}

module.exports = backup;

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
