console.log('background loaded!');

// DECLARING Variables
var sitesVisited = {0:[]}; // Doesn't need to be stored, this object helps with page processing -- The keys are the tabIds, values are the urls with the unique identifiers of the pages
var nodes = [];
var edges = [];
var pageCount = {};
var idObject = {};
var globalDict = {addedIds: [], dict: {}};

function retrieveObjects () {
    chrome.storage.local.get(function(storedObj) {

        if(typeof(storedObj.globalDict) !== 'undefined' && storedObj.globalDict.addedIds != undefined && storedObj.globalDict.dict != undefined) {
            globalDict = storedObj.globalDict;
        }

        if(typeof(storedObj.idObject) !== 'undefined'){
            idObject = storedObj.idObject;
        }
    });
}
retrieveObjects();

function namingID(page) {
    if (pageCount[page.id] != undefined) {
        pageCount[page.id] = pageCount[page.id] + 1;
    } else {
        pageCount[page.id] = 0;
    }

    var dup = JSON.parse(JSON.stringify(page))
    dup.id = page.id + '-' + pageCount[page.id]
    return dup.id;
}




var pageChangeTime = [];
chrome.tabs.onUpdated.addListener(function (tabId, change, tab) {
    clickTestify(change, tabId);
    // Use the loading event that will not depend on the connection speed
    // to confirm if the click event has lead to a navigation event 
    if (change.status == "complete") {
        pageChangeTime.push(Date.now());
        var isRefreshed = checkForRefresh(tab.url, tab.id);
        if (!isRefreshed) {


            var saveObj = {
                id : tab.id,
                status : "Completed",
                favIconUrl : tab.favIconUrl,
                openerTabId : tab.openerTabId,
                time : Date.now(),
                title : tab.title,
                url : tab.url,
                incognito : tab.incognito,
                active : tab.active
            }

            nomenclatureId(saveObj);
            //console.log("THE SAVED OBJECT : ", saveObj);

            var text = "";
            chrome.tabs.sendMessage(tabId, {content: "Gather the page text"}, function(response) {
                if(response) {
                    var keptText= [];
                    text = response.content.split(/\W+/);
                    text.forEach( function (item, index, object) {
                        var indexOf = words100list.indexOf(item);
                        if (word10000[item]!=undefined && indexOf <0 && (hasNumbers(item)==false) && (item.length < 20)) { //
                            keptText.push(item);
                        }
                    })
                    // ALSO SPLICE STRINGS OF NUMBERS
                    // AND LIMIT THE TOTAL SIZE

                    var dictio = new textAnalysis(keptText,saveObj.id);

                    dictio.createDict();
                    //console.log("Diction node: ", dictio);
                    dictio.updateGlobal();

                    calculateScore(dictio.keys,dictio.dict);
                    scoreSort(dictio.keys,dictio.dict);
                    var ar2 = dictio.keys.slice(0, 10);
                    //console.log("Main Words: ",ar2);
                    //ar2.forEach( function(e) {
                    //console.log("Word: ", e, " Score :", dictio.dict[e].score, "Count :", dictio.dict[e].count)
                    //})
                    saveObj.mainWords = ar2;

                    addClickText(saveObj);
                    pushNewPage(saveObj);
                }
            });
        }
    }
});



/// Click event listener

var clickActions = [0];
chrome.runtime.onMessage.addListener(function(message,sender,sendResponse){
    //console.log("Received The Click");
    var clickObj = {time: Date.now(), text: message.click.text, tabId: sender.tab.id };
    clickActions.push(clickObj);
    sendResponse({farewell:"Click Received"});
});

function addClickText (pageObj) {
    var lastClickEntry = clickActions.pop();
    if (lastClickEntry && lastClickEntry.tabId) {
        if (pageObj.id == lastClickEntry.tabId && lastClickEntry.confirmed){
            pageObj.clickText = lastClickEntry.text;
            //console.log("Click text has been added");
        }
    }
}

function checkForRefresh(currentUrl, tabId) {
    if (sitesVisited[tabId] == undefined){
        sitesVisited[tabId] = [];
        sitesVisited[tabId].push("We have started using this tab");
    }
    var sitelength = sitesVisited[tabId].length;
    var previousUrl = sitesVisited[tabId][sitelength-1];
    if (currentUrl == previousUrl) {
        return true;
    }
    else {
        sitesVisited[tabId].push(currentUrl);
        return false;
    }
}

