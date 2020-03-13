// joinConference(conferenceName);
// 

var role = "",
    conferenceName = "kkodingschool",
    id = "",
    teacherScreenStreamId = "";

$(function() {
    'use strict';

    var hash = window.location.hash;
    if (hash=="#teacher") {
        role = "teacher";
    } else {
        role = "student";
    }

    apiRTC.setLogLevel(0);
    var localStream = null,
        screensharingStream = null,
        connectedConversation = null;

    function joinConference(name) {
        // var cloudUrl = 'https://koding.school';
        var cloudUrl = 'https://cloud.apizee.com';
        var connectedSession = null;

        //==============================
        // 1/ CREATE USER AGENT
        //==============================
        var ua = new apiRTC.UserAgent({
            // uri: 'apzkey:myDemoApiKey'
            uri: 'apzkey:bc1d04c251c52afa9049785fd314191b'
        });

        //==============================
        // 2/ REGISTER
        //==============================
        var registerOptions = {
            cloudUrl: cloudUrl
        }
        if (role=="teacher") {
            registerOptions.id = "teacher"
        }

        ua.register(registerOptions).then(function(session) {

            console.log(session);
            id = session.id;
            $("#user-id-label").text(id);

            // Save session
            connectedSession = session;

            connectedSession
                .on("contactListUpdate", function (updatedContacts) { //display a list of connected users
                    console.log("MAIN - contactListUpdate", updatedContacts);
                    if (connectedConversation !== null) {
                        let contactList = connectedConversation.getContacts();
                        console.info("contactList  connectedConversation.getContacts() :", contactList);
                    }
                });

            //==============================
            // 3/ CREATE CONVERSATION
            //==============================

            ua.enableMeshRoomMode(true); //Activate Mesh room mode

            connectedConversation = connectedSession.getConversation(name);

            //==========================================================
            // 4/ ADD EVENT LISTENER : WHEN NEW STREAM IS AVAILABLE IN CONVERSATION
            //==========================================================
            connectedConversation.on('streamListChanged', function(streamInfo) {

                console.log("streamListChanged :", streamInfo);

                if (streamInfo.listEventType === 'added') {
                    if (streamInfo.isRemote === true && ( streamInfo.context.to===id || streamInfo.context.to==="all" )) {
                        // 如果加入的是老師而且是螢幕分享
                        if( streamInfo.contact.id==="teacher" && streamInfo.context.type==="screen" ){
                            teacherScreenStreamId = streamInfo.streamId;
                        }
                        connectedConversation.subscribeToMedia(streamInfo.streamId)
                            .then(function (stream) {
                                console.log('subscribeToMedia success');
                            }).catch(function (err) {
                                console.error('subscribeToMedia error', err);
                            });
                    }
                }
            });
            //=====================================================
            // 4 BIS/ ADD EVENT LISTENER : WHEN STREAM WAS REMOVED FROM THE CONVERSATION
            //=====================================================
            connectedConversation.on('streamAdded', function(stream) {
                if (role=="teacher") {
                    // Subscribed Stream is available for display
                    // Get remote media container
                    var container = document.getElementById('remote-container');
                    // Create link tag 
                    var linkTag = document.createElement('a');
                    linkTag.className = "js-student-video-wrapper";
                    $(linkTag).data("id",stream.contact.id);
                    // Create media element
                    var mediaElement = document.createElement('video');
                    mediaElement.id = 'remote-media-' + stream.streamId;
                    mediaElement.autoplay = true;
                    mediaElement.muted = false;
                    // Add media element to media container
                    linkTag.appendChild( mediaElement );
                    container.appendChild(linkTag);
                    // Attach stream
                    stream.attachToElement(mediaElement);
                    // stream.addInDiv('remote-container', 'remote-media-' + stream.streamId, {}, false);
                } else if (stream.contact.id=="teacher") {
                    if (stream.streamId === teacherScreenStreamId) {
                        stream.addInDiv('teacher-screen-container', 'remote-media-' + stream.streamId, {}, false);
                    } else {
                        stream.addInDiv('remote-container', 'remote-media-' + stream.streamId, {}, false);
                    }
                }


            }).on('streamRemoved', function(stream) {
                if (stream.streamId === teacherScreenStreamId) {
                    stream.removeFromDiv('teacher-screen-container', 'remote-media-' + stream.streamId);
                } else {
                    stream.removeFromDiv('remote-container', 'remote-media-' + stream.streamId);
                }
/*
                document.getElementById('remote-media-' + stream.streamId).remove();
*/
            });

            //==============================
            // 5/ CREATE LOCAL STREAM
            //==============================
            var createStreamOptions = {};
            createStreamOptions.constraints = {
                audio: true,
                video: true
            };

            ua.createStream(createStreamOptions)
                .then(function (stream) {

                    console.log('createStream :', stream);

                    // Save local stream
                    localStream = stream;
                    stream.removeFromDiv('local-container', 'local-media');
                    if (role=="teacher") {
                        stream.addInDiv('local-container', 'local-media', {}, true);
                    } else {
                        localStream.muteVideo();
                    }
/*
                    // Get media container
                    var container = document.getElementById('local-container');

                    // Create media element
                    var mediaElement = document.createElement('video');
                    mediaElement.id = 'local-media';
                    mediaElement.autoplay = true;
                    mediaElement.muted = true;

                    // Add media element to media container
                    container.appendChild(mediaElement);

                    // Attach stream
                    localStream.attachToElement(mediaElement);
*/

                    //==============================
                    // 6/ JOIN CONVERSATION
                    //==============================

                    connectedConversation.join()
                        .then(function(response) {
                            //==============================
                            // 7/ PUBLISH OWN STREAM
                            //==============================
                            // connectedConversation.publish(localStream, null);
                            if (role=="teacher") {
                                // 老師發佈 webcam
                                connectedConversation.publish(localStream, {qos:{videoStartQuality:"medium"},context:{type:"webcam",to:"all"}});
                            } else {
                                // 學生發佈螢幕
                                shareScreen("teacher");
                            }
                        }).catch(function (err) {
                            console.error('Conversation join error', err);
                        });
                }).catch(function (err) {
                    console.error('create stream error', err);
                });
        });
    }

    //==============================
    // CREATE CONFERENCE
    //==============================
    // $('#create').on('submit', function(e) {
    //     e.preventDefault();

    //     // Get conference name
    //     var conferenceName = document.getElementById('conference-name').value;

    //     document.getElementById('create').style.display = 'none';
    //     document.getElementById('conference').style.display = 'inline-block';
    //     document.getElementById('title').innerHTML = 'You are in conference: ' + conferenceName;
    //     document.getElementById('callActions').style.display = 'block';
    //     // Join conference
    //     joinConference(conferenceName);
    // });
    joinConference(conferenceName);
    // $('#toggle-screensharing').on('click', shareScreen);

    //==============================
    // CALL ACTIONS
    //==============================
    //muteAudio from call
    // $('#muteAudio').on('click', function () {
    //     console.log('MAIN - Click muteAudio');
    //     localStream.muteAudio();
    // });
    // //unMuteAudio from call
    // $('#unMuteAudio').on('click', function () {
    //     console.log('MAIN - Click unMuteAudio');
    //     localStream.unmuteAudio();
    // });
    // //muteVideo from call
    // $('#muteVideo').on('click', function () {
    //     console.log('MAIN - Click muteVideo');
    //     localStream.muteVideo();
    // });
    // //unMuteVideo from call
    // $('#unMuteVideo').on('click', function () {
    //     console.log('MAIN - Click unMuteVideo');
    //     localStream.unmuteVideo();
    // });

    //==============================
    // SCREENSHARING FEATURE
    //==============================
    function shareScreen (receiver) {

        if (screensharingStream === null) {
            var captureSourceType = [];
            if (apiRTC.browser === 'Firefox') {
                captureSourceType = "screen";
            } else {
                //Chrome
                captureSourceType = ["screen", "window", "tab", "audio"];
            }

            apiRTC.Stream.createScreensharingStream(captureSourceType)
                .then(function(stream) {

                    stream.on('stopped', function() {
                        //Used to detect when user stop the screenSharing with Chrome DesktopCapture UI
                        console.log("stopped event on stream");
                        document.getElementById('local-screensharing').remove();
                        screensharingStream = null;
                    });

                    screensharingStream = stream;

                    var publishOptions = {
                        qos:{videoStartQuality:"medium"},
                        context:{
                            from: id,
                            to: receiver,
                            type: "screen"
                        }
                    };
                    if (role=="teacher") {
                        publishOptions.qos.videoStartQuality = "good";
                        publishOptions.qos.videoMinQuality = "medium";
                    }
                    connectedConversation.publish(screensharingStream, publishOptions);
                    // Get media container
                    var container = document.getElementById('local-container');

                    // Create media element
                    var mediaElement = document.createElement('video');
                    mediaElement.id = 'local-screensharing';
                    mediaElement.autoplay = true;
                    mediaElement.muted = true;

                    // Add media element to media container
                    container.appendChild(mediaElement);

                    // Attach stream
                    screensharingStream.attachToElement(mediaElement);

                })
                .catch(function(err) {
                    console.error('Could not create screensharing stream :', err);
                });
        } else {
            connectedConversation.unpublish(screensharingStream);
            screensharingStream.release();
            screensharingStream = null;
            try {
                document.getElementById('local-screensharing').remove();
            } catch {}
            shareScreen(receiver);
        }
    }

    if (role=="teacher") {
        $("#remote-container").on("click",".js-student-video-wrapper",function(){
            var receiver = $(this).data("id");
            shareScreen(receiver);
        });
    }
});
