const cheerio = require('cheerio');
const https   = require('https');
const msgpack = require('msgpack-lite');
const fs      = require('fs');

//Start at -1 so when call next() and ++'s, -> 0
var MSDELAY = 6000;
var authorIndex = -1;
var allAuthorIDs = [];

var oldAuthorOut = {};

function readObjMP(){
    if(fs.existsSync("authors.msp")){
        oldAuthorOut = msgpack.decode(fs.readFileSync("authors.msp"));
    }else{
        console.log("NO PREV AUTHORS.MSP SO HAVE TO SCRAPE EVERTHING :(")
            oldAuthorOut = {};
    }
}

function writeObjMP(){
    var writeStream = fs.createWriteStream("authors.msp");
    var encodeStream = msgpack.createEncodeStream();
    encodeStream.pipe(writeStream);

    // send multiple objects to stream 
    encodeStream.write(oldAuthorOut);

    // call this once you're done writing to the stream. 
    encodeStream.end();
}

function startGetAuthor(id){
    console.log(id +"\t("+(((authorIndex+1)/allAuthorIDs.length)*100).toFixed(3)+"%)")
        if((authorIndex+1)%30 == 0){
            //Every 30, write for safety
            console.log("WRITING FOR SAFETY");
            writeObjMP();
        }

    if(!oldAuthorOut[id]){
        //Isn't already in oldAuthor
        oldAuthorOut[id] = {total: 0, titles: {}};
    }
    //+1 so don't have 0
    //1st page = 1 not 0
    getAuthor(id);
}

function getAuthor(id){
    var URL="https://www.librarything.com/author/"+id+"&all=1";
    //Set timeout for 1.2 seconds so don't go against goodreads TOS
    setTimeout(function(){
        https.get(URL, function(response){
            var body = '';
            response.on('data', function(d) { body += d; });
            response.on('end', function() {
                $ = cheerio.load(body);
                var books = $(".worklist>ul>li>a");
                //Quick check if new books, saves most of the time here
                //Check if exists in old && ...
                if(books.length!=oldAuthorOut[id].total){
                    books.each(function(){
                        //Might want to have key be title, don't know until test it
                        var refNum = $(this).attr("href").replace("/work/", "");
                        if(refNum!="" && !oldAuthorOut[id].titles[refNum]){
                            //Is a new book!
                            var title = $(this).attr("title")
                            console.log("\t\t!!"+title);
                            oldAuthorOut[id].titles[refNum] = title;
                        }
                    })
                    oldAuthorOut[id].total = books.length;;
                }else{
                    console.log("\tNo Need...Same total");
                }
                nextAuthor();
            })
        })
    }, MSDELAY)
}

function nextAuthor(){
    authorIndex++;
    if(authorIndex >= allAuthorIDs.length){
        console.log("DONE ALL AUTHORS")
            writeObjMP()
    }else{
        startGetAuthor(allAuthorIDs[authorIndex]);
    }
}
function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
function main(){
    readObjMP();
    allAuthorIDs = [];
    https.get("https://www.librarything.com/ajax_authorgallery.php?view=Lorem&style=all&nosquare=0&start=0", function(response){
        var body = '';
        response.on('data', function(d) { body += d; });
        response.on('end', function() {
            $ = cheerio.load(body);
            $(".wrapper>.picture>a").each(function(){
                var id = $(this).attr("href").replace("/author/", "");
                if(id!=""){
                    allAuthorIDs.push(id)
                }
            })
            allAuthorIDs = shuffle(allAuthorIDs)

            console.log(allAuthorIDs);
            nextAuthor();
        })
    })
}
main();