chrome.tabs.onRemoved.addListener(function (tabId, info) {
    //console.log('onRemoved', tabId, info);
    var saveObj = {
        id : tabId,
        status : "Removed",
        timeStamp : Date.now()
    }
    //console.log("The OBJECT:",saveObj);
    nomenclatureId(saveObj);
    pushNewPage(saveObj);
});


function saveChanges(key, pageNode) {
    if (!pageNode) {
        console.log('Error: No value specified');
        return;
    }
    var obj = {}
    obj[key] = pageNode
    chrome.storage.sync.set(obj, function() {
        console.log('Page saved');
    });
}

function pushNewPage(pageObj) {
    chrome.storage.local.get(function(storedObj) {
        if(typeof(storedObj["pages"]) !== 'undefined' && storedObj["pages"] instanceof Array) {
            storedObj["pages"].push(pageObj);
            storedObj["globalDict"] = globalDict;
            storedObj["idObject"] = idObject;
        } else {
            storedObj["pages"] = [pageObj];
            storedObj["globalDict"] = globalDict;
            storedObj["idObject"] = idObject;
        }
        chrome.storage.local.set(storedObj);
    });
}

function textAnalysis(words, identifier) {
    this.dict = {};
    this.keys = [];
    this.id = identifier;
    this.words = words;
    var _this= this; // change to var _this

    this.createDict = function(){
        var dict = _this.dict;
        var keys = _this.keys;
        this.words.forEach( function(word){
            if (validate(word)){
                if (dict[word] == undefined) {
                    dict[word] = {};
                    dict[word].count = 1;
                    dict[word].word = word;
                    keys.push(word);
                } else {
                    dict[word].count++;
                }
            }
        });
    }

    this.updateGlobal = function() {

        var entryAdded = false;
        globalDict.addedIds.forEach( function (e) {
            if (e==_this.id) {entryAdded = true};
        })

        if (entryAdded == false) {
            globalDict.addedIds.push(_this.id);
            _this.keys.forEach ( function(word) {
                if (validate(word)){
                    var wordAdded = false;
                    if (globalDict.dict[word] == undefined) {
                        globalDict.dict[word] = {};
                        globalDict.dict[word].ids = [];
                    }
                    globalDict.dict[word].ids.forEach( function(e) {
                        if (e == _this.id) {
                            wordAdded = true
                        };
                    });
                    if (wordAdded == false) {globalDict.dict[word].ids.push(_this.id)}
                }
            });
        }
        calculateScore(_this.keys,_this.dict);
        scoreSort(_this.keys,_this.dict);
    }

    this.getCount = function(word) {
        return _this.dict[word].count;
    }

    this.countSort = function() {
        _this.keys.sort(function(a, b) {
            return (_this.getCount(b) - _this.getCount(a));
        });
    }
}

function calculateScore(keys,dict) {
    keys.forEach( function(word) {
        var entry = dict[word];
        //console.log("Word being checked in the globalDict", word);
        var tf = entry.count // I havent normalized by dividing by whole number of number of words, its not going to change the ranking, however I wont be able to compare these scores with the scores of other pages
        var lengthDic =1;
        if (globalDict.dict[word] != undefined) {
            lengthDic = globalDict.dict[word].ids.length;
        }

        var idf = Math.log(globalDict.addedIds.length / lengthDic);
        entry.score = tf * idf;
    });
}

function getScore(word,dict) {
    return dict[word].score;
}

function scoreSort(keys,dict) {
    keys.sort(function(a,b) {
        return (getScore(b,dict) - getScore(a,dict))
    });
}



chrome.browserAction.onClicked.addListener(function (tab) {
    console.log('browserAction', tab);
    chrome.tabs.create({'url': "/public/index.html" });

})


////// Functions to Process the Incoming text

// A function to tokenize
function tokenize(text) {
    var arrayText = text.split(/\W+/);
    return arrayText;
}

// A function to validate a token
function validate(token) {
    return /\w{2,}/.test(token);
}

function hasNumbers(t) {
    return /\d/.test(t);
}

// ID NAMING PROCESS


