var socketio = require('socket.io')
  , guestNumber = 1
  , nickNames = {}
  , namesUsed = []
  , name
  , nameIndex;

exports.listen = function(server) {
  io = socketio.listen(server);
  io.set('log level', 1);

  io.sockets.on('connection', function (socket) {
    socket.join('Lobby');
    socket.emit('joinResult', {room: 'Lobby'});

    guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);

    handleMessageBroadcasting(socket, nickNames);
    handleNameChangeAttempts(socket, nickNames, namesUsed);
    handleRoomJoining(socket);

    socket.on('rooms', function() {
      socket.emit('rooms', io.sockets.manager.rooms);
    });

    handleClientDisconnection(socket, nickNames, namesUsed);
  });
};

function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
  name = 'Guest' + guestNumber;
  nickNames[socket.id] = name;
  socket.emit('nameResult', {
    success: true,
    name: name
  });
  namesUsed.push(name);
  return guestNumber + 1;
}

function handleMessageBroadcasting(socket, nickNames) {
  socket.on('message', function (message) {
    socket.broadcast.to(message.room).emit('message', {
      text: nickNames[socket.id] + ': ' + message.text
    });
  });
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
  socket.on('nameAttempt', function(name) {
    if (name.indexOf('Guest') == 0) {
      socket.emit('nameResult', {
        success: false,
        message: 'Names cannot begin with "Guest".'
      });
    } else {
      if (namesUsed.indexOf(name) == -1) {
        namesUsed.push(name);
        nickNames[socket.id] = name;
        socket.emit('nameResult', {
          success: true,
          name: name
        });
      } else {
        socket.emit('nameResult', {
          success: false,
          message: 'That name is already in use.'
        });
      }
    }
  });
}

function handleRoomJoining(socket) {
  socket.on('join', function(room) {
    socket.leave(room.previousRoom);
    socket.join(room.newRoom);
    socket.emit('joinResult', {room: room.newRoom});
  });
}

function handleClientDisconnection(socket, nickNames, namesUsed) {
  socket.on('disconnect', function() {
    nameIndex = namesUsed.indexOf(nickNames[socket.id]);
    delete namesUsed[nameIndex];
    delete nickNames[socket.id];
  });
}
