const xlsxJS = require("xlsx");

var xlsx = {};

xlsx.parseMembers = function(file) {
  var workbook = xlsxJS.readFile(file);
  var fileData = xlsxJS.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]), members = [], warnings = [];
  for (var row in fileData) {
    members.push({});
    for (var column in fileData[row]) {
      switch(column.trim().toLowerCase()) {
        case "student_id":
          if (!fileData[row][column].toString() || isNaN(fileData[row][column]) || fileData[row][column].toString().length != 9)
            console.warn("WARNING: The member in row " + (parseInt(row)+2) + " of the uploaded Excel sheet has an invalid ID.");
          else
            members[members.length-1].id = fileData[row][column].toString();
          break;
        case "name":
          if (!fileData[row][column].toString())
            console.warn("WARNING: The member in row " + (parseInt(row)+2) + " of the uploaded Excel sheet has an invalid name.");
          else
            members[members.length-1].name = fileData[row][column].toString();
          break;
        case "grade":
          if (isNaN(fileData[row][column]) || parseInt(fileData[row][column]) < 9 || parseInt(fileData[row][column]) > 12)
            console.warn("WARNING: The member in row " + (parseInt(row)+2) + " of the uploaded Excel sheet has an invalid grade.");
          else
            members[members.length-1].grade = parseInt(fileData[row][column]);
          break;
        case "terms":
          if (isNaN(fileData[row][column]) || parseInt(fileData[row][column]) < 0 || parseInt(fileData[row][column]) > 7)
            console.warn("WARNING: The member in row " + (parseInt(row)+2) + " of the uploaded Excel sheet has an invalid term count.");
          else
            members[members.length-1].termCount = parseInt(fileData[row][column]);
          break;
        default:
          if (row == 0)
            console.warn("WARNING: The column \"" + column.trim() + "\" of the uploaded Excel sheet cannot be parsed.");
          break;
      }
    }
    if (!members[members.length-1].id || !members[members.length-1].name || isNaN(members[members.length-1].grade) || isNaN(members[members.length-1].termCount)) {
      console.warn("WARNING: The member in row " + (parseInt(row)+2) + " of the uploaded Excel sheet cannot be parsed.");
      warnings.push(parseInt(row)+2);
      members.splice(-1, 1);
    }
  }
  return {members: members, warnings: warnings};
}

xlsx.parseIDs = function(file) {
  var workbook = xlsxJS.readFile(file);
  var fileData = xlsxJS.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]), ids = [], warnings = [];
  for (var row in fileData) {
    for (var column in fileData[row]) {
      if (column.trim() == "student_id") {
        if (fileData[row][column].toString().match(new RegExp("^\\d{9}$")))
          ids.push(fileData[row][column].toString());
        else {
          console.warn("WARNING: The ID in row " + (parseInt(row)+2) + " of the uploaded attendance sheet is invalid.");
          warnings.push(parseInt(row)+2);
        }
      }
    }
  }
  return {ids: ids, warnings: warnings};
}

xlsx.writeMongooseModel = function(model, path, limit) {
  return new Promise(function(resolve, reject) {
    var workbook = xlsxJS.utils.book_new();
    model.find({}).lean().exec(function(err, documents) {
      if (err || !documents) console.error(err ? err : "ERROR: The model you tried to back up does not exist.");
      else {
        documents.forEach(doc => { delete doc.__v; delete doc._id; delete doc.tutorID; delete doc.tuteeID; });
        xlsxJS.utils.book_append_sheet(workbook, xlsxJS.utils.json_to_sheet(limit ? limit(documents) : documents));
        xlsxJS.writeFile(workbook, path);
      } resolve();
    });
  });
}

module.exports = xlsx;
