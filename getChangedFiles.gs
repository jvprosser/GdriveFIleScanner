
var docIdCol=3;
var docDateCol=4;
// 9/30/20 8:00 AM	checkForChangedFiles	Service not found: appsactivity v1	time-based	9/30/20 8:00 AM
 
function updateFirebase(docId,modifiedDate,title){
  var firebaseUrl = "https://XVMLCCXVIII.firebaseio.com";
  var recentlyProcessed = false;

  const token = ScriptApp.getOAuthToken();
  var encToken = encodeURIComponent(token);
//const docIdurl = firebaseUrl + "/items.json?access_token=" + encToken;
//  const docIdurl = firebaseUrl + "/items/" + encodeURIComponent(docId)+ "/" + encodeURIComponent(docId) + " .json?access_token=" + encToken;
//const docIdurl = firebaseUrl + "/items/" + encodeURIComponent(docId)+ "/.json?access_token=" + encToken;
//const docIdurl = firebaseUrl + "/items/" + encodeURIComponent(docId)+ ".json?access_token=" + encToken;

const docIdurl = firebaseUrl + "/items/.json?access_token=" + encToken;

  const titleUrl = firebaseUrl + "/items/" + encodeURIComponent(docId) + "/title.json?access_token=" + encToken;
  const modDateUrl = firebaseUrl + "/items/" + encodeURIComponent(docId)+ "/modifiedDate.json?access_token=" + encToken;

  var getUrl = firebaseUrl + "/items/" +encodeURIComponent(docId) +"/modifiedDate.json?access_token=" + encToken;
  Logger.log(getUrl);

  //var base = FirebaseApp.getDatabaseByUrl(url);
  //var contact = base.getData(docId);
  //getUrl="https://cloudera-conveyor-belt-8e82c.firebaseio.com/items/1u53XXCXCXCXCXCXCXCXCXC96w26jpKRXXCXCZXCZCZB8k/modifiedDate.json?access_token=XXXXX-ZXCZXCZCZXCZXC-CCCCCCCCCCC"
  var r = UrlFetchApp.fetch(getUrl);
  var content =r.getContentText();

  if(content != "null") {
     var lastModifiedDateObj =Date.parse(content.replace(/"/g,""));
     var modifiedDateObj = Date.parse(modifiedDate);
     if( Math.abs(modifiedDateObj - lastModifiedDateObj) < 86400000) {
       recentlyProcessed=true;
       Logger.log("Skipped: " + title);
     }else{
       Logger.log("Repost: " + title);
    }
  }
  if(recentlyProcessed == false)  {
       const  dbData = {};
       dbData[docId] = {
        modifiedDate: modifiedDate,
        title: title
        };
        var test = JSON.stringify(dbData);
        const response1 = UrlFetchApp.fetch(docIdurl, {
          method: 'PATCH',
          payload: JSON.stringify(dbData)
      });
    }
  return(recentlyProcessed);
}






function findItemsInTeamDriveFolder(teamDriveId, driveName, modifiedDate){
  var teamDriveId=teamDriveId || '0AOEa7XVMLCCCLXI';
  var options={
    "orderBy":"folder",
    "corpora":"drive",
    "supportsAllDrives":true,
    "driveId":teamDriveId,
    "includeItemsFromAllDrives":true,
    "q":Utilities.formatString('modifiedDate > \'%s\' and mimeType contains \'vnd.google-apps\' and not mimeType = \'application/vnd.google-apps.folder\' and trashed = false',modifiedDate),
    };
  var files=Drive.Files.list(options);
  var data=JSON.parse(files);
  var row='';
  for(var i=0;i<data.items.length;i++){
    var docId = data.items[i].id;
    var modifiedDate = data.items[i].modifiedDate;
    var title = data.items[i].title;
    var parents = buildParentList(data.items[i].id);
    var author="Unknown";
    if(data.items[i].lastModifyingUserName != undefined){
      author = data.items[i].lastModifyingUserName;
    }
//Logger.log("driveName                         " + driveName);
//Logger.log("parents                           " + parents);
//Logger.log("title                             " + title);
//Logger.log("data.items[i].alternateLink       " + data.items[i].alternateLink);
//Logger.log("data.items[i].lastModifyingUserName" + data.items[i].lastModifyingUserName);

      row = Utilities.formatString('Path: %s/%s\nTitle: %s\n%s\nModified by:%s\n',driveName,parents, title,data.items[i].alternateLink,author); 
      if (updateFirebase(docId,modifiedDate,title) == false){
        //sendMeASlackMsg(row,"jprosser@cloudera.com");
        postToSlack(row,"jvprosser@github.com");
      }
  }
}
//    "q":Utilities.formatString('modifiedTime > \'%s\' and (mimeType contains 'vnd.google-apps') and \'%s\' in parents and trashed = false',modifiedDate, folderId),

function buildParentList(fileId) {
// Provide the file name
  // Search for the file with that name and process the first result

    var folders = [];
    var file = DriveApp.getFileById(fileId);
    var parent = file.getParents()
    
    while (parent.hasNext()) {
      parent = parent.next();
      folders.push(parent.getName());
      parent = parent.getParents();
    }

//    if (folders.length) {
//      // Display the full folder path
//      Logger.log("Folder path: " + folders.reverse().join("/"));
//    }
 //   folders.shift()
  var path=folders.reverse().join("/").replace("Drive/","")
  Logger.log("Folder path: " + path);
  return(path);
}


//modifiedDate > '2012-06-04T12:00:00' // default time zone is UTC
//modifiedTime > '2012-06-04T12:00:00' and (mimeType contains 'vnd.google-apps')
/***************************************************
Script will send an email notification to you or other email addresses
when a file in a given Google folder has been added, or modified. 06-07-16
***************************************************/
function checkForChangedFiles() {

  var driveList='Drives to Watch';
  var files = DriveApp.getFilesByName(driveList);
  var file = files.next();
  var spreadsheet = SpreadsheetApp.open(file);
  var sheet = spreadsheet.getSheets()[0];
  
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  var driveIdCol = 2;
  var i=0;
  for( i=1; i<= lastRow; i++ ) {
    var teamDriveId = sheet.getRange(i, driveIdCol).getValue();
    var driveName = sheet.getRange(i, 1).getValue();
    Logger.log("Working on drive: " + driveName);

    var today     = new Date();
  
  // Run script next day, and set below to 24 hours
  // 60 * 1000 = 60 second
  // 60* (60 * 1000) = 60 mins which is 1 hour
  // 24* (60* (60 * 1000)) = 1 day which 24 hours
    var fifteenMinutesAgo = new Date(today.getTime() - 1 * 15 * 60 * 1000);  
  // var oneDayAgo = new Date(today.getTime() - 1 * 60 * 1000);  
    
    var startTime = fifteenMinutesAgo.toISOString();
    findItemsInTeamDriveFolder(teamDriveId, driveName, startTime)
  }
  Logger.log("Finished!");
  return(0);
}

function sendMeASlackMsg(subject,sendto) {
var SLACKPOST_URL  = "https://hooks.slack.com/services/XVMCLLLXIII/MCXVMCLXI/XXCXCXCXCXCXCXCXCXCkCz";

 //SpreadsheetApp.getUi().alert('sendMeASlackMsg='+subject);
  var summaryAttachment = {
    //"fallback": ,
    "pretext": "<!channel> New Knowledge! " ,
    "title": subject,
    //"title_link": "https://docs.google.com/spreadsheets/d/" + FormApp.getActiveForm().getDestinationId(),
    //"fields": fields,
    "color": "#393939"
  };
  
  var responseAttachment = {
    "fallback": subject,
    "title": "Respond via email? (mailto link)",
    "title_link": "mailto:" + sendto + "?Subject=" + encodeURI(subject)
  };

  var options = {
    "method" : "post",
    "payload": JSON.stringify({
      "username": "ChangeIsGood",
      "icon_emoji": ":fishing_pole_and_fish:",
      "attachments": [summaryAttachment]
      //"attachments": [summaryAttachment, responseAttachment]
    })
  };

   UrlFetchApp.fetch(SLACKPOST_URL, options);
  //SpreadsheetApp.getUi().alert('message sent');
};

function postToSlack(subject,sendto) {
  var SLACKPOST_URL  = "https://hooks.slack.com/services/XVMCLLLXIII/MCXVMCLXI/XCXCXCXXXCXCXCXCXC";

 var payload = {
    'channel' : '#proj_conveyorbelt',
    'username' : 'doc_trawler@github.com',
    "icon_emoji": ":fishing_pole_and_fish:",
    'text' : subject
  }
//'icon_url' : 'https://puu.sh/BQqA9/408cadc2b3.png',
//    'attachments': [{
//      'text': subject,
//      'mrkdwn_in': ['text']
//   }]
//      'footer': '<http://www.linktoyourscript.com|edit script>',

  var options = {
    'method' : 'post',
    'contentType' : 'application/json',
    'payload' : JSON.stringify(payload)
  };
 
  return UrlFetchApp.fetch(SLACKPOST_URL, options)
}
