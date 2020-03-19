'use strict'

var role = "",
    conferenceName = conferenceName || "kodingschool";

if (id=="teacher") {
    role = "teacher";
} else {
    role = "student";
}

apiRTC.setLogLevel(0);
var localStream = null,
    screensharingStream = null,
    connectedConversation = null,
    connectedSession = null;

// Register

var cloudUrl = 'https://cloud.apizee.com';

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
    // cloudUrl: cloudUrl
    id: id
}

// if (role=="teacher") {
//     registerOptions.id = "teacher"
// }

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
        })
        //==============================
        // WHEN A CONTACT CALLS ME
        //==============================
        .on('incomingCall', function (invitation) {
            console.log("MAIN - incomingCall");
            alert("incoming call!")
            //==============================
            // ACCEPT CALL INVITATION
            //==============================
            invitation.accept(null, {mediaTypeForIncomingCall : 'AUDIO'}).then(function (call) {
                setCallListeners(call);
                addHangupButton(call.getId());
            });
            // Display hangup button
            // document.getElementById('hangup').style.display = 'inline-block';
        })
        .on("incomingScreenSharingCall", function (call) { //When client receives an screenSharing call from another user
            console.log("screenSharing received from :", call.getContact().id);
            setCallListeners(call);
            addHangupButton(call.getId());
        });
    joinConference(conferenceName);
});

function joinConference(name) {
    //==============================
    // 3/ CREATE CONVERSATION
    //==============================

    // ua.enableMeshRoomMode(true); //Activate Mesh room mode

    connectedConversation = connectedSession.getConversation(name);

    //==============================
    // 定期確認講師的畫面是否存在
    //==============================
    // setInterval(function(){
    //     console.log("checking teacher's stream...")
    //     if(checkTeacherScreenStreamAttached()){
    //         // Do nothing
    //     } else {
    //         console.log("there's no teacher's stream!")
    //         var teacherStream = getStream(connectedConversation, "teacher");
    //         if(teacherStream){console.log("Finded teacher's stream!")}
    //         console.log(teacherStream);
    //         teacherStream.addInDiv('teacher-cam-container', 'remote-media-' + teacherStream.streamId, {}, false);
    //     }
    // },10000);

    //==========================================================
    // 4/ ADD EVENT LISTENER : WHEN NEW STREAM IS AVAILABLE IN CONVERSATION
    //==========================================================
    connectedConversation.on('streamListChanged', function(streamInfo) {

        console.log("streamListChanged :", streamInfo);

        if (streamInfo.listEventType === 'added') {
            if (streamInfo.isRemote === true && ( streamInfo.context.to===id || streamInfo.context.to==="all" )) {
                // 如果加入的是老師而且是螢幕分享 (但是現在不需要了)
                // if( streamInfo.contact.id==="teacher" && streamInfo.context.type==="screen" ){
                //     teacherScreenStreamId = streamInfo.streamId;
                // }
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
            attachStudentScreenStream(stream);
        } else if (stream.contact.id=="teacher") {
            // Subscribed Stream is available for display
            // Get remote media container
            var container = document.getElementById('teacher-cam-container');
            // Create media element
            var mediaElement = document.createElement('video');
            mediaElement.id = 'remote-media-' + stream.streamId;
            mediaElement.autoplay = true; // 一定要 autoplay，不然白畫面
            mediaElement.muted = true; // 要 autoplay 一定要 muted
            // Add media element to media container
            container.appendChild(mediaElement);
            // Attach stream
            stream.attachToElement(mediaElement);
        }
    }).on('streamRemoved', function(stream) {
        if (stream.contact.id=="teacher") {
            stream.removeFromDiv('teacher-cam-container', 'remote-media-' + stream.streamId);
        } else {
            $('#remote-media-' + stream.streamId).remove();
            $('#remote-media-' + stream.streamId + '-wrapper').remove();
            // stream.removeFromDiv('student-screens-container', 'remote-media-' + stream.streamId);
        }
    });

    //==============================
    // 如果是老師，創造並發佈 LOCAL STREAM
    //==============================
    if (role==="teacher") {
        var createStreamOptions = {};
        createStreamOptions.constraints = {
            audio: false,
            video: true
        };

        ua.createStream(createStreamOptions)
            .then(function (stream) {

                console.log('createStream :', stream);

                // Save local stream
                localStream = stream;
                stream.removeFromDiv('local-container', 'local-media');
                stream.addInDiv('local-container', 'local-media', {}, true);
                //==============================
                // 6/ JOIN CONVERSATION
                //==============================
                connectedConversation.join()
                    .then(function(response) {
                        //==============================
                        // 7/ PUBLISH OWN STREAM
                        //==============================
                        connectedConversation.publish(localStream, {
                            qos:{videoStartQuality:"medium"},
                            context:{type:"webcam",to:"all"},
                            videoOnly:true
                        });
                    }).catch(function (err) {
                        console.error('Conversation join error', err);
                    });
            }).catch(function (err) {
                console.error('create stream error', err);
            });
    //==============================
    // 如果是學生，創造並發佈 Screen stream
    //==============================
    } else {
        connectedConversation.join()
        .then(function(response) {
            // 學生發佈螢幕
            shareScreen("teacher");
        }).catch(function (err) {
            console.error('Conversation join error', err);
        });
    }
}

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
                    },
                    videoOnly: true
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

