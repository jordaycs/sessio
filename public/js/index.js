/*chrome.storage.local.get('pages', function (result) {
    channels = result.pages;
    alert(result.pages);
arrayDisp.innerText = result.pages;
})*/

window.addEventListener('load', function () {

    
    console.log("Load Sucessful");
    everythingD3();
    pages = [];
    chrome.storage.local.get('pages', function(results){
        pages = results.pages;

        var ObjNodes = processNodes(pages);
        drawGraph(ObjNodes);


    })


}, false )

// var ObjNodes = processNodes(pages);
// console.log(ObjNodes);
// drawGraph(ObjNodes);
