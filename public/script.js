const socket = io();
const startCallBtn = document.getElementById("startCall");
const joinCallBtn = document.getElementById("joinCall");
const roomIdInput = document.getElementById("roomId");
const roomNumberDisplay = document.getElementById("roomNumber");
const activeRoomDisplay = document.getElementById("activeRoomNumber");
const generatedIdDisplay = document.getElementById("generatedId");
const setupScreen = document.querySelector(".setup-screen");
const callscreen = document.querySelector(".call-screen");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const muteAudioBtn = document.getElementById("muteAudio");
const muteVideoBtn = document.getElementById("muteVideo");
const joinRequestContainer = document.getElementById("joinRequests");

let localPeerConnection;
let myStream;
let roomId;
let myUserId;
let isRoomHost=false;
let audioEnabled=true;
let videoEnabled=true;
let currentRemoteUserId=null;

const iceServers = {
    iceServers: [
        {urls: "stun:stun.l.google.com:19302"},
        {urls: "stun:stun1.l.google.com:19302"},
        {urls: "stun:stun2.l.google.com:19302"}
    ]
};
startCallBtn.onclick = async () => {
    roomId = generateRoomId();
    isRoomHost = true;
    myUserId = generateUserId();
    startCall(roomId);
}
joinCallBtn.onclick = () => {
    const inputId = roomIdInput.value.trim();
    if (!inputId) return alert("Escriba un ID de Llamada");
    roomId = inputId;
    isRoomHost = false;
    myUserId = generateUserId();
    startCall(roomId);
  };
async function startCall(roomId){
    try{
        myStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        myStream.getAudioTracks().forEach(track => {
            track.enabled=true;
        });
        audioEnabled = true;
        if(muteAudioBtn){
            muteAudioBtn.textContent = "Silenciar Audio";
            muteAudioBtn.classList.remove("muted");
        }
        localVideo.srcObject = myStream;
        localVideo.muted = true;
        localVideo.play();
        console.log("Audio tracks enabled:", myStream.getAudioTracks().map(track => track.enabled));
    } catch(err){
        console.error("Failed to get media streams", err);
        alert("Podría no tener acceso a la cámara o al micrófono. Por favor revise sus permisos.")
        return;
    }
    if(isRoomHost){
        socket.emit("join-room", roomId, myUserId, "host");
        activeRoomDisplay.textContent = roomId;
        roomNumberDisplay.textContent = roomId;
        setupScreen.classList.add("hidden");
        callscreen.classList.remove("hidden");
        generatedIdDisplay.classList.remove("hidden");
    } else {
        socket.emit("request-join", roomId, myUserId);
        document.querySelector(".setup-screen").innerHTML = "<h2>Esperando la aprobación de su Llamada...</h2>";
    }
    setupSocketEvents();
}

function setupSocketEvents(){
    socket.on("join-approved", (userId, hostId) => {
        console.log("Join approved by host",hostId);
        if(userId !== myUserId) return;
        socket.emit("join-room", roomId, myUserId, "user");
        setupScreen.classList.add("hidden");
        callscreen.classList.remove("hidden");
        activeRoomDisplay.textContent=roomId;
        createPeerConnection();
        createAndSendOffer(hostId);
    });
    socket.on("user-request-join",(userId, roomId) => {
        if(isRoomHost){
            console.log("User requesting to join:", userId);
            createJoinRequest(userId, roomId);
        }
    });
    socket.on("user-connected", userId => {
        console.log("user-connected", userId);
        if(userId === myUserId) return;
        if(isRoomHost){
            console.log("Host waiting for offer from new user:", userId);
            currentRemoteUserId = userId;
            if(!localPeerConnection){
                createPeerConnection();
            }
        }
    });
    socket.on("ice-candidate", (senderUserId, candidate) => {
        console.log("Received ICE candidate from:", senderUserId);
        if(senderUserId===myUserId) return;
        handleReceivedIceCandidate(senderUserId, candidate);
    });
    socket.on("offer", (senderUserId, targetId, offer) => {
        console.log("Receied offer from:", senderUserId, "for", targetId);
        if(targetId !== myUserId && targetId !== undefined) return;
        if(senderUserId === myUserId) return;
        handleReceivedOffer(senderUserId, offer);
    });
    socket.on("answer", (senderUserId, targetId, answer) => {
        console.log("Received answer from", senderUserId, "for", targetId);
        if(targetId !== myUserId && targetId !== undefined) return;
        if(senderUserId === myUserId) return;
        handleReceivedAnswer(senderUserId, answer)
    });
    socket.on("join-rejected", (reason)=>{
        alert("Su solicitud de Llamada fué declinada: " + (reason || "Host declined"));
        window.location.reload();
    });
    socket.on("user-disconnected", userId => {
        console.log("User disconnected:", userId);
        if(currentRemoteUserId === userId && remoteVideo.srcObject){
            remoteVideo.srcObject.getTracks().forEach(track => track.stop());
            remoteVideo.srcObject = null;
            currentRemoteUserId = null;
        }
        if(localPeerConnection){
            localPeerConnection.close();
            localPeerConnection = null;
        }
    });
}
function createPeerConnection(){
    if(localPeerConnection){
        console.log("Peer connection already exists, closing it first");
        localPeerConnection.close();
    }
    console.log("Creating new RTCPeerConnection");
    localPeerConnection = new RTCPeerConnection(iceServers);
    myStream.getTracks().forEach(track => {
        localPeerConnection.addTrack(track, myStream);
    });
    localPeerConnection.onicecandidate = event => {
        if(event.candidate){
            socket.emit("relay-ice-candidate", roomId, myUserId, currentRemoteUserId, event.candidate);
        }
    };
    localPeerConnection.onconnectionstatechange = event => {
        console.log("Connection state:", localPeerConnection.connectionState);
        if(localPeerConnection.connectionState ==='connected'){
            console.log("Connection established. Audio enabled", audioEnabled);
            console.log("Audio tracks:", myStream.getAudioTracks().map(track => ({
                enabled: track.enabled,
                muted: track.muted,
                id: track.id
            })));
        }
    };
    localPeerConnection.ontrack = event => {
        console.log("Received remote track");
        if(event.streams && event.streams[0]){
            remoteVideo.srcObject = event.streams[0];
            event.streams[0].getAudioTracks().forEach(track => {
                track.enabled = true;
            });
            remoteVideo.play().catch(e => console.error("Error playing remote video", e));
        }
    };
    return localPeerConnection;
}