function nomenclatureId(nodeEvent) {
    firstVisit = true;
    // Assigns a unique identifier as a string for every event -- This one works for branching
    // Events need to be passed in a chronological order

    var currentId = nodeEvent.id;
    var newID = "";
    if (idObject[currentId]== undefined){
        idObject[currentId] = [{time : Date.now(), id:"0", url : "New Generation - 0"}];
    }

    // If the tab was closed
    if (nodeEvent.status == "Removed"){
        var maxGen = 0;
        idObject[currentId].forEach( function(e) {
            var arr = e.id.split("-");;
            if (maxGen < Number(arr[0])){
                maxGen = Number(arr[0]);
            }
        });
        newID = (maxGen+1).toString();
        nodeEvent.url = "New Generation - " + newID;
    }
    else if (nodeEvent.status == "Completed" && nodeEvent.openerTabId == undefined) {

        // CHECKING IF THE USER HAS GONE BACK TO VISIT AN OLD PAGE

        var lastItem = idObject[currentId].length -1;
        var lastItemId = idObject[currentId][lastItem].id;
        var stringArray = lastItemId.split("-");
        var startingId = stringArray.shift();
        var allTabStrings = [];
        idObject[currentId].forEach(function(item){
            allTabStrings.push(item.id);
        });
        var stringIndex = -1;
        var matchingString = false;

        for (var i= stringArray.length-1; i >0 ; i=i-1) {
            var id_string = startingId ;
            for (var j=0; j < i ; j++){
                id_string = id_string + '-' + stringArray[j];
            }
            stringIndex = allTabStrings.indexOf(id_string);
            if (idObject[currentId][stringIndex].url == nodeEvent.url){
                matchingString = true;
                break;
            }
        }

        if (matchingString) {
            newID =  idObject[currentId][stringIndex].id;
        }
        else {
            // Searching the next in line to see if the page is present

            var maxBranch = -1;
            var nextBranchFound = false;
            allTabStrings.forEach( function(item,index) {
                var startString = item.slice(0,lastItemId.length);
                if (startString == lastItemId) {

                    var tempString = item.slice(lastItemId.length+1,lastItemId.length+6);

                    var tempArray = tempString.split('-');

                    var branchNb = tempArray[0];
                    if (branchNb != ""){
                        var branchInt = Number(branchNb);
                        if (branchInt>maxBranch){
                            maxBranch = branchInt;

                        }
                    }

                }
            });


            for (var j = 0; j < maxBranch + 1; j++) {
                var stringTest = lastItemId + '-' + j;

                var indexLocated = allTabStrings.indexOf(stringTest);
                if (indexLocated >-1){

                    if (idObject[currentId][indexLocated].url == nodeEvent.url) {
                        nextBranchFound = true;
                        newID = stringTest;
                    }
                }
            }
            if (nextBranchFound == false){
                newID = lastItemId + '-' + (maxBranch+1);
            }
        }
    }
    else if (nodeEvent.status == "Completed" && nodeEvent.openerTabId != undefined) {
        // Check if there is a closing generation event
        var maxGen = 0;
        idObject[currentId].forEach( function(e) {
            var arr = e.id.split("-");;
            if (maxGen < Number(arr[0])){
                maxGen = Number(arr[0]);
            }
        });
        var stringNewGen = maxGen.toString();
        var GenerationUsed = false;
        idObject[currentId].forEach(function(item){
            var idDecomp = item.id.split('-');
            if (idDecomp[0] == maxGen.toString()){
                if (idDecomp[1] != "" && idDecomp[1] != undefined) {
                    GenerationUsed = true;
                }
            }
        });
        if (GenerationUsed) {
            newID = (maxGen+1) + '-' + 0;
        }
        else {
            newID = (maxGen) + '-' + 0;
        }
        var openerTabId = nodeEvent.openerTabId;
        if (idObject[openerTabId]==undefined) {
            idObject[openerTabId] = [{time : Date.now(), id:"0", url : "The id count has been restarted"}];
        }
        var lengthOpenerList = idObject[openerTabId].length-1;
        var openerIdString = idObject[openerTabId][lengthOpenerList].id;

        nodeEvent.openerTabId = openerIdString;
    }
    nodeEvent.idString = newID;
    console.log(" THE NEWLY ASSIGNED ID:", newID);
    idObject[currentId].push({time : Date.now(), id:newID, url : nodeEvent.url})
}
