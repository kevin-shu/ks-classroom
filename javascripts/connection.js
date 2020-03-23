'use strict'

// ================================
//  A. Initialize 初始化設定
// ================================

var role = "",
    conferenceName = conferenceName || "kodingschool";
var CALLING_STATE = 0;  // 0: pending, waitting for calling
                        // 1: 1 v 1 calling
                        // 2: broadcasting audio
var CALLING_STATE_NAME = {
    0: "待命中",
    1: "1對1通話中",
    2: "廣播中"
}

if (id=="teacher") {
    role = "teacher";
} else {
    role = "student";
}

var localStream = null,
    screensharingStream = null,
    connectedConversation = null,
    connectedSession = null;

var cloudUrl = 'https://cloud.apizee.com';

// ApiRTC: CREATE USER AGENT
var ua = new apiRTC.UserAgent({
    // uri: 'apzkey:myDemoApiKey'
    uri: 'apzkey:bc1d04c251c52afa9049785fd314191b'
});

// ApiRTC: REGISTER
var registerOptions = {
    // cloudUrl: cloudUrl
    id: id
}

// ================================
//  B. Execation 主程式
// ================================

apiRTC.setLogLevel(0);

ua.register(registerOptions).then(function(session) {

    console.log(session);
    id = session.id;
    $("#user-id").text(id);
    if (role=="teacher") {
        $("#user-role").text("講師");
    } else {
        $("#user-role").text("學生");
    }

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
        // WHEN A CONTACT CALLS ME
        .on('incomingCall', function (invitation) {
            console.log("MAIN - incomingCall");
            // ACCEPT CALL INVITATION
            invitation.accept(null, {mediaTypeForIncomingCall : 'AUDIO'}).then(function (call) {
                setCallListeners(call);
            });
        })
        .on("incomingScreenSharingCall", function (call) { //When client receives an screenSharing call from another user
            console.log("screenSharing received from :", call.getContact().id);
            setCallListeners(call);
        });
    joinConference(conferenceName);
});

// ================================
//  C. Functions 函式們
// ================================

function joinConference(name) {
    // CREATE CONVERSATION
    // ua.enableMeshRoomMode(true); //Activate Mesh room mode
    connectedConversation = connectedSession.getConversation(name);

    //==========================================================
    // 4/ ADD EVENT LISTENER : WHEN NEW STREAM IS AVAILABLE IN CONVERSATION
    //==========================================================
    connectedConversation.on('streamListChanged', function(streamInfo) {

        console.log("streamListChanged :", streamInfo);

        if (streamInfo.listEventType === 'added') {
            if (streamInfo.isRemote === true && ( streamInfo.context.to===id || streamInfo.context.to==="all" )) {
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
            // 如果是老師群撥分享熒幕
            if (stream.isScreensharing()) {
                stream.addInDiv("main-video-wrapper", 'remote-media-' + stream.streamId, {}, false);
            // 如果是老師分享 webcam
            } else {
                // Subscribed Stream is available for display
                // Get remote media container
                var container = document.getElementById('teacher-cam-container');
                var mediaElement = document.createElement('video');
                mediaElement.id = 'remote-media-' + stream.streamId;
                mediaElement.autoplay = true; // 一定要 autoplay，不然白畫面
                mediaElement.muted = true; // 如果沒有 mute 會造成 autoplay 失敗!
                container.appendChild(mediaElement);
                stream.attachToElement(mediaElement);

                //======================================================
                // 非常重要：
                // 依據 Chrome 的 autoplay policy，用戶必須先和這個網頁有所互動才行，包含點擊。
                // 因此我們在這裡先加入一個 alert，等用戶點擊後，就可取消靜音了
                //======================================================
                alert("與老師建立連線！");
                mediaElement.muted = false; // 避免群撥時學生聽不到老師的聲音
            }
        }
    }).on('streamRemoved', function(stream) {
        $('#remote-media-' + stream.streamId).remove();
        // 如果是老師接收到學生關 stream 的事件，要把 component 也刪掉
        $('#remote-media-' + stream.streamId + '-wrapper').remove();
    });

    // 如果是老師，創造並發佈 LOCAL STREAM
    if (role==="teacher") {
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
                // 一開始不用發出聲音，先關聲音
                localStream.muteAudio();

                stream.removeFromDiv('teacher-cam-container', 'local-media');
                stream.addInDiv('teacher-cam-container', 'local-media', {}, true);
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
                            context:{type:"webcam",to:"all"}
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

// 螢幕分享
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

function broadcast () {
    if (role!="teacher") {
        console.warn("你不是老師，不可群撥！");
    } else if (CALLING_STATE==0) {
        shareScreen("all");
        localStream.unmuteAudio()
        updateCallingState();
    } else {
        console.warn("目前非待命狀態，不可群撥！");
    }
}

function stopBroadcasting () {
    screensharingStream.
    localStream.muteAudio();
    updateCallingState();
}

// 撥給學生
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
            updateCallingState();
        } else {
            // 如果螢幕分享失敗，掛掉聲音的電話
            audioCall.hangUp();
            console.warn("Cannot establish call");
        }
    } else {
        console.warn("Cannot establish call");
    }
}

