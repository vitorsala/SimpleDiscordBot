var spawn = require('child_process').spawn;
var vars = require('./minecraftServer.json');
var ncp = require('ncp').ncp;

// Inicialização
var serverStopped = true;
var serverSpawnProcess;
var autoRestart = false;
var ram = vars["ram"];
var jarfile = vars["path"];
var backupPath = vars["backupFolder"];
var backupTimer;

ncp.limit = 16;

exports.isOnline = function(){
    return !serverStopped;
}

exports.startServer = function(callback = function(){}) { // Start server process
    serverStopped = false;
    autoRestart = true;
    serverSpawnProcess = spawn('java', [
        '-Xmx' + ram,
        '-Xms' + ram,
        '-jar',
        jarfile,
        'nogui'
    ]);
    serverSpawnProcess.stdout.on('data', log);
    serverSpawnProcess.stderr.on('data', log);
    backupTimer = setInterval(performBackup, 3600000);
    serverSpawnProcess.on('exit', function(code) {
        serverStopped == true; // Server process has crashed or stopped
        if (autoRestart) {
            exports.startServer();
        }
    });
    callback();
}

exports.stopServer = function(callback = function(){}) {
    clearInterval(backupTimer);
    autoRestart = false;
    performBackup();
    serverSpawnProcess.stdin.write('say Closing server!\n');
	serverSpawnProcess.stdin.write('stop\n');
    callback();
}

exports.restartserver = function(callback = function(){}) { // Restarting the server
    clearInterval(backupTimer);
    if (!serverStopped) {
        autoRestart = false;
        serverSpawnProcess.stdin.write('say Restarting server!\n');
        setTimeout(function(){
            serverSpawnProcess.stdin.write('stop\n');
            serverSpawnProcess.on("close", function() {
                exports.startServer();
            callback();
            });
        }, 2000);
    } else {
        exports.startServer();
    	callback();
    }
}

exports.issueCommand = function(command){
    serverSpawnProcess.stdin.write(command+'\n');
}

process.on('exit', function(code) { // When it exits kill the server process too
    serverSpawnProcess.kill(2);
});

process.stdout.on('error', function(err) {
    if (err.code == "EPIPE") {
        process.exit(0);
    }
});

function log(data) { // Log (dump) server output to variable
    //  Technically uneeded, useful for debugging
    // process.stdout.write(data.toString());
    console.log("==== Minecraft Log ====\n");
    console.log(data.toString());
    console.log("=======================\n");
}

// Auto-backup

function performBackup(){
    var d = new Date();
    var suffix = d.getFullYear() + "." + d.getMonth() + "." + d.getDate() + "-" + d.getSeconds() + "." + d.getMinutes() + "." + d.getHours();
    ncp("./world", backupPath+"backup-"+suffix, function (err) {
        if (err) {
            return console.error(err);
        }
        log('Backup Done!');
    });

}