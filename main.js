var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs'),
    os = require("os");

var ioclient = require('socket.io-client');


var hostName = os.hostname();
var eventCatalog = [];
var eventContainer = {};
var teamsContainer = {};
var vcoachTeamsContainer = {};
var vcoachTopsContainer = {};
var questions= {};

app.listen(80);

var totalCount = 0;

function handler(req, res)
{
    fs.readFile(__dirname + '/index.html', function (err, data)
    {
        if (err)
        {
            res.writeHead(500);
            return res.end('Error loading index.html');
        }

        res.writeHead(200);
        res.end(data);
    });
}



var wScokets = {};



var main = io.on('connection', function (socket)
{
    //console.log('main::new connection');

    socket.on('addEvent', function (eventObj)
    {
        //console.log('addEvent called');

        if (eventObj != undefined)
        {

            var serverId = eventObj.category + '_' + eventObj.id;
            var socketURL = 'http://' + hostName + '/' + serverId;
            addEvent(eventObj, socketURL);
            eventContainer[serverId] = [];
            questions[serverId] = [];
            //console.log('serverId = ' + serverId);
            // STORE AT BD
            // New socket entry

            wScokets[serverId] = io.of('/' + serverId).on('connection', function (eventClientSocket)
            {


                //console.log(serverId + '::new connection');
                var myServerId = serverId;
                // Create Handlers
                eventClientSocket.on('eventNotification', function (data)
                {
                    //STORE AT BD
                    eventContainer[myServerId].push(data);
                    
                    var _id = data.type.id;
                    console.log("data.type.Id = " + _id);
                    switch (_id)
                      {
                      case "YellowCard":
                        console.log("   YellowCard -> ");
                        var question="Concorda com o cartão amarelo mostrado a " + data.source.player.name + "?";
                        var questionId = 'yc'+new Date().getTime();
                        var newQuestion = { id : questionId, question: question };
                        questions[myServerId][questionId] = {yesCount: 0, noCount: 0};
                        
                        setTimeout(function(){
                            console.log("   SENT Question" + JSON.stringify(newQuestion));
                            wScokets[myServerId].emit('broadcastQuestion', newQuestion);
                        },5000);

                        var homeTeam = teamsContainer[myServerId].homeTeam;
                        var awayTeam = teamsContainer[myServerId].awayTeam;
                        
                        console.log("   SENT homeTeam" + JSON.stringify(homeTeam));
                        console.log("   SENT awayTeam" + JSON.stringify(awayTeam));

                        var player = findPlayerAndAddEvent(data.source.player.id, homeTeam, {'minute':data.minute,'type':_id});
                        if(player==undefined)
                        {
                            player = findPlayerAndAddEvent(data.source.player.id, awayTeam, {'minute':data.minute,'type':_id});
                        }
                        
                        console.log("   SENT broadcastPlayerSync -> "+ JSON.stringify({'players': [player]}));
                        wScokets[myServerId].emit('broadcastPlayerSync', {'players': [player]});

                        // SEND SYNC 
                        break;
                   
                      case "Substitution":
                            console.log("   teamsContainer" + JSON.stringify(homeTeam));

                            var homeTeam = teamsContainer[myServerId].homeTeam;
                            var awayTeam = teamsContainer[myServerId].awayTeam;
                            
                            console.log("   SENT homeTeam" + JSON.stringify(homeTeam));
                         

                            var outplayer = findPlayerAndAddEvent(data.source.player.id, homeTeam, {'minute':data.minute,'type':_id+'_out'});
                            findPlayerAndAddState(data.source.player.id,homeTeam,2);


                            var inplayer = findPlayerAndAddEvent(data.target.player.id, homeTeam, {'minute':data.minute,'type':_id+'_in'});
                            findPlayerAndAddState(data.target.player.id,homeTeam,0);


                            wScokets[myServerId].emit('broadcastPlayerSync', {'players': [outplayer,inplayer]});
                        break;

                      case "Goal":
                            var homeTeam = teamsContainer[myServerId].homeTeam;
                            var awayTeam = teamsContainer[myServerId].awayTeam;


                            var player = findPlayerAndAddEvent(data.source.player.id, homeTeam, {'minute':data.minute,'type':_id});
                            if(player==undefined)
                            {
                                player = findPlayerAndAddEvent(data.source.player.id, awayTeam, {'minute':data.minute,'type':_id});
                            }
                            wScokets[myServerId].emit('broadcastPlayerSync', {'players': [player]});
                         
                        break;

                      default:
                        //wScokets[serverId].emit('broadcastEventNotification', data);
                      }

                      wScokets[serverId].emit('broadcastEventNotification', data);

                });

                eventClientSocket.on('questionNotification', function (data)
                {
                    var questionId = data.id;
                    var element = questions[myServerId][questionId];

                    if(data.value==1)
                    {
                        element.yesCount++;
                    }
                    else
                    {
                        element.noCount++;
                    }
                    questions[myServerId][questionId] = element;

                    console.log("questions = " +  JSON.stringify(questions[myServerId][questionId]));
                });


                eventClientSocket.on('virtualCoachNotification', function (data)
                {
                    
                     // detect both Top 3
                    var homeTeamIn = vcoachTeamsContainer[myServerId].homeTeamOut;
                    //console.log(" HOMETEAMIN -> " + JSON.stringify(homeTeamIn));
                    var homeTeamOut = vcoachTeamsContainer[myServerId].homeTeamIn;
                    //console.log(" HOMETEAMOUT -> " + JSON.stringify(homeTeamOut));
                    var awayTeamIn = vcoachTeamsContainer[myServerId].awayTeamOut;
                    //console.log(" AWAYTEAMIN -> " + JSON.stringify(awayTeamIn));
                    var awayTeamOut = vcoachTeamsContainer[myServerId].awayTeamIn;
                    //console.log(" AWAYTEAMOUT -> " + JSON.stringify(awayTeamOut));
                    var res;
                    res = findPlayerAndIncrement(data.out, homeTeamOut);
                    if (!res)
                    {
                        findPlayerAndIncrement(data.out, awayTeamOut);
                    }

                    res = findPlayerAndIncrement(data.in , homeTeamIn);
                    if (!res)
                    {
                        findPlayerAndIncrement(data.in , awayTeamIn);
                    }
                    
                    homeTeamIn.sort(compare);
                    homeTeamOut.sort(compare);
                    awayTeamIn.sort(compare);
                    awayTeamOut.sort(compare);
                    

                    console.log(" AWAYTEAMIN SORTED -> " + JSON.stringify(awayTeamIn));
                    console.log(" AWAYTEAMOUT SORTED -> " + JSON.stringify(awayTeamOut));


                    var topHomeIn1 = (homeTeamIn[0].votes > 0 ) ? homeTeamIn[0].guid : "";
                    var topHomeIn2 = (homeTeamIn[1].votes > 0 ) ? homeTeamIn[1].guid : "";
                    var topHomeIn3 = (homeTeamIn[2].votes > 0 ) ? homeTeamIn[2].guid : "";

                    var topHomeOut1 = (homeTeamOut[0].votes > 0 ) ? homeTeamOut[0].guid : "";
                    var topHomeOut2 = (homeTeamOut[1].votes > 0 ) ? homeTeamOut[1].guid : "";
                    var topHomeOut3 = (homeTeamOut[2].votes > 0 ) ? homeTeamOut[2].guid : "";

                    var topAwayIn1 = (awayTeamIn[0].votes > 0 ) ? awayTeamIn[0].guid : "";
                    var topAwayIn2 = (awayTeamIn[1].votes > 0 ) ? awayTeamIn[1].guid : "";
                    var topAwayIn3 = (awayTeamIn[2].votes > 0 ) ? awayTeamIn[2].guid : "";

                    var topAwayOut1 = (awayTeamOut[0].votes > 0 ) ? awayTeamOut[0].guid : "";
                    var topAwayOut2 = (awayTeamOut[1].votes > 0 ) ? awayTeamOut[1].guid : "";
                    var topAwayOut3 = (awayTeamOut[2].votes > 0 ) ? awayTeamOut[2].guid : "";

                    var tops = { 
                            'topHomeIn1' : topHomeIn1,
                            'topHomeIn2' : topHomeIn2,
                            'topHomeIn3' : topHomeIn3,
                            'topHomeOut1' : topHomeOut1,
                            'topHomeOut2' : topHomeOut2,
                            'topHomeOut3' : topHomeOut3,
                            'topAwayIn1' : topAwayIn1,
                            'topAwayIn2' : topAwayIn2,
                            'topAwayIn3' : topAwayIn3,
                            'topAwayOut1' : topAwayOut1,
                            'topAwayOut2' : topAwayOut2,
                            'topAwayOut3' : topAwayOut3
                        };
                    if(vcoachTopsContainer[serverId]==undefined)
                    {
                        console.log("VCOACH 1 " + JSON.stringify(data));
                        console.log("tops " + JSON.stringify(tops));

                        vcoachTopsContainer[serverId] = tops;
                        wScokets[serverId].emit('broadcastVirtualCoachNotification', vcoachTopsContainer[serverId]);
                    }
                    else
                    {
                        if(tops!=vcoachTopsContainer[serverId])
                        {
                            console.log("VCOACH 2 " + JSON.stringify(data));
                            vcoachTopsContainer[serverId] = tops;
                            wScokets[serverId].emit('broadcastVirtualCoachNotification', vcoachTopsContainer[serverId]);
                        }
                        else
                        {
                            console.log("VCOACH SEM ALTERAÇÃO");
                        }

                    }

                    //wScokets[serverId].emit('broadcastVirtualCoachNotification', teamsContainer[myServerId]);
                });


                eventClientSocket.on('goalNotification', function (data)
                {

                    eventClientSocket.emit('broadcastvirtualCoachNotification', data);
                });
                eventClientSocket.on('teamsNotification', function (data)
                {
                    var homeTeamIn = [];
                    var homeTeamOut = [];
                    var awayTeamIn = [];
                    var awayTeamOut = [];

                    extractTeams(data.homeTeam, homeTeamIn, homeTeamOut);
                    extractTeams(data.awayTeam, awayTeamIn, awayTeamOut);
                    
                    vcoachTeamsContainer[myServerId] = {
                        'homeTeamIn': homeTeamIn,
                        'homeTeamOut': homeTeamOut,
                        'awayTeamIn': awayTeamIn,
                        'awayTeamOut': awayTeamOut
                    };

                    teamsContainer[myServerId] = data;

                    wScokets[serverId].emit('broadcastTeamsNotification', data);
                });
                //Twitter



                if (teamsContainer[myServerId] != undefined)
                {
                    eventClientSocket.emit('broadcastTeamsNotification', teamsContainer[myServerId]);
                }

                //emit old Event Data
                eventClientSocket.emit('oldEventNotification',
                {
                    'oldEventNotification': eventContainer[myServerId]
                });


                setTimeout(function(){
                    var aux = {};
                    aux = vcoachTopsContainer[serverId];
                    if(aux==undefined)
                    {
                        aux= {"topHomeIn1":"","topHomeIn2":"","topHomeIn3":"","topHomeOut1":"","topHomeOut2":"","topHomeOut3":"","topAwayIn1":"","topAwayIn2":"","topAwayIn3":"","topAwayOut1":"","topAwayOut2":"","topAwayOut3":""};
                    }

                    eventClientSocket.emit('broadcastVirtualCoachNotification', aux);

                },5000);
                

            });

            socket.emit('addEventResponse',
            {
                responseCode: 200,
                responseData:
                {
                    url: socketURL,
                    events: ["eventNotification", "virtualCoachNotification"]
                }
            });


        }

        // EmitCatalog
        io.sockets.emit('broadcastEventCatalog',
        {
            'eventCatalog': eventCatalog
        });
        //socket.emit('broadcastEventCatalog',eventCatalog);
    });



    socket.emit('broadcastEventCatalog',
    {
        'eventCatalog': eventCatalog
    });
});



