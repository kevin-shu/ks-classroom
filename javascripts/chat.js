var messagesRef = firebase.database().ref("chatrooms/"+conferenceName+"/messages");

// listen for incoming messages
messagesRef.on("child_added", function (snapshot) {
    var messageElement = $("<div class='message-bubble-wrapper clearfix'></div>"),
        messageBubble = $("<div class='message-bubble'></div>");

    if (snapshot.val().sender==id) {
        messageBubble.addClass("self");
    } else if (snapshot.val().sender=="teacher") {
        messageBubble.addClass("teacher");
    } else {
    }
    // 加上發送者及時間
    var sentTimeString = (new Date(snapshot.val().timestamp)).toLocaleString();
    messageBubble.append("<small>"+snapshot.val().sender+" "+sentTimeString+"</small>");
    // 加上訊息內容
    messageBubble.append("<p>"+snapshot.val().message+"</p>");
    // 把 bubble 加到 wrapper 中
    messageElement.append(messageBubble);
    $("#messages-container").append(messageElement);

    scrollMessagesContainerToBottom();
});

$("#message-input").keypress(function(event){
    if(event.which==13){
        var msg = $("#message-input").val();
        if (msg!="") {
            sendMessage(msg);
            $("#message-input").val("");
        }
    }
});

function scrollMessagesContainerToBottom(){
    var c = document.getElementById("messages-container");
    c.scrollTop = c.scrollHeight;
}

function sendMessage(msg) {
    // save in database
    messagesRef.push().set({
        "sender": id,
        "message": msg,
        "timestamp": new Date().getTime()
    });

    // prevent form from submitting
    return false;
};
