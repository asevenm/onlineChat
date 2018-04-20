const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const path = require('path');

const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/DATABASE_CHART";

const onlineUsers = [];
let usersNum = 0;

server.listen(3000, err => {
    if(err) {
        throw(err);
    }
    console.log("server running at 127.0.0.1:3000");
});

app.get('/', (req, res) => {
    res.redirect('/static/chat.html');
})

app.use('/static', express.static(path.join(__dirname, './public')));

io.on('connection', (socket) => {
    socket.on('login', (data) => {
        checkUser(data, socket);
    });
    /**
     * 监听sendMessage
     */
    socket.on('sendMessage', (data) => {
        for(let _user of onlineUsers) {
            if(_user.username === data.username) {
                _user.message.push(data.message);
                //信息存储之后触发receiveMessage将信息发给所有浏览器-广播事件
                io.emit('receiveMessage', data);
                break;
            }
        }
    });
    socket.on('disconnect', () => {
        usersNum = onlineUsers.length;
        console.log(`当前在线登录人数：${usersNum}`);
    });
})

const addOnlineUser = data => {
    onlineUsers.push({
        username: data.username,
        message: []
    });
    usersNum = onlineUsers.length;
    console.log(`用户${data.username}登录成功,进入聊天室，当前在线人数：${usersNum}`);
}

const connectDB = () => {
    return new Promise((resolve, reject) => {
        MongoClient.connect(url, function(err, db) {
            if(err) return reject(err);
            const dbo = db.db("DATABASE_CHART");
            const collection = dbo.collection('userlist');
            resolve({
                db: db,
                collection
            });
        });
    });
}

const isRegister = (dbObj, name) => {
    return new Promise((resolve, reject) => {
        dbObj.collection.find({ username: name }).toArray(function(err, result) {
            if(err) return reject(err);
            resolve(Object.assign(dbObj, { result: result }))
        });
    });
}

const addUser = (dbObj, userData) => {
    return new Promise((resolve, reject) => {
        dbObj.collection.insertOne(userData, function(err, res) {
            if(err) return reject(err);
            resolve(Object.assign(dbObj, res));
            dbObj.db.close();
        });
    });
}

const isLogin = (data) => {
    let flag = false;
    onlineUsers.map(user => {
        if(user.username === data.username) {
            flag = true;
        }
    });
    return flag;
}

const checkUser = (data, socket) => {
    connectDB().then(dbObj => {
        return isRegister(dbObj, data.username);
    }).then(dbObj => {
        const userData = dbObj.result || [];
        if(userData.length > 0) {
            if(userData[0].password === data.password) {
                if(isLogin(data)) {
                    socket.emit('loginResult', { code: 3 });
                } else {
                    addOnlineUser(data);
                    socket.emit('loginResult', { code: 0 });
                }
            } else {
                socket.emit('loginResult', { code: 1 });
            }
            dbObj.db.close();
        } else {
            addUser(dbObj, data).then(resolve => {
                addOnlineUser(data);
                socket.emit('loginResult', { code: '2-0' });
            }, reject => {
                socket.emit('loginResult', { code: '2-1' });
            }).catch(err => console.log(err));
        }
    });
}
