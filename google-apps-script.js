/**
  * This is a Google Apps Script function which automatically records attendance once someone submits the form
  */

// use FormApp.getActiveForm(); to get prompt for required permissions

function onAttendanceFormSubmit(e) {
  // make sure these values are correct
  var meetingDate = "yyyy-mm-dd";
  var csfPortalAPIKey = "aaaaaaaaaa"; // generate this in the settings of the CSF Portal website
  var url = "https://foo-bar-baz.com/api/record-attendance";

  // parses form response for 9-digit ID
  var itemResponses = e.response.getItemResponses();
  var id = null;
  for (var i = 0; i < itemResponses.length; i++) {
    var itemTitle = itemResponses[i].getItem().getTitle().trim().toLowerCase();
    if (itemTitle === "long id" || itemTitle === "9-digit id" || itemTitle == "9 digit id") {
      id = itemResponses[i].getResponse();
      break;
    }
  }

  // makes a put request to 'url' with the data required to record attendance
  var data = {
    id: id,
    meetingDate: meetingDate,
    accessKey: csfPortalAPIKey
  };
  var options = {
    method: "put",
    payload: data
  };
  var response = UrlFetchApp.fetch(url, options);
}
