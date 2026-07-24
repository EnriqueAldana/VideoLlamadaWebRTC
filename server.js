const express = require('express');
const socketio = require('socket.io');
const path = require('path');
const app = express();
app.use(express.static(path.join(__dirname,'public')));
app.get('/',(req, res) => {
    res.redirect('/index.html');
});
const server = app.listen(3000, () => {
    console.log('Server running on http://localhost:80');
});
const io = socketio(server);
const roomHosts = {};
const roomUsers = {};
io.on('connection', socket => {
    console.log('New connection', socket.id);
    socket.on('join-room', (roomId, userId, role) => {
        console.log(`${role === 'host' ? 'Host' : 'User'} ${userId} joining room ${roomId}`);
        socket.join(roomId)
        if (!roomUsers[roomId]) {
            roomUsers[roomId] = [];
        }
        roomUsers[roomId].push(userId);
        if(role === 'host') {
            roomHosts[roomId] = userId;
            console.log(`Host ${userId} created room ${roomId}`);
        } else {
            console.log(`User ${userId} joined room ${roomId}`);
            socket.to(roomId).emit('user-connected', userId);
        }
        socket.roomId = roomId;
        socket.userId = userId;
        socket.isHost = (role === 'host');
        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected from room ${roomId}`);
            if(roomUsers[roomId]){
                roomUsers[roomId] = roomUsers[roomId].filter(id => id !== userId);
                if(roomUsers[roomId].length === 0) {
                    delete roomUsers[roomId];
                }
            }
            if(role === 'host' && roomHosts[roomId] === userId){
                delete roomHosts[roomId];
            }
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });
    socket.on('request-join', (roomId, userId) => {
        console.log(`User ${userId} requesting to join room ${roomId}`);
        if(roomHosts[roomId]){
            socket.join(roomId);
            socket.roomId = roomId;
            socket.userId = userId;
            socket.to(roomId).emit('user-request-join', userId, roomId);
        } else {
            console.log(`User ${userId} tried to join non-existent room ${roomId}`);
            socket.emit('join-rejected', 'Room does not exist');
        }
    });
    socket.on('approve-join', (roomId, userId) => {
        console.log(`Host approved user ${userId} to join room ${roomId}`);
        if(!roomUsers[roomId]){
            roomUsers[roomId] = [];
        }
        if(!roomUsers[roomId].includes(userId)){
            roomUsers[roomId].push(userId);
        }
        const hostID = roomHosts[roomId];
        io.to(roomId).emit('join-approved', userId, hostID);
        setTimeout(() => {
            io.to(roomId).emit('user-connected', userId);
        }, 500);
    });
    socket.on('reject-join', (roomId, userId) => {
        console.log(`Host rejected user ${userId} from room ${roomId}`);
        io.to(roomId).emit('join-rejected', 'Host declined your request');
    });
    socket.on('relay-ice-candidate', (roomId, senderId, targetId, candidate) => {
        console.log(`Relaying ICE candidate from ${senderId} to ${targetId} in room ${roomId}`);
        socket.to(roomId).emit('ice-candidate', senderId, candidate);
    });
    socket.on('relay-offer', (roomId, senderId, targetId, offer) => {
        console.log(`Relaying offer from ${senderId} to ${targetId} in room ${roomId}`);
        io.to(roomId).emit('offer', senderId, targetId, offer);
    });
    socket.on('relay-answer', (roomId, senderId, targetId, answer) => {
        console.log(`Relaying answer from ${senderId} to ${targetId} in room ${roomId}`);
        io.to(roomId).emit('answer', senderId, targetId, answer);
    });
}); 