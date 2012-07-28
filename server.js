#!/usr/bin/env node
var http  = require('http')
  , fs    = require('fs')
  , path  = require('path')
  , mime  = require('mime')
  , cache = {};

function send404(response) {
  response.writeHead(404, {'Content-Type': 'text/plain'});
  response.write('Error 404: resource not found.');
  response.end();
}

function serveStatic(response, cache, absPath) {
  if (cache[absPath]) {
    response.writeHead('content-type', mime.lookup(path.basename(absPath)));
    response.end(cache[absPath]);
  } else {
    path.exists(absPath, function(exists) {
      if (exists) {
        fs.readFile(absPath, function(err, data) {
          cache[absPath] = data;
          response.writeHead('content-type', mime.lookup(path.basename(absPath)));
          response.end(data);
        });
      } else {
        send404(response);
      }
    });
  }
}

var server = http.createServer(function(request, response) {
  var filePath = false;

  if (request.url == '/') {
    filePath = 'public/index.html';
  } else {
    filePath = 'public' + request.url;
  }

  if (!filePath) {
    send404(response);
  } else {
    var absPath = './' + filePath;
    serveStatic(response, cache, absPath);
  }
});

server.listen(3000, function() {
  console.log("Server listening on port 3000.");
});

var io = require('socket.io').listen(server)
  , guestNumber = 1
  , nickNames = {}
  , namesUsed = []
  , name
  , nameIndex;

io.set('log level', 1);

io.sockets.on('connection', function (socket) {
  socket.join('Lobby');
  socket.emit('joinResult', {room: 'Lobby'});

  socket.on('disconnect', function() {
    nameIndex = namesUsed.indexOf(nickNames[socket.id]);
    delete namesUsed[nameIndex];
    delete nickNames[socket.id];
  });

  name = 'Guest' + guestNumber;
  nickNames[socket.id] = name;
  socket.emit('nameResult', {
    success: true,
    name: name
  });
  namesUsed.push(name);
  guestNumber += 1; 

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

  socket.on('join', function(room) {
    socket.leave(room.previousRoom);
    socket.join(room.newRoom);
    socket.emit('joinResult', {room: room.newRoom});
  });

  socket.on('message', function (message) {
    socket.broadcast.to(message.room).emit('message', {
      text: nickNames[socket.id] + ': ' + message.text
    });
  });

  socket.on('rooms', function() {
    socket.emit('rooms', io.sockets.manager.rooms);
  });
});
