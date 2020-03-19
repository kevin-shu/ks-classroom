
// Your web app's Firebase configuration
var firebaseConfig = {
    apiKey: "AIzaSyBWVoxiyq-lw-Lu6mK_sP1bbj2D4P4REXs",
    authDomain: "mybot-bdd53.firebaseapp.com",
    databaseURL: "https://mybot-bdd53.firebaseio.com",
    projectId: "mybot-bdd53",
    storageBucket: "mybot-bdd53.appspot.com",
    messagingSenderId: "128171586391",
    appId: "1:128171586391:web:bab9588c124a7489af8412"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

var conferenceName = prompt("請輸入會議室名稱:");
var id = prompt("請輸入 ID:");
