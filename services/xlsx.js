const fs = require("fs"),
      xlsxJS = require("xlsx")

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
          students[students.length-1].id = fileData[row][header].toString();
          break;
        case "name":
          students[students.length-1].name = fileData[row][header].toString();
          break;
        case "grade":
          students[students.length-1].grade = parseInt(fileData[row][header]);
          break;
        case "terms":
          students[students.length-1].termCount = parseInt(fileData[row][header]);
          break;
        default:
          if (row == 0)
            console.error("ERROR: The header \"" + header.trim() + "\" on the uploaded Excel sheet cannot be parsed.");
          break;
      }
    }
    if (!students[students.length-1].id || !students[students.length-1].name || !students[students.length-1].grade || !students[students.length-1].termCount) {
      console.error("ERROR: The member in row " + row+1 + " of the uploaded Excel sheet is missing component(s) of members or has the component(s) in an incorrect format.");
      delete students[students.length-1];
    }
  }
  return students;
}

module.exports = xlsx;
