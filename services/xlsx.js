const xlsxJS = require("xlsx");

var xlsx = {};

xlsx.parseMembers = function(file) {
  var workbook = xlsxJS.readFile(file);
  var fileData = xlsxJS.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]), students = [];
  for (var row in fileData) {
    students.push({});
    for (var header in fileData[row]) {
      switch(header.trim()) {
        case "id":
        case "student_id":
          if (!fileData[row][header].toString())
            console.error("ERROR: The member in row " + row+1 + " of the uploaded Excel sheet has an invalid ID.");
          else
            students[students.length-1].id = fileData[row][header].toString();
          break;
        case "name":
          if (!fileData[row][header].toString())
            console.error("ERROR: The member in row " + row+1 + " of the uploaded Excel sheet has an invalid name.");
          else
            students[students.length-1].name = fileData[row][header].toString();
          break;
        case "grade":
          if (!parseInt(fileData[row][header]) || parseInt(fileData[row][header]) < 9 || parseInt(fileData[row][header]) > 12)
            console.error("ERROR: The member in row " + row+1 + " of the uploaded Excel sheet has an invalid grade.");
          else
            students[students.length-1].grade = parseInt(fileData[row][header]);
          break;
        case "terms":
          if (!parseInt(fileData[row][header]) || parseInt(fileData[row][header]) < 0 || parseInt(fileData[row][header]) > 7)
            console.error("ERROR: The member in row " + row+1 + " of the uploaded Excel sheet has an invalid term count.");
          else
            students[students.length-1].termCount = parseInt(fileData[row][header]);
          break;
        default:
          if (row == 0)
            console.error("ERROR: The header \"" + header.trim() + "\" on the uploaded Excel sheet cannot be parsed.");
          break;
      }
    }
    if (!students[students.length-1].id || !students[students.length-1].name || !students[students.length-1].grade || !students[students.length-1].termCount)
      students.splice(-1, 1);
  }
  return students;
}

module.exports = xlsx;
