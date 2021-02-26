const fs = require("fs"),
      pathJS = require("path");
      pdfMake = require("pdfmake"),
      utils = require("./utils"),
      keys = require("../config/keys");

var pdf = {};

pdf.createFromJSON = function(data, path) {
  return new Promise(function(resolve, reject) {
    data.forEach(obj => { delete obj.__v; delete obj._id; });
    var docDefinition = {
      content: [
        {
          alignment: "justify",
          columns: [
            {image: pathJS.join(__dirname, "..", "public/images/logo.png"), width: 30, height: 30, margin: [0, 0, 0, 10]},
            {text: "CSF Portal", width: "auto", margin: [5, 6, 0, 0]},
            {text: "(" + keys.siteData.url + ")", width: "auto", link: keys.siteData.url, color: "#00889a", margin: [3, 6, 0, 0]}
          ]
        },
        {
          style: "table",
          table: {widths: [], headerRows: 1, body: [[/* each array in body is a row */]]},
          layout: {
            fillColor: function(rowIndex, node, columnIndex) {
              return (rowIndex % 2 == 0) ? "#d6d6d6" : null;
            }
          }
        }
      ]
    };
    /* creates header row */
    if (data[0]) {
      for (var key in data[0]) {
        if (data[0].hasOwnProperty(key)) {
          /* sets column widths */
          if (key == "_id" || key == "__v")
            continue;
          else if (key == "email")
            docDefinition.content[1].table.widths.push(100);
          else if (key == "membersAttended" || key == "meetingsAttended")
            docDefinition.content[1].table.widths.push(52);
          else if (key == "accessLevel")
            docDefinition.content[1].table.widths.push(40);
          else
            docDefinition.content[1].table.widths.push("auto");
          docDefinition.content[1].table.body[0].push({text: utils.reformatVar(key), style: "tableHeader", color: "#fbfbfb", fillColor: "#282828"});
        }
      }
    }
    /* creates body rows */
    data.forEach(function(obj) {
      var newRow = [];
      for (var key in obj) {
        if (obj.hasOwnProperty(key))
          newRow.push(obj[key]);
      }
      docDefinition.content[1].table.body.push(newRow);
    });
    /* creates the file */
    var printer = new pdfMake({Roboto: {
        normal: "node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf",
        bold: "node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf",
        italics: "node_modules/roboto-font/fonts/Roboto/roboto-italic-webfont.ttf",
        bolditalics: "node_modules/roboto-font/fonts/Roboto/roboto-bolditalic-webfont.ttf"
    }});
    var pdfDoc = printer.createPdfKitDocument(docDefinition);
    var output = fs.createWriteStream(path);
    pdfDoc.pipe(output);
    pdfDoc.end();
    output.on("finish", function() {
      resolve();
    });
  });
}

module.exports = pdf;
