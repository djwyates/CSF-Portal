const fs = require("fs"),
      parsePath = require("parse-filepath")

function writeFileSync(path, data) {
  var parsedPath = parsePath(path);
  if (!fs.existsSync(parsedPath.path)) {
    if (!fs.existsSync(parsedPath.dir))
      fs.mkdirSync(parsedPath.dir, {recursive: true}, function(err) { if (err) console.error(err); });
    fs.writeFileSync(parsedPath.path, data, function(err) { if (err) console.error(err); });
  } else {
    var i = 1;
    while (true) {
      if (!fs.existsSync(parsedPath.dir + "/" + parsedPath.name + " (" + i + ")" + parsedPath.ext)) {
        fs.writeFileSync(parsedPath.dir + "/" + parsedPath.name + " (" + i + ")" + parsedPath.ext, data, function(err) { if (err) console.error(err); });
        break;
      }
      i++;
    }
  }
}

var backup = {};

backup.object = function(path, object) {
  writeFileSync(path, object);
}

backup.mongooseModel = function(path, model, limit) {
  model.find({}, function(err, documents) {
    if (err || !documents) {
      console.error(err ? err : "ERROR: The model you tried to backed up does not exist or has no contents.");
    } else {
      writeFileSync(path, limit ? limit(documents) : documents);
    }
  });
}

module.exports = backup;