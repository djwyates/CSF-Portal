const fs = require("fs"),
      pathJS = require("path");
      pdfMake = require("pdfmake"),
      utils = require("./utils"),
      keys = require("../config/keys");

var pdf = {};

pdf.writeMongooseModel = function(model, path, limit) {
  /* writes a PDF with a table containing every document in a mongoose model */
  return new Promise(function(resolve, reject) {
    model.find({}).lean().exec(function(err, documents) {
      if (err || !documents) console.error(err ? err : "ERROR: The model you tried to back up does not exist.");
      else {
        /* initialization of documents & PDF document definition */
        documents = limit ? limit(documents) : documents;
        documents.forEach(doc => {
          delete doc.__v; delete doc._id; delete doc.tutorID; delete doc.tuteeID; delete doc.verification;
          /* removes certain properties of each document so the table width will not exceed the total page width */
          delete doc.tutorSessions; delete doc.tuteeSessions; delete doc.gender; delete doc.grade;
          delete doc.parentName; delete doc.parentEmail; delete doc.parentPhoneNum; delete doc.paymentForm;
          delete doc.courses; delete doc.active; delete doc.warnings; delete doc.maxTutees; delete doc.verifiedPhone;
        });
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
        if (documents[0]) {
          for (var key in documents[0]) {
            if (documents[0].hasOwnProperty(key)) {
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
        documents.forEach(function(doc) {
          var newRow = [];
          for (var key in doc) {
            if (doc.hasOwnProperty(key))
              newRow.push(doc[key]);
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
      }
    });
  });
}

module.exports = pdf;