// 確認現在的通話，並更改 CALLING_STATE，必要時強制結束所有通話
function updateCallingState() {
    // @TODO: 還需要檢查是否群撥

    var newState = CALLING_STATE,
        onlineCallIds = Object.keys(connectedSession.getCalls());

    // 如果有 0 個通話，代表應該是待命中 (但也有可能正在群撥)
    if (onlineCallIds.length==0) {
        if ( !localStream.isAudioMuted() ) {
            newState = 2;
        } else {
            newState = 0;
        }
    // 如果有兩個通話，代表應該是螢幕和聲音，正常
    } else if (onlineCallIds.length==2) {
        newState = 1;
    // 都不是的話就怪怪的了，過 0.2 秒再檢查一次
    } else {
        setTimeout(updateCallingState,200);
    }

    // 如果狀態有變化:
    if (CALLING_STATE!=newState){
        // 正式更新狀態
        CALLING_STATE = newState;
        // 觸發 “狀態改變” 事件
        $(window).trigger("stateChanged");
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
                // $('#local-media-' + stream.getId()).remove();
            });
    })
    .on("streamAdded", function (stream) {
        if (role==="teacher") {
            stream.addInDiv('calling-media-container', 'remote-media-' + stream.streamId, {}, false);
        } else {
            stream.addInDiv('main-video-wrapper', 'remote-media-' + stream.streamId, {}, false);
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
    .on('response', function(){
        updateCallingState();
    })
    .on('remoteStreamUpdated', function(){
        updateCallingState();
    })
    .on('hangup', function () {
        $("#hangup-button").remove();
        updateCallingState();
    });
}

function attachStudentScreenStream(stream) {
    // Subscribed Stream is available for display
    // Get remote media container
    var container = document.getElementById('student-screens-container');
    // Create link tag 
    var studentComponent = document.createElement('div');
    studentComponent.id = 'remote-media-' + stream.streamId + '-wrapper';
    studentComponent.classList.add( "js-student-screen-component" );
    studentComponent.classList.add( "student-screen-component" );
    $(studentComponent).data("id",stream.contact.id);
    var videoWrapper = $("<div class='student-video-wrapper'></div>");
    // Create media element
    var mediaElement = document.createElement('video');
    mediaElement.id = 'remote-media-' + stream.streamId;
    mediaElement.autoplay = true;
    mediaElement.muted = false;
    // Add media element to media container
    videoWrapper.append(mediaElement);
    $(studentComponent).append( videoWrapper );
    $(studentComponent).append("<div class='student-user-id'>"+stream.contact.id+"</div>");
    container.appendChild(studentComponent);
    // Attach stream
    stream.attachToElement(mediaElement);
}


// ================================
//  D. Event subscription 註冊事件
// ================================

// 當學生螢幕被點擊:
$("#student-screens-container").on("click",".js-student-screen-component",function(){
    if (role=="teacher") {
        var receiver = $(this).data("id");
        $("#main-video-wrapper").append($(this).find("video"));
        $("#operation-buttons-container").show(); // @TODO: 如果學生離線，按鈕還會在
        $("#call-btn").data("receiver-id",receiver);
    }
});

// 當 call 按鍵被點下:
$("#call-btn").click(function(){
    var receiverId = $(this).data("receiver-id");
    callStudent(receiverId);
});

$("#hangup-btn").click(function(){
    var onlineCalls = connectedSession.getCalls();
    for (callId in onlineCalls) {
        onlineCalls[callId].hangUp();
    }
});

$("#broadcast-btn").click(function(){
    broadcast();
});
$("#stop-broadcasting-btn").click(function(){
    broadcast();
});

$(window).on("stateChanged", function(){
    if (role=="teacher") {
        if (CALLING_STATE == 1) {
            $("#hangup-btn").show();
            $("#call-btn").hide();
            $("#broadcast-btn").hide();
            $("#stop-broadcasting-btn").hide();
        } else if (CALLING_STATE == 0) {
            $("#hangup-btn").hide();
            $("#call-btn").show();
            $("#broadcast-btn").show();
            $("#stop-broadcasting-btn").hide();
        } else if (CALLING_STATE == 2) {
            $("#hangup-btn").hide();
            $("#call-btn").hide();
            $("#broadcast-btn").hide();
            $("#stop-broadcasting-btn").show();
        }
    } else {
        $("#hangup-btn").remove();
        $("#call-btn").remove();
        $("#broadcast-btn").remove();
        $("#stop-broadcasting-btn").remove();
    }

    // 修改狀態顯示欄位
    $("#user-state").text(CALLING_STATE_NAME[CALLING_STATE]);
});
$(window).trigger("stateChanged"); // 先依狀態校正一下 UI;