function callStudent(receiverId) {
    console.log("calling: ",receiverId);
    var contact = connectedSession.getOrCreateContact(receiverId);
    // console.log(contact);
    var audioCall = contact.call(null, {audioOnly: true});
    if (audioCall !== null) {
        setCallListeners(audioCall);

        // 聲音打通後才進 Screen call
        var callConfiguration = {};
        if (apiRTC.browser === 'Firefox') {
            callConfiguration.captureSourceType = "screen";
        } else {
            //Chrome
            callConfiguration.captureSourceType = ["screen", "window", "tab", "audio"];
        }
        var shareScreenCall = contact.shareScreen(callConfiguration);
        if (shareScreenCall !== null) {
            setCallListeners(shareScreenCall);
            addHangupButton(audioCall.getId(), shareScreenCall.getId());
        } else {
            // 如果螢幕分享失敗，掛掉聲音的電話
            audioCall.hangUp();
            console.warn("Cannot establish call");
        }
    } else {
        console.warn("Cannot establish call");
    }
}

function setCallListeners(call) {
    call.on("localStreamAvailable", function (stream) {
        console.log('localStreamAvailable');
        // 不用加這行，不然會有回音，因為我們已經分享 local stream 了
        // stream.addInDiv('calling-media-container', 'local-media-' + stream.streamId, {}, false);
        stream
            .on("stopped", function () { //When client receives an screenSharing call from another user
                console.error("Stream stopped");
                $('#local-media-' + stream.getId()).remove();
            });
    })
    .on("streamAdded", function (stream) {
        console.log('stream :', stream);
        if (role==="teacher") {
            stream.addInDiv('calling-media-container', 'remote-media-' + stream.streamId, {}, false);
        } else {
            stream.addInDiv('teacher-screen-container', 'remote-media-' + stream.streamId, {}, false);
        }
    })
    .on('streamRemoved', function (stream) {
        // Remove media element
        document.getElementById('remote-media-' + stream.getId()).remove();
    })
    .on('userMediaError', function (e) {
        console.log('userMediaError detected : ', e);
        console.log('userMediaError detected with error : ', e.error);

        //Checking if tryAudioCallActivated
        if (e.tryAudioCallActivated === false) {
            $('#hangup-' + call.getId()).remove();
        }
    })
    .on('desktopCapture', function (e) {
        console.log('desktopCapture event : ', e);
        $('#hangup-' + call.getId()).remove();
    })
    .on('hangup', function () {
        // $('#hangup-' + call.getId()).remove();
        $("#hangup-button").remove();
    });
}

function addHangupButton(audioCallId, shareScreenCallId) {
    var btn = document.createElement('button');
    btn.innerText = "Hangup";
    btn.id = "hangup-button";
    $(btn).data("audio-call-id",audioCallId);
    $(btn).data("share-screen-call-id",shareScreenCallId);
    $("#operation-buttons-container").append(btn);
    $(btn).click(function(){
        var audioCallId = $(this).data("audio-call-id"),
            shareScreenCallId = $(this).data("share-screen-call-id");
        connectedSession.getCall(audioCallId).hangUp();
        shareScreenCall = connectedSession.getCall(shareScreenCallId).hangUp();
    })
}

// // 確認老師的 webcam 是否存在於畫面中
// function checkTeacherScreenStreamAttached() {
//     // If there's no teacher's webcam
//     // @TODO: 應該要更進一步檢查老師的 Webcam stream 死掉沒有
//     if( $("#teacher-cam-container video").length==0 ){
//         return false;
//     } else {
//         return true;
//     }
// }

// // 從 conversation 取得特定 user 的 stream 
// function getStream(connectedConversation, userId) {
//     var streams = connectedConversation.getAvailableStreamList();
//     for (var i=0; i<streams.length; i++) {
//         if(streams[i].contact.id==userId){
//             return streams[i];
//         }
//     }
//     return null;
// }

function attachStudentScreenStream(stream) {
    // Subscribed Stream is available for display
    // Get remote media container
    var container = document.getElementById('student-screens-container');
    // Create link tag 
    var linkTag = document.createElement('a');
    linkTag.id = 'remote-media-' + stream.streamId + '-wrapper';
    linkTag.classList.add( "js-student-video-wrapper" );
    linkTag.classList.add( "student-video-wrapper" );
    linkTag.href="javascript:void(0)"
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
}

if (role=="teacher") {
    $("#student-screens-container").on("click",".js-student-video-wrapper",function(){
        var receiver = $(this).data("id");
        this.classList.add("activated");
        $("#operation-buttons-container").show();
        $("#call-btn").data("receiver-id",receiver);
    });
}

$(window).on("keyup", function (e){
    if (e.which == 27) {
        $(".student-video-wrapper.activated").removeClass("activated");
        $("#operation-buttons-container").hide();
        $("#hangup-button").remove();
    }
})

$("#call-btn").click(function(){
    var receiverId = $(this).data("receiver-id");
    callStudent(receiverId);
});
