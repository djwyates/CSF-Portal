import InstantSearch from "./InstantSearch.js";

function reformatDate(date) {
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], date = new Date(date);
  return(months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear());
}

const searchEverything = document.querySelector("#searchEverything");
const instantSearchUsers = new InstantSearch(searchEverything, {
  searchUrl: new URL("/search", window.location.origin),
  queryParam: "q",
  responseParser: function(responseData) {
    return responseData;
  },
  templateFunction: function(result) {
    switch (result.type) {
      case "Meeting":
        return "<div class='search__title'>" + reformatDate(result.date) + "<span class='search__type'>Meeting</span></div><p class='search__p'>" + result.description + "</p>";
      case "Member":
        return "<div class='search__title'>" + result.name + "<span class='search__type'>Member</span></div><p class='search__p'>" + result.id + "</p>";
      case "Tutor":
        return "<div class='search__title'>" + result.name + "<span class='search__type'>Tutor</span></div><p class='search__p'>" + result.id + "</p>";
      case "Tutee":
        return "<div class='search__title'>" + result.name + "<span class='search__type'>Tutee</span></div><p class='search__p'>" + result.id + "</p>";
      case "Attendance":
        return "<div class='search__title'>" + result.id + "<span class='search__type'>Attendance</span></div><p class='search__p'>" + result.meetingsAttendedCount + " meetings attended (click for details)</p>";
      default:
        return "";
    }
  }
});