async function createAndSendOffer(targetUserId){
    try{
        if(!localPeerConnection){
            createPeerConnection();
        }
        currentRemoteUserId = targetUserId;
        const offer = await localPeerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        await localPeerConnection.setLocalDescription(offer);
        socket.emit("relay-offer", roomId, myUserId, targetUserId, offer);
        console.log("Sent offer to:",targetUserId);
    } catch(error){
        console.error("Error creating offer:", error);
    }
}

async function handleReceivedIceCandidate(senderUserId, candidate){
    try{
        if(!localPeerConnection){
            createPeerConnection();
        }
        if(!candidate) return;
        await localPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("Added ICE candidate from:", senderUserId);
    }catch (error){
        console.error("Error adding ICE candidate:", error);
    }
}

async function handleReceivedOffer(senderUserId, offer){
    try{
        if(!localPeerConnection){
            createPeerConnection();
        }
        currentRemoteUserId = senderUserId;
        await localPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await localPeerConnection.createAnswer();
        await localPeerConnection.setLocalDescription(answer);
        socket.emit("relay-answer", roomId, myUserId, senderUserId, answer);
        console.log("Sent answer to:", senderUserId);
    }catch(error){
        console.error("Error handling offer:", error)
    }
}
async function handleReceivedAnswer(senderUserId, answer) {
    try {
      if (!localPeerConnection) {
        console.error("No peer connection exists");
        return;
      }
      
      // Set remote description based on the answer
      await localPeerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      currentRemoteUserId = senderUserId;
      console.log("Set remote description from answer by:", senderUserId);
        } catch(error){
            console.error("Error handling answer:",error);
        }
}
function createJoinRequest(userId, roomId){
    const requestElement = document.createElement("div");
    requestElement.className = "join-request";
    requestElement.innerHTML = `
    <p>Un usuario está solicitando unirse a la Llamada</p>
    <div class="request-buttons">
        <button class="accept-btn">Aceptar</button>
        <button class="reject-btn">Declinar</button>
    </div>`;

    joinRequestContainer.appendChild(requestElement);
    requestElement.querySelector(".accept-btn").addEventListener("click", ()=> {
        socket.emit("approve-join", roomId, userId);
        requestElement.remove();
    });
    requestElement.querySelector(".reject-btn").addEventListener("click", ()=>{
        socket.emit("reject-join", roomId, userId);
        requestElement.remove();
    });
}

function generateRoomId(){
    return Math.random().toString(36).substring(2,12);
}
function generateUserId(){
    return "user_" + Math.random().toString(36).substring(2,10);
}
function copyRoomId(){
    const roomNumberToCopy = isRoomHost ? roomNumberDisplay.textContent : activeRoomDisplay.textContent;
    navigator.clipboard.writeText(roomNumberToCopy)
    .then(()=>{
        alert("ID de Llamada copiada al clipboard!");
    })
    .catch(err => {
        console.error("Could not copy text: ", err);
    });
}
muteAudioBtn.addEventListener("click", ()=>{
    audioEnabled = !audioEnabled;
    myStream.getAudioTracks().forEach(track => {
        track.enabled = audioEnabled;
    });
    muteAudioBtn.textContent = audioEnabled ? "Mute Audio": "Unmute Audio";
    muteAudioBtn.classList.toggle("muted", !audioEnabled);
    console.log("Audio state changed to:", audioEnabled);
});
muteVideoBtn.addEventListener("click", ()=> {
    videoEnabled = !videoEnabled;
    myStream.getVideoTracks().forEach(track => {
        track.enabled = videoEnabled;
    });
    muteVideoBtn.textContent = videoEnabled ? "Mute Video": "Unmute Video";
    muteVideoBtn.classList.toggle("muted", !videoEnabled);
});

window.copyRoomId = copyRoomId;