function addEvent(eventObj, url)
{
    var catalogObj = eventObj;
    catalogObj.url = url;

    eventCatalog.push(catalogObj);
}

function findPlayerAndIncrement(guid, team)
{

    for (var i = 0; i < team.length; i++)
    {
        if (team[i].guid == guid)
        {
            console.log("############################################################" );
            console.log("INCREMENTED "+ team[i].guid );
            console.log("############################################################" );
            team[i].votes++;
            return true;
        }
    }
    return false;
}

function createTwitterTag(str)
{
    return "#" + str.replace(/^\s+|\s+$/g, '').toLowerCase();
}

function contains(str, word)
{
    return str.indexOf(word) != -1;
}

function extractTeams(originalTeam, teamIn, teamOut)
{

    for (var i = 0; i < originalTeam.length; i++)
    {
        if (i < 11)
        {
            teamIn.push(originalTeam[i]);
        }
        else
        {
            teamOut.push(originalTeam[i]);
        }

    }
}

function findPlayerAndAddEvent(guid, container, event)
{

    for (var i = 0; i < container.length; i++)
    {
        if (container[i].guid == guid)
        {
            console.log('#######################################')
            console.log('Encontrei -> '+ guid);
            console.log('#######################################\n\n\n')
            container[i].events.push(event);
            return container[i];
        }
    }
    return undefined;
}

function findPlayerAndAddState(guid, container, state)
{

    for (var i = 0; i < container.length; i++)
    {
        if (container[i].guid == guid)
        {
            container[i].state=state;
            return container[i];
        }
    }
    return undefined;
}


function compare(a,b) {
  if (a.votes > b.votes )
     return -1;
  if (a.votes < b.votes )
    return 1;
  return 0;
}