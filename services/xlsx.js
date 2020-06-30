const xlsxJS = require("xlsx");

var xlsx = {};

xlsx.parseMembers = function(file) {
  var workbook = xlsxJS.readFile(file);
  var fileData = xlsxJS.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]), members = [], warnings = [];
  for (var row in fileData) {
    members.push({});
    for (var header in fileData[row]) {
      switch(header.trim()) {
        case "student_id":
          if (!fileData[row][header].toString() || isNaN(fileData[row][header]) || fileData[row][header].toString().length != 9)
            console.warn("WARNING: The member in row " + (parseInt(row)+2) + " of the uploaded Excel sheet has an invalid ID.");
          else
            members[members.length-1].id = fileData[row][header].toString();
          break;
        case "name":
          if (!fileData[row][header].toString())
            console.warn("WARNING: The member in row " + (parseInt(row)+2) + " of the uploaded Excel sheet has an invalid name.");
          else
            members[members.length-1].name = fileData[row][header].toString();
          break;
        case "grade":
          if (isNaN(fileData[row][header]) || parseInt(fileData[row][header]) < 9 || parseInt(fileData[row][header]) > 12)
            console.warn("WARNING: The member in row " + (parseInt(row)+2) + " of the uploaded Excel sheet has an invalid grade.");
          else
            members[members.length-1].grade = parseInt(fileData[row][header]);
          break;
        case "terms":
          if (isNaN(fileData[row][header]) || parseInt(fileData[row][header]) < 0 || parseInt(fileData[row][header]) > 7)
            console.warn("WARNING: The member in row " + (parseInt(row)+2) + " of the uploaded Excel sheet has an invalid term count.");
          else
            members[members.length-1].termCount = parseInt(fileData[row][header]);
          break;
        default:
          if (row == 0)
            console.warn("WARNING: The header \"" + header.trim() + "\" of the uploaded Excel sheet cannot be parsed.");
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

module.exports = xlsx;